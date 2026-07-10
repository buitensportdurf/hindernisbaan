<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import type { CombiFeature } from '$lib/data/types';
  import { tweaks } from '$lib/state/tweaks.svelte';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: CombiFeature[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  $effect(() => {
    const map = getMap();
    if (!map) return;

    const group = L.layerGroup().addTo(map);
    const rects: SVGRectElement[] = [];
    const cleanups: (() => void)[] = [];

    for (const f of features) {
      const isSelected = f.id === selectedId;
      const coords = f.geometry.coordinates[0]; // [lng, lat][] incl. closing point

      const latlngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);

      // Invisible Leaflet polygon — handles tooltip + click, sits on top of rect
      const hitPoly = L.polygon(latlngs, { opacity: 0, fillOpacity: 0 });
      hitPoly.bindTooltip(f.properties.name, { direction: 'top', opacity: 1 });
      hitPoly.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(hitPoly);

      // Get the Leaflet overlay SVG <g> (exists after addLayer)
      const overlayPane = map.getPanes().overlayPane;
      const svgEl = overlayPane.querySelector('svg') as SVGSVGElement | null;
      const gEl = svgEl?.firstElementChild as SVGGElement | null;
      if (!svgEl || !gEl) continue;

      // Create <rect> for visual — pointer-events off so clicks reach hitPoly above
      const rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rectEl.setAttribute('class', 'combi-fence' + (isSelected ? ' selected' : ''));
      rectEl.setAttribute('stroke', '#00a5e3');
      // Doubled stroke-width: paint-order stroke fill makes only outer half visible → 5px outside border
      rectEl.setAttribute('stroke-width', String(isSelected ? tweaks.combiWeight * 2 : 10));
      rectEl.setAttribute('fill', 'white');
      rectEl.style.pointerEvents = 'none';

      // Insert rect BEFORE hitPoly's <path> (last child of <g>) so it renders beneath
      gEl.insertBefore(rectEl, gEl.lastElementChild);
      rects.push(rectEl);

      function updateRect() {
        if (!map) return;
        const pts = coords.slice(0, 4).map(([lng, lat]) =>
          map.latLngToLayerPoint(L.latLng(lat, lng))
        );
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const w = Math.sqrt(dx * dx + dy * dy);
        const dx2 = pts[2].x - pts[1].x;
        const dy2 = pts[2].y - pts[1].y;
        const h = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const cx = (pts[0].x + pts[2].x) / 2;
        const cy = (pts[0].y + pts[2].y) / 2;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        // Pill radius: half the shorter side → square becomes circle, rectangle becomes stadium
        const r = Math.min(w, h) / 2;

        rectEl.setAttribute('x', String(cx - w / 2));
        rectEl.setAttribute('y', String(cy - h / 2));
        rectEl.setAttribute('width', String(w));
        rectEl.setAttribute('height', String(h));
        rectEl.setAttribute('rx', String(r));
        rectEl.setAttribute('ry', String(r));
        if (Math.abs(angle) > 0.01) {
          rectEl.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy})`);
        } else {
          rectEl.removeAttribute('transform');
        }
      }

      updateRect();
      map.on('viewreset', updateRect);
      cleanups.push(() => map.off('viewreset', updateRect));

      // Count — stays as divIcon marker (renders in marker pane, not overlay SVG)
      const center = L.polygon(latlngs).getBounds().getCenter();
      const countIcon = L.divIcon({
        html: String(f.properties.members.length),
        className: 'combi-count',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      group.addLayer(L.marker(center, { icon: countIcon, interactive: false }));
    }

    return () => {
      cleanups.forEach((fn) => fn());
      rects.forEach((r) => r.remove());
      group.remove();
    };
  });
</script>
