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

const LABEL_CULL_PAD = 4;

/** Rough feature footprint (degrees²) — only used to rank same-tier labels, bigger wins. */
function labelFootprint(layer: L.Layer): number {
  if ('getBounds' in layer && typeof layer.getBounds === 'function') {
    const b = (layer as L.Polyline).getBounds();
    if (b.isValid()) return (b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth());
  }
  return 0;
}

/**
 * Greedy label deconfliction: walk open labels by priority (tier, then feature
 * size) and hide any whose bubble overlaps an already-placed one. Hidden labels
 * come back automatically on the next pass when space frees up.
 */
function cullOverlappingLabels(map: L.Map): void {
  const pane = map.getPane('tooltipPane');
  if (!pane) return;
  const labels = [...pane.querySelectorAll<HTMLElement>('.leaflet-tooltip')]
    .map((el) => ({
      el,
      tier: Number(el.dataset.labelTier ?? Infinity),
      size: Number(el.dataset.labelSize ?? 0),
      bubble: el.querySelector<HTMLElement>('.tooltip-bubble')
    }))
    .filter((label) => label.bubble);
  labels.sort((a, b) => (b.tier - a.tier) || (b.size - a.size));

  const placed: DOMRect[] = [];
  for (const label of labels) {
    const r = label.bubble!.getBoundingClientRect();
    const overlaps = placed.some(
      (p) =>
        r.left < p.right + LABEL_CULL_PAD &&
        r.right > p.left - LABEL_CULL_PAD &&
        r.top < p.bottom + LABEL_CULL_PAD &&
        r.bottom > p.top - LABEL_CULL_PAD
    );
    label.el.classList.toggle('tooltip-culled', overlaps);
    if (!overlaps) placed.push(r);
  }
}

/** rAF-debounced: many tooltips open in the same tick when a zoom threshold is crossed. */
function scheduleLabelCull(map: L.Map): void {
  const m = map as L.Map & { _labelCullRaf?: number; _labelCullHooked?: boolean };
  if (!m._labelCullHooked) {
    m._labelCullHooked = true;
    m.on('zoomend', () => scheduleLabelCull(m));
  }
  if (m._labelCullRaf !== undefined) return;
  m._labelCullRaf = requestAnimationFrame(() => {
    m._labelCullRaf = undefined;
    cullOverlappingLabels(m);
  });
}

/** Top-center of a layer's bounds — tooltip sits above the feature, not its centroid. */
function tooltipAnchor(layer: L.Layer): L.LatLng {
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
 * permanent labels for overlap culling — higher tiers win space.
 */
export function bindFilledPathTooltip(
  layer: L.Layer,
  text: string,
  permanentAtZoom?: number,
  labelTier?: number
): void {
  const name = text.trim();
  if (!name) return;
  const html = `<span class="tooltip-bubble">${escapeHtml(name)}</span>`;

  layer.on('tooltipopen', () => {
    const tooltip = layer.getTooltip();
    tooltip?.setLatLng(tooltipAnchor(layer));
    const el = tooltip?.getElement();
    if (!el) return;
    retriggerTooltipAnimation(el);
    const map = (layer as L.Layer & { _map?: L.Map })._map;
    if (labelTier !== undefined && tooltip?.options.permanent && map) {
      el.dataset.labelTier = String(labelTier);
      el.dataset.labelSize = String(labelFootprint(layer));
      scheduleLabelCull(map);
    }
  });

  let permanent = false;
  const bind = () => {
    layer.unbindTooltip();
    layer.bindTooltip(html, { ...FILLED_PATH_TOOLTIP_OPTS, permanent });
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
