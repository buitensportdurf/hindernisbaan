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

const LABEL_GAP = 8;
/** Clear space between a label edge and the feature stroke, not just its coordinate box. */
const LABEL_EDGE_GAP = 16;
/** Half the drawn stroke, so a label sitting on the coordinate box still clears the pixels. */
const LABEL_STROKE_PAD = 10;
/** Candidate directions in degrees off straight-up: up first, fanning out both sides, down last. */
const LABEL_ANGLE_OFFSETS = [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100, 120, -120, 140, -140, 160, -160, 180];
/** Wider rings tried when every angle at a closer ring is already taken. */
const LABEL_RING_COUNT = 3;

type LabelEntry = { layer: L.Layer; tier: number };
type LabelState = {
  entries: Set<LabelEntry>;
  /** When set, only this feature's name tooltip stays visible. */
  selectedId?: string | null;
  raf?: number;
  hooked?: boolean;
};
const labelStates = new WeakMap<L.Map, LabelState>();

function labelState(map: L.Map): LabelState {
  let state = labelStates.get(map);
  if (!state) {
    state = { entries: new Set() };
    labelStates.set(map, state);
  }
  return state;
}

/** True when a name tooltip should stay hidden because another feature is selected. */
function isTooltipHiddenBySelection(
  selectedId: string | null | undefined,
  featureId: string | undefined
): boolean {
  return selectedId != null && featureId !== selectedId;
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

/** How crowded a candidate is: closer neighbours push harder, so labels spread apart. */
function labelPressure(rect: ScreenRect, placed: ScreenRect[]): number {
  const cx = (rect.l + rect.r) / 2;
  const cy = (rect.t + rect.b) / 2;
  let pressure = 0;
  for (const other of placed) {
    const ox = (other.l + other.r) / 2;
    const oy = (other.t + other.b) / 2;
    const dist = Math.hypot(cx - ox, cy - oy);
    pressure += 800 / (dist + 8);
  }
  return pressure;
}

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
      const pad = LABEL_STROKE_PAD;
      featureRects.push({
        id: feature.id,
        rect: {
          l: box.cx - box.hw - pad,
          t: box.cy - box.hh - pad,
          r: box.cx + box.hw + pad,
          b: box.cy + box.hh + pad
        }
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

  const selectedId = state.selectedId ?? null;
  const placed: ScreenRect[] = [];
  for (const item of items) {
    // Selection focus: other features' labels step aside so the selected one keeps its spot.
    if (isTooltipHiddenBySelection(selectedId, item.featureId)) {
      item.el.classList.add('tooltip-selection-hidden');
      item.el.classList.remove('tooltip-culled');
      continue;
    }
    item.el.classList.remove('tooltip-selection-hidden');

    const { width: w, height: h } = item.bubble.getBoundingClientRect();
    let best: { x: number; y: number; rect: ScreenRect; penalty: number } | null = null;
    // If every angle on the ring hugging the feature collides with an already-placed
    // label, step out to a wider ring and sweep again before giving up — otherwise a
    // label in a dense cluster is culled even though open space exists further out.
    ringLoop: for (let ring = 0; ring < LABEL_RING_COUNT; ring++) {
      const ringGap = LABEL_EDGE_GAP + ring * (h + LABEL_GAP);
      const hw = item.box.hw + LABEL_STROKE_PAD;
      const hh = item.box.hh + LABEL_STROKE_PAD;
      for (const deg of LABEL_ANGLE_OFFSETS) {
        const a = ((90 - deg) * Math.PI) / 180;
        const x = item.box.cx + (hw + w / 2 + ringGap) * Math.cos(a);
        const y = item.box.cy - (hh + h / 2 + ringGap) * Math.sin(a);
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
          // Own geometry counts too — a label must clear the stroke it belongs to.
          const overlap = rectOverlapArea(rect, f.rect);
          penalty += f.id === item.featureId ? overlap * 4 : overlap;
        }
        const pressure = labelPressure(rect, placed);
        const score = penalty + pressure;
        if (!best || score < best.penalty - 0.5) best = { x, y, rect, penalty: score };
        if (penalty === 0 && pressure === 0) break ringLoop;
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

/** Label bubble HTML: the name, the fault on its own line, or both. Empty when neither. */
function filledPathTooltipHtml(name: string, labelTier: number, fault?: string): string {
  if (!name && !fault) return '';
  const bubbleClass = labelTier > 0 ? 'tooltip-bubble tooltip-bubble--strong' : 'tooltip-bubble';
  const faultHtml = fault ? `<span class="tooltip-fault">${escapeHtml(fault)}</span>` : '';
  return `<span class="${bubbleClass}">${escapeHtml(name)}${faultHtml}</span>`;
}

/**
 * Binds a Leaflet tooltip showing the filled path feature name, plus its fault if any.
 * Hover-only by default; with `permanentAtZoom` set, the tooltip becomes an
 * always-visible label once the map zoom reaches that level. `labelTier` ranks
 * labels for radial placement — higher tiers claim their spot first.
 */
export function bindFilledPathTooltip(
  layer: L.Layer,
  text: string,
  permanentAtZoom?: number,
  labelTier = 0,
  fault?: string
): void {
  const html = filledPathTooltipHtml(text.trim(), labelTier, fault);
  if (!html) return;
  const entry: LabelEntry = { layer, tier: labelTier };

  const getMap = () => (layer as L.Layer & { _map?: L.Map })._map;

  layer.on('tooltipopen', () => {
    const tooltip = layer.getTooltip();
    if (!tooltip) return;
    tooltip.setLatLng(tooltipAnchor(layer));
    const el = tooltip.getElement();
    const map = getMap();
    const featureId = (layer as L.Layer & { feature?: { id: string } }).feature?.id;
    if (el) {
      const hide = isTooltipHiddenBySelection(map ? labelState(map).selectedId : null, featureId);
      el.classList.toggle('tooltip-selection-hidden', hide);
      if (!hide) retriggerTooltipAnimation(el);
    }
    if (tooltip.options.permanent && map) {
      labelState(map).entries.add(entry);
      scheduleLabelPlacement(map);
    }
  });

  layer.on('tooltipclose', () => {
    const map = getMap();
    const tooltip = layer.getTooltip();
    // Permanent labels must survive deselect / Geoman disable. Leaflet closes them
    // when the layer briefly fires `remove` or when a `move` leaves them stranded;
    // reopen in the same tick if the layer is still on the map.
    if (tooltip?.options.permanent && map?.hasLayer(layer)) {
      queueMicrotask(() => {
        const current = layer.getTooltip();
        if (!current?.options.permanent || !map.hasLayer(layer)) return;
        if (!current.isOpen()) layer.openTooltip();
        scheduleLabelPlacement(map);
      });
      return;
    }
    if (!map) return;
    labelState(map).entries.delete(entry);
    scheduleLabelPlacement(map);
  });

  // Leaflet's `move` handler (registered by bindTooltip) snaps an open tooltip to the
  // feature centroid while the pointer is down. Re-bind ours after each bindTooltip
  // so it runs last, in the same turn, and the label never paints at the center.
  const restoreTooltip = () => {
    const tooltip = layer.getTooltip();
    if (!tooltip) return;
    if (tooltip.options.permanent) {
      if (!tooltip.isOpen()) layer.openTooltip();
      const map = getMap();
      if (map) scheduleLabelPlacement(map);
      return;
    }
    if (!tooltip.isOpen()) return;
    tooltip.setLatLng(tooltipAnchor(layer));
  };
  const pinTooltip = () => {
    for (const event of ['mousedown', 'click', 'move'] as const) {
      layer.off(event, restoreTooltip);
      layer.on(event, restoreTooltip);
    }
  };

  let permanent = false;
  const bind = () => {
    layer.unbindTooltip();
    layer.bindTooltip(
      html,
      permanent
        ? { ...FILLED_PATH_TOOLTIP_OPTS, permanent: true, direction: 'center', offset: [0, 0] }
        : { ...FILLED_PATH_TOOLTIP_OPTS, permanent: false, offset: [0, -16] }
    );
    pinTooltip();
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

/** Update a feature label in place. Binds one if the name or fault just became non-empty. */
export function syncFilledPathTooltip(
  layer: L.Layer,
  text: string,
  permanentAtZoom?: number,
  labelTier = 0,
  fault?: string
): void {
  const name = text.trim();
  const html = filledPathTooltipHtml(name, labelTier, fault);
  const tooltip = layer.getTooltip();
  if (!html) {
    if (tooltip) layer.unbindTooltip();
    return;
  }
  if (!tooltip) {
    bindFilledPathTooltip(layer, name, permanentAtZoom, labelTier, fault);
    return;
  }
  // Skip DOM writes when the label is unchanged — setContent + placement on every
  // keystroke for every feature is what made rename feel like a full map refresh.
  if (tooltip.getContent() === html) return;
  tooltip.setContent(html);
  if (tooltip.options.permanent) {
    const map = (layer as L.Layer & { _map?: L.Map })._map;
    if (map) scheduleLabelPlacement(map);
  }
}

/** Geoman vertex/rotation handles are separate map layers; clicks must not deselect. */
export function isGeomanHandleTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('.landmark-marker, .landmark-pill, .combi-count')) return false;
  return !!target.closest('.marker-icon, .marker-icon-middle, .leaflet-pm-rotation, .combi-rotate-handle');
}

/** Toggle the `.is-invalid` CSS class on a layer's rendered element. */
export function setLayerInvalid(layer: L.Layer, invalid: boolean): void {
  const el = (layer as L.Path & { getElement?: () => HTMLElement | SVGElement | null }).getElement?.();
  if (el) el.classList.toggle('is-invalid', invalid);
}

/** Toggle the `.selected` CSS class on a layer's rendered element. */
export function setLayerSelected(layer: L.Layer, selected: boolean): void {
  const el = (layer as L.Path & { getElement?: () => HTMLElement | SVGElement | null }).getElement?.();
  if (el) el.classList.toggle('selected', selected);
}

/** Update selection styling on all feature-tagged layers without rebuilding them.
 *  Also hides name tooltips of every feature that is not the selected one. */
export function syncMapFeatureSelection(map: L.Map, selectedId: string | null): void {
  const state = labelState(map);
  const selectionChanged = state.selectedId !== selectedId;
  state.selectedId = selectedId;

  map.eachLayer((layer) => {
    const feature = (layer as L.Layer & { feature?: { id: string } }).feature;
    if (!feature) return;
    setLayerSelected(layer, feature.id === selectedId);

    const tooltip = (
      layer as L.Layer & { getTooltip?: () => L.Tooltip | undefined }
    ).getTooltip?.();
    const el = tooltip?.getElement();
    if (el) {
      el.classList.toggle(
        'tooltip-selection-hidden',
        isTooltipHiddenBySelection(selectedId, feature.id)
      );
    }
  });

  if (selectionChanged) scheduleLabelPlacement(map);
}
