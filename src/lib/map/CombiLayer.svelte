<script lang="ts">
  import L from 'leaflet';
  import type { CombiFeature } from '$lib/data/types';
  import { useMapLayer } from './useMapLayer.svelte';
  import { ENTITY_STYLE, addSvgTitle } from './mapUtils';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: CombiFeature[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } = $props();

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
    for (const f of features) {
      const sel = f.id === selectedId;
      const latlngs = f.geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number])
      );

      const polygon = L.polygon(latlngs, {
        ...ENTITY_STYLE,
        className: 'combi-zone' + (sel ? ' selected' : '')
      });

      const origUpdatePath = (polygon as any)._updatePath.bind(polygon);
      (polygon as any)._updatePath = function () {
        origUpdatePath();
        const parts: L.Point[][] = (polygon as any)._parts;
        if (!parts?.[0]?.length) return;
        const ring = parts[0];
        const w = Math.sqrt((ring[1].x - ring[0].x) ** 2 + (ring[1].y - ring[0].y) ** 2);
        const h = Math.sqrt((ring[2].x - ring[1].x) ** 2 + (ring[2].y - ring[1].y) ** 2);
        (polygon as any)._path.setAttribute('d', roundedPolyPath(parts, Math.min(w, h) / 2));
      };

      (polygon as L.Layer & { feature?: CombiFeature }).feature = f;
      polygon.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(polygon);
      addSvgTitle(polygon, f.properties.name);

      group.addLayer(L.marker(polygon.getBounds().getCenter(), {
        icon: L.divIcon({
          html: String(f.properties.members.length),
          className: 'combi-count',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        }),
        interactive: false
      }));
    }
  });
</script>
