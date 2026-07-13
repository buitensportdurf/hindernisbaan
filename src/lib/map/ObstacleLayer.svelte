<script lang="ts">
  import L from 'leaflet';
  import type { ObstacleFeature } from '$lib/data/types';
  import { useMapLayer } from './useMapLayer.svelte';
  import { ENTITY_STYLE, addSvgTitle } from './mapUtils';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: ObstacleFeature[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } = $props();

  useMapLayer((group) => {
    function attach(layer: L.Layer, f: ObstacleFeature) {
      (layer as L.Layer & { feature?: ObstacleFeature }).feature = f;
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(layer);
      addSvgTitle(layer, f.properties.name);
    }

    for (const f of features) {
      const sel = f.id === selectedId;
      const { geometry } = f;

      if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates;
        attach(
          L.circleMarker([lat, lng], {
            ...ENTITY_STYLE,
            radius: 5,
            className: 'obstacle-dot' + (sel ? ' selected' : '')
          }),
          f
        );
      } else if (geometry.type === 'LineString') {
        const latlngs = geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
        const innerW = 5;
        group.addLayer(L.polyline(latlngs, {
          weight: innerW + 8, color: '#00a5e3', interactive: false,
          lineCap: 'round', lineJoin: 'round',
          className: 'obstacle-line' + (sel ? ' selected' : ''),
          pmIgnore: true
        }));
        group.addLayer(L.polyline(latlngs, {
          weight: innerW, color: '#ffffff', interactive: false,
          lineCap: 'round', lineJoin: 'round',
          pmIgnore: true
        }));
        attach(
          L.polyline(latlngs, { weight: 20, opacity: 0, fillOpacity: 0 }),
          f
        );
      } else if (geometry.type === 'Polygon') {
        const latlngs = geometry.coordinates.map((ring) =>
          ring.map(([lng, lat]) => [lat, lng] as [number, number])
        );
        attach(
          L.polygon(latlngs, {
            ...ENTITY_STYLE,
            className: 'obstacle-poly' + (sel ? ' selected' : '')
          }),
          f
        );
      }
    }
  });
</script>
