import L from 'leaflet';

/** Shared base style for filled path map features (obstacles + combi zones). */
export const FILLED_PATH_STYLE = {
  color: '#00a5e3',
  weight: 10,
  fillColor: '#ffffff',
  fillOpacity: 1,
} as const;

const FILLED_PATH_TOOLTIP_OPTS: L.TooltipOptions = {
  direction: 'top',
  offset: [0, -8],
  opacity: 1
};

/** Combi zone labels switch from hover-only to always-visible at this zoom. */
export const COMBI_LABEL_ZOOM = 18;
/** Obstacle labels join one zoom step further in. */
export const OBSTACLE_LABEL_ZOOM = 19;

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function retriggerTooltipAnimation(container: HTMLElement): void {
  const bubble = container.querySelector<HTMLElement>('.tooltip-bubble');
  if (bubble) {
    bubble.classList.remove('tooltip-animate-in');
    void bubble.offsetWidth;
    bubble.classList.add('tooltip-animate-in');
    return;
  }
  container.style.animation = 'none';
  void container.offsetWidth;
  container.style.animation = '';
}

const LABEL_GAP = 4;
const LABEL_EDGE_GAP = 6;
/** Candidate directions in degrees off straight-up: up first, fanning out both sides, down last. */
const LABEL_ANGLE_OFFSETS = [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100, 120, -120, 140, -140, 160, -160, 180];
/** Wider rings tried when every angle at a closer ring is already taken. */
const LABEL_RING_COUNT = 3;

type LabelEntry = { layer: L.Layer; tier: number };
type LabelState = { entries: Set<LabelEntry>; raf?: number; hooked?: boolean };
const labelStates = new WeakMap<L.Map, LabelState>();

function labelState(map: L.Map): LabelState {
  let state = labelStates.get(map);
  if (!state) {
    state = { entries: new Set() };
    labelStates.set(map, state);
  }
  return state;
}

/** Rough feature footprint (degrees²) — ranks same-tier labels, bigger feature wins space first. */
function labelFootprint(layer: L.Layer): number {
  if ('getBounds' in layer && typeof layer.getBounds === 'function') {
    const b = (layer as L.Polyline).getBounds();
    if (b.isValid()) return (b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth());
  }
  return 0;
}

/** Feature's screen box as center + half-extents in map container coordinates. */
function featureScreenBox(
  map: L.Map,
  layer: L.Layer
): { cx: number; cy: number; hw: number; hh: number } | null {
  if ('getBounds' in layer && typeof layer.getBounds === 'function') {
    const b = (layer as L.Polyline).getBounds();
    if (b.isValid()) {
      const p1 = map.latLngToContainerPoint(b.getNorthWest());
      const p2 = map.latLngToContainerPoint(b.getSouthEast());
      return {
        cx: (p1.x + p2.x) / 2,
        cy: (p1.y + p2.y) / 2,
        hw: Math.abs(p2.x - p1.x) / 2,
        hh: Math.abs(p2.y - p1.y) / 2
      };
    }
  }
  if ('getLatLng' in layer && typeof layer.getLatLng === 'function') {
    const p = map.latLngToContainerPoint((layer as L.Marker).getLatLng());
    return { cx: p.x, cy: p.y, hw: 8, hh: 8 };
  }
  return null;
}

type ScreenRect = { l: number; t: number; r: number; b: number };

function rectOverlapArea(a: ScreenRect, b: ScreenRect): number {
  const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
  const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Greedy radial label placement: labels are walked by priority (tier, then
 * feature size); each tries candidate spots on an ellipse hugging its feature —
 * straight-up first, sweeping around to straight-down. Overlapping another
 * label is forbidden; overlapping other features' geometry is penalized by
 * covered area, so a label takes a clean spot when one exists but still places
 * when boxed in (e.g. an obstacle inside a combi). If every angle on a ring
 * collides with other labels, wider rings are tried; only a label whose every
 * ring is fully blocked is hidden.
 */
export function placeLabels(map: L.Map): void {
  const state = labelStates.get(map);
  if (!state || state.entries.size === 0) return;

  // Screen footprints of every feature on the map — labels try not to cover them.
  const featureRects: { id: string; rect: ScreenRect }[] = [];
  map.eachLayer((l) => {
    const feature = (l as L.Layer & { feature?: { id: string } }).feature;
    if (!feature) return;
    const box = featureScreenBox(map, l);
    if (box) {
      featureRects.push({
        id: feature.id,
        rect: { l: box.cx - box.hw, t: box.cy - box.hh, r: box.cx + box.hw, b: box.cy + box.hh }
      });
    }
  });

  const items = [...state.entries]
    .map((entry) => {
      const tooltip = (entry.layer as L.Layer & { getTooltip: () => L.Tooltip | undefined }).getTooltip();
      const el = tooltip?.getElement();
      const bubble = el?.querySelector<HTMLElement>('.tooltip-bubble');
      const box = featureScreenBox(map, entry.layer);
      const featureId = (entry.layer as L.Layer & { feature?: { id: string } }).feature?.id;
      if (!tooltip || !el || !bubble || !box) return null;
      return { tooltip, el, box, featureId, tier: entry.tier, size: labelFootprint(entry.layer), bubble };
    })
    .filter((item) => item !== null);
  items.sort((a, b) => (b.tier - a.tier) || (b.size - a.size));

  const placed: ScreenRect[] = [];
  for (const item of items) {
    const { width: w, height: h } = item.bubble.getBoundingClientRect();
    let best: { x: number; y: number; rect: ScreenRect; penalty: number } | null = null;
    // If every angle on the ring hugging the feature collides with an already-placed
    // label, step out to a wider ring and sweep again before giving up — otherwise a
    // label in a dense cluster is culled even though open space exists further out.
    ringLoop: for (let ring = 0; ring < LABEL_RING_COUNT; ring++) {
      const ringGap = LABEL_EDGE_GAP + ring * (h + LABEL_GAP);
      for (const deg of LABEL_ANGLE_OFFSETS) {
        const a = ((90 - deg) * Math.PI) / 180;
        const x = item.box.cx + (item.box.hw + w / 2 + ringGap) * Math.cos(a);
        const y = item.box.cy - (item.box.hh + h / 2 + ringGap) * Math.sin(a);
        const rect: ScreenRect = { l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 };
        const collides = placed.some(
          (p) =>
            rect.l < p.r + LABEL_GAP &&
            rect.r > p.l - LABEL_GAP &&
            rect.t < p.b + LABEL_GAP &&
            rect.b > p.t - LABEL_GAP
        );
        if (collides) continue;
        let penalty = 0;
        for (const f of featureRects) {
          if (f.id === item.featureId) continue;
          penalty += rectOverlapArea(rect, f.rect);
        }
        if (!best || penalty < best.penalty - 0.5) best = { x, y, rect, penalty };
        if (best.penalty === 0) break ringLoop;
      }
      if (best) break;
    }
    item.el.classList.toggle('tooltip-culled', !best);
    if (best) {
      placed.push(best.rect);
      item.tooltip.setLatLng(map.containerPointToLatLng(L.point(best.x, best.y)));
    }
  }
}

/** rAF-debounced: many labels open in the same tick when a zoom threshold is crossed. */
function scheduleLabelPlacement(map: L.Map): void {
  const state = labelState(map);
  if (!state.hooked) {
    state.hooked = true;
    map.on('zoomend', () => scheduleLabelPlacement(map));
  }
  if (state.raf !== undefined) return;
  state.raf = requestAnimationFrame(() => {
    state.raf = undefined;
    placeLabels(map);
  });
}

/** Top-center of a layer's bounds — tooltip sits above the feature, not its centroid. */
export function tooltipAnchor(layer: L.Layer): L.LatLng {
  if ('getBounds' in layer && typeof layer.getBounds === 'function') {
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      return L.latLng(bounds.getNorth(), bounds.getCenter().lng);
    }
  }
  if ('getLatLng' in layer && typeof layer.getLatLng === 'function') {
    return layer.getLatLng();
  }
  if ('getCenter' in layer && typeof layer.getCenter === 'function') {
    return layer.getCenter();
  }
  return L.latLng(0, 0);
}

/**
 * Binds a Leaflet tooltip showing the filled path feature name.
 * Hover-only by default; with `permanentAtZoom` set, the tooltip becomes an
 * always-visible label once the map zoom reaches that level. `labelTier` ranks
 * labels for radial placement — higher tiers claim their spot first.
 */
export function bindFilledPathTooltip(
  layer: L.Layer,
  text: string,
  permanentAtZoom?: number,
  labelTier = 0
): void {
  const name = text.trim();
  if (!name) return;
  const bubbleClass = labelTier > 0 ? 'tooltip-bubble tooltip-bubble--strong' : 'tooltip-bubble';
  const html = `<span class="${bubbleClass}">${escapeHtml(name)}</span>`;
  const entry: LabelEntry = { layer, tier: labelTier };

  const getMap = () => (layer as L.Layer & { _map?: L.Map })._map;

  layer.on('tooltipopen', () => {
    const tooltip = layer.getTooltip();
    if (!tooltip) return;
    tooltip.setLatLng(tooltipAnchor(layer));
    const el = tooltip.getElement();
    if (el) retriggerTooltipAnimation(el);
    const map = getMap();
    if (tooltip.options.permanent && map) {
      labelState(map).entries.add(entry);
      scheduleLabelPlacement(map);
    }
  });

  layer.on('tooltipclose', () => {
    const map = getMap();
    if (!map) return;
    labelState(map).entries.delete(entry);
    scheduleLabelPlacement(map);
  });

  // Leaflet's own click handler re-opens an already-open hover tooltip and resets
  // its position to the feature's raw center (Layer.Tooltip's _prepareOpen default),
  // without re-firing 'tooltipopen' — so the top-center fix above never runs for it.
  // Deferring to a microtask guarantees this runs after that synchronous reset,
  // regardless of listener registration order across permanent/hover rebinds.
  layer.on('click', () => {
    queueMicrotask(() => {
      const tooltip = layer.getTooltip();
      if (tooltip && !tooltip.options.permanent && tooltip.isOpen()) {
        tooltip.setLatLng(tooltipAnchor(layer));
      }
    });
  });

  let permanent = false;
  const bind = () => {
    layer.unbindTooltip();
    layer.bindTooltip(
      html,
      permanent
        ? { ...FILLED_PATH_TOOLTIP_OPTS, permanent: true, direction: 'center', offset: [0, 0] }
        : { ...FILLED_PATH_TOOLTIP_OPTS, permanent: false }
    );
  };
  bind();

  if (permanentAtZoom === undefined) return;

  let zoomedMap: L.Map | undefined;
  const sync = () => {
    if (!zoomedMap) return;
    const next = zoomedMap.getZoom() >= permanentAtZoom;
    if (next !== permanent) {
      permanent = next;
      bind();
    }
  };
  const watchZoom = () => {
    zoomedMap = (layer as L.Layer & { _map?: L.Map })._map;
    zoomedMap?.on('zoomend', sync);
    sync();
  };
  layer.on('add', watchZoom);
  layer.on('remove', () => {
    zoomedMap?.off('zoomend', sync);
    if (zoomedMap) labelState(zoomedMap).entries.delete(entry);
    zoomedMap = undefined;
  });
  // Both call sites add the layer to the map before binding, so 'add' already fired.
  if ((layer as L.Layer & { _map?: L.Map })._map) watchZoom();
}

const DOUBLE_TAP_MS = 350;
const MAP_DESELECT_SUPPRESS_MS = 400;

let suppressMapDeselectUntil = 0;
let mapGestureActive = false;

/** True while a PM drag/rotate/vertex gesture is active or briefly after it ends. */
export function shouldSuppressMapDeselect(): boolean {
  return mapGestureActive || Date.now() < suppressMapDeselectUntil;
}

function markMapGestureStart(): void {
  mapGestureActive = true;
}

function markMapGestureEnd(): void {
  mapGestureActive = false;
  suppressMapDeselectUntil = Date.now() + MAP_DESELECT_SUPPRESS_MS;
}

/** Called by custom combi rotation handle drags. */
export function notifyMapGestureStart(): void {
  markMapGestureStart();
}

export function notifyMapGestureEnd(): void {
  markMapGestureEnd();
}

/** Click landed on rendered feature geometry (not empty map background). */
export function isFeatureSurfaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest(
    'path.combi-zone, path.obstacle-poly, path.obstacle-line, .obstacle-dot, .landmark-marker, .leaflet-interactive'
  );
  return !!el && !el.classList.contains('leaflet-container');
}

/** Geoman vertex/rotation handles are separate map layers; clicks must not deselect. */
export function isGeomanHandleTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('.landmark-marker, .landmark-pill, .combi-count')) return false;
  return !!target.closest('.marker-icon, .marker-icon-middle, .leaflet-pm-rotation, .combi-rotate-handle');
}

/** Toggle the `.selected` CSS class on a layer's rendered element. */
export function setLayerSelected(layer: L.Layer, selected: boolean): void {
  const el = (layer as L.Path & { getElement?: () => HTMLElement | SVGElement | null }).getElement?.();
  if (el) el.classList.toggle('selected', selected);
}

/** Update selection styling on all feature-tagged layers without rebuilding them. */
export function syncMapFeatureSelection(map: L.Map, selectedId: string | null): void {
  map.eachLayer((layer) => {
    const feature = (layer as L.Layer & { feature?: { id: string } }).feature;
    if (!feature) return;
    setLayerSelected(layer, feature.id === selectedId);
  });
}

export type FeatureGestureCallbacks = {
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  enabled?: () => boolean;
};

/** Tap selects; double-tap/double-click opens details. Drag requires prior selection (Geoman). */
export function attachFeatureGestures(
  layer: L.Layer,
  featureId: string,
  callbacks: FeatureGestureCallbacks
): void {
  let dragged = false;
  let transforming = false;
  let lastTapAt = 0;

  const clearGestureFlag = (flag: 'dragged' | 'transforming') => {
    setTimeout(() => {
      if (flag === 'dragged') dragged = false;
      else transforming = false;
    }, 0);
  };

  layer.on('pm:dragstart', () => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    dragged = true;
    markMapGestureStart();
  });

  layer.on('pm:dragend', () => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    markMapGestureEnd();
    callbacks.onSelect(featureId);
    clearGestureFlag('dragged');
  });

  layer.on('pm:rotatestart', () => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    transforming = true;
    markMapGestureStart();
  });

  layer.on('pm:rotateend', () => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    markMapGestureEnd();
    callbacks.onSelect(featureId);
    clearGestureFlag('transforming');
  });

  layer.on('pm:markerdragstart', () => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    transforming = true;
    markMapGestureStart();
  });

  layer.on('pm:markerdragend', () => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    markMapGestureEnd();
    callbacks.onSelect(featureId);
    clearGestureFlag('transforming');
  });

  layer.on('click', (e: L.LeafletMouseEvent) => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    if (dragged || transforming) return;

    L.DomEvent.stop(e);
    const now = Date.now();
    if (now - lastTapAt < DOUBLE_TAP_MS) {
      lastTapAt = 0;
      callbacks.onSelect(featureId);
      callbacks.onOpenDetails?.(featureId);
    } else {
      lastTapAt = now;
      callbacks.onSelect(featureId);
    }
  });

  layer.on('dblclick', (e: L.LeafletMouseEvent) => {
    if (callbacks.enabled && !callbacks.enabled()) return;
    if (dragged || transforming) return;
    if (!callbacks.onOpenDetails) return;

    L.DomEvent.stop(e);
    L.DomEvent.preventDefault(e.originalEvent);
    lastTapAt = 0;
    callbacks.onSelect(featureId);
    callbacks.onOpenDetails(featureId);
  });
}
