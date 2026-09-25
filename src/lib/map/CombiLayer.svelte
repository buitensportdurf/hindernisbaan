<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import L from 'leaflet';
  import type { CombiFeature } from '$lib/data/types';
  import type { InteractionController } from '$lib/interaction/controller.svelte';
  import { useMapLayer } from './useMapLayer.svelte';
  import { FILLED_PATH_STYLE, COMBI_LABEL_ZOOM, syncFilledPathTooltip } from './mapUtils';
  import { bindFeatureInteraction } from './featureGestures';

  let {
    features,
    interaction,
    labelsEnabled = true
  }: {
    features: CombiFeature[];
    interaction: InteractionController;
    labelsEnabled?: boolean;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  // Selection only toggles a CSS class — must not tear down / rebuild layers.
  $effect(() => {
    const map = getMap();
    const id = interaction.selectedId;
    if (!map) return;
    queueMicrotask(() => {
      map.eachLayer((layer) => {
        if (!(layer instanceof L.Marker)) return;
        const feature = (layer as L.Layer & { feature?: CombiFeature }).feature;
        if (!feature) return;
        const el = layer.getElement();
        el?.classList.toggle('combi-count--selection-hidden', id !== null && id !== feature.id);
      });
    });
  });

  function roundedPolyPath(parts: L.Point[][], r: number): string {
    let str = '';
    for (const ring of parts) {
      const n = ring.length;
      if (n < 3) continue;
      let area = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
      }
      // CW (area>0) → sweep=1, CCW (area<0) → sweep=0
      const sweep = area > 0 ? 1 : 0;
      let first = true;
      for (let i = 0; i < n; i++) {
        const prev = ring[(i - 1 + n) % n];
        const curr = ring[i];
        const next = ring[(i + 1) % n];
        const d1x = curr.x - prev.x, d1y = curr.y - prev.y;
        const l1 = Math.sqrt(d1x * d1x + d1y * d1y);
        const d2x = next.x - curr.x, d2y = next.y - curr.y;
        const l2 = Math.sqrt(d2x * d2x + d2y * d2y);
        if (l1 === 0 || l2 === 0) continue;
        const cr = Math.min(r, l1 / 2, l2 / 2);
        const ax = curr.x - cr * d1x / l1, ay = curr.y - cr * d1y / l1;
        const bx = curr.x + cr * d2x / l2, by = curr.y + cr * d2y / l2;
        str += first ? `M ${ax} ${ay}` : ` L ${ax} ${ay}`;
        str += ` A ${cr} ${cr} 0 0 ${sweep} ${bx} ${by}`;
        first = false;
      }
      str += ' Z';
    }
    return str || 'M0 0';
  }

  // Min screen-space edge length (px) below which the count hides.
  // Lower = count survives further zoom-out; one Leaflet zoom step halves the on-screen size.
  const COUNT_FIT_THRESHOLD = 16;

  const geometryKey = $derived(
    features
      .map(
        (f) =>
          `${f.id}:${JSON.stringify(f.geometry.coordinates)}:${f.properties.members.length}`
      )
      .join('\n')
  );

  $effect(() => {
    const names = features.map((f) => [f.id, f.properties.name] as const);
    const zoom = labelsEnabled ? COMBI_LABEL_ZOOM : undefined;
    const map = getMap();
    if (!map) return;
    untrack(() => {
      map.eachLayer((layer) => {
        const feature = (layer as L.Layer & { feature?: CombiFeature }).feature;
        const pmIgnore = (layer as L.Layer & { options?: { pmIgnore?: boolean } }).options?.pmIgnore;
        if (!feature || pmIgnore || !(layer instanceof L.Rectangle)) return;
        const name = names.find(([id]) => id === feature.id)?.[1];
        if (name === undefined) return;
        syncFilledPathTooltip(layer, name, zoom, 1);
      });
    });
  });

  useMapLayer((group) => {
    for (const f of features) {
      const latlngs = f.geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number])
      );

      // L.rectangle → Geoman PM.Edit.Rectangle (4 corners, no freeform vertices).
      const bounds = L.latLngBounds(latlngs[0]);
      const rectangle = L.rectangle(bounds, {
        ...FILLED_PATH_STYLE,
        className: 'combi-zone'
      });
      rectangle.setLatLngs(latlngs);

      const count = f.properties.members.length;
      const countMarker = count > 0
        ? L.marker(rectangle.getBounds().getCenter(), {
            icon: L.divIcon({
              html: String(count),
              className: 'combi-count',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            }),
            interactive: false,
            pmIgnore: true
          })
        : null;
      if (countMarker) (countMarker as L.Layer & { feature?: CombiFeature }).feature = f;

      let lastMinEdge = Infinity;
      const syncCountVisibility = () => {
        countMarker?.getElement()?.classList.toggle('combi-count--hidden', lastMinEdge < COUNT_FIT_THRESHOLD);
      };

      const origUpdatePath = (rectangle as L.Rectangle & { _updatePath: () => void })._updatePath.bind(rectangle);
      (rectangle as L.Rectangle & { _updatePath: () => void })._updatePath = function () {
        origUpdatePath();
        const parts: L.Point[][] = (rectangle as L.Rectangle & { _parts?: L.Point[][] })._parts ?? [];
        if (!parts?.[0]?.length) return;
        const ring = parts[0];
        let minEdge = Infinity;
        for (let i = 0; i < ring.length; i++) {
          const j = (i + 1) % ring.length;
          const dx = ring[j].x - ring[i].x;
          const dy = ring[j].y - ring[i].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) minEdge = Math.min(minEdge, len);
        }
        const r = minEdge === Infinity ? 0 : minEdge / 2;
        const path = (rectangle as L.Rectangle & { _path?: SVGPathElement })._path;
        path?.setAttribute('d', roundedPolyPath(parts, r));
        lastMinEdge = minEdge;
        syncCountVisibility();
        const center = rectangle.getBounds().getCenter();
        if (countMarker && !countMarker.getLatLng().equals(center)) countMarker.setLatLng(center);
      };

      (rectangle as L.Layer & { feature?: CombiFeature }).feature = f;
      bindFeatureInteraction(rectangle, f.id, interaction);
      group.addLayer(rectangle);
      syncFilledPathTooltip(rectangle, f.properties.name, labelsEnabled ? COMBI_LABEL_ZOOM : undefined, 1);

      if (countMarker) {
        group.addLayer(countMarker);
        // _updatePath may have fired before the marker element existed.
        syncCountVisibility();
      }
    }
  }, () => geometryKey);
</script>
