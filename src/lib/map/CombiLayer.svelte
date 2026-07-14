<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import type { CombiFeature } from '$lib/data/types';
  import { useMapLayer } from './useMapLayer.svelte';
  import { FILLED_PATH_STYLE, bindFilledPathTooltip, attachFeatureGestures, syncMapFeatureSelection } from './mapUtils';

  let {
    features,
    selectedId,
    onSelect,
    onOpenDetails,
    gesturesEnabled
  }: {
    features: CombiFeature[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onOpenDetails?: (id: string) => void;
    gesturesEnabled?: () => boolean;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  $effect(() => {
    const map = getMap();
    const id = selectedId;
    void features;
    if (!map) return;
    queueMicrotask(() => syncMapFeatureSelection(map, id));
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

  useMapLayer((group) => {
    const activeSelectedId = selectedId;
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
      };

      (rectangle as L.Layer & { feature?: CombiFeature }).feature = f;
      attachFeatureGestures(rectangle, f.id, {
        onSelect,
        onOpenDetails,
        enabled: gesturesEnabled
      });
      group.addLayer(rectangle);
      bindFilledPathTooltip(rectangle, f.properties.name);

      const count = f.properties.members.length;
      const showCount = activeSelectedId === null || activeSelectedId === f.id;
      if (count > 0 && showCount) {
        group.addLayer(L.marker(rectangle.getBounds().getCenter(), {
          icon: L.divIcon({
            html: String(count),
            className: 'combi-count',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          }),
          interactive: false,
          pmIgnore: true
        }));
      }
    }
  });
</script>
