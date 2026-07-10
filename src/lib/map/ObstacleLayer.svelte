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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let layer: L.CircleMarker | L.Polyline<any> | L.Polygon;

      if (g.type === 'Point') {
        layer = L.circleMarker([g.coordinates[1], g.coordinates[0]], {
          radius: isSelected ? tweaks.obsRadius : 8,
          color: '#ffffff',
          weight: isSelected ? tweaks.obsWeight : 2,
          fillColor: '#00a5e3',
          fillOpacity: 1,
          className: 'obstacle-dot' + (isSelected ? ' selected' : '')
        });
      } else if (g.type === 'LineString') {
        layer = L.polyline(
          g.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
          {
            color: '#00a5e3',
            weight: isSelected ? tweaks.lineWeight : 3,
            lineCap: 'round',
            lineJoin: 'round',
            className: 'obstacle-line' + (isSelected ? ' selected' : '')
          }
        );
      } else {
        layer = L.polygon(
          g.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]),
          {
            color: '#00a5e3',
            weight: isSelected ? tweaks.polyWeight : 2,
            fillColor: '#00a5e3',
            fillOpacity: isSelected ? tweaks.polyFillOpacity : 0.1,
            className: 'obstacle-poly' + (isSelected ? ' selected' : '')
          }
        );
      }

      layer.bindTooltip(f.properties.name, { direction: 'top', offset: [0, -8], opacity: 1 });
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(layer);
    }

    return () => group.remove();
  });
</script>
