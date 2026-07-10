<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import type { ObstacleFeature } from '$lib/data/types';
  import { tweaks } from '$lib/state/tweaks.svelte';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: ObstacleFeature[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  $effect(() => {
    const map = getMap();
    if (!map) return;

    const group = L.layerGroup().addTo(map);

    for (const f of features) {
      const isSelected = f.id === selectedId;
      const g = f.geometry;

      if (g.type === 'Point') {
        // weight is doubled: paint-order:stroke fill makes only outer half visible → 5px outside border
        const marker = L.circleMarker([g.coordinates[1], g.coordinates[0]], {
          radius: isSelected ? tweaks.obsRadius : 5,
          color: '#00a5e3',
          weight: isSelected ? tweaks.obsWeight * 2 : 10,
          fillColor: '#ffffff',
          fillOpacity: 1,
          className: 'obstacle-dot' + (isSelected ? ' selected' : '')
        });
        marker.bindTooltip(f.properties.name, { direction: 'top', offset: [0, -8], opacity: 1 });
        marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
        group.addLayer(marker);

      } else if (g.type === 'LineString') {
        const coords = g.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
        const strokeW = isSelected ? tweaks.lineWeight : 5;

        // Outer colored border + inner white fill = road-style rendering
        group.addLayer(L.polyline(coords, {
          color: '#00a5e3',
          weight: strokeW + 2,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
          className: 'obstacle-line' + (isSelected ? ' selected' : '')
        }));
        group.addLayer(L.polyline(coords, {
          color: '#ffffff',
          weight: strokeW,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }));

        // Transparent wide hit area — ±10px tolerance around line
        const hit = L.polyline(coords, { weight: 20, opacity: 0, fillOpacity: 0 });
        hit.bindTooltip(f.properties.name, { direction: 'top', offset: [0, -8], opacity: 1 });
        hit.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
        group.addLayer(hit);

      } else {
        // Polygon — fill area is already a natural hit target
        // weight doubled for same paint-order trick as dots
        const poly = L.polygon(
          g.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]),
          {
            color: '#00a5e3',
            weight: isSelected ? tweaks.polyWeight * 2 : 10,
            fillColor: '#ffffff',
            fillOpacity: 1,
            className: 'obstacle-poly' + (isSelected ? ' selected' : '')
          }
        );
        poly.bindTooltip(f.properties.name, { direction: 'top', offset: [0, -8], opacity: 1 });
        poly.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
        group.addLayer(poly);
      }
    }

    return () => group.remove();
  });
</script>
