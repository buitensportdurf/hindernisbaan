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
    function attach(layer: L.Layer, id: string, name: string) {
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(id); });
      group.addLayer(layer);
      addSvgTitle(layer, name);
    }

    for (const f of features) {
      const sel = f.id === selectedId;
      const { id, properties: { name }, geometry } = f;

      if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates;
        attach(
          L.circleMarker([lat, lng], {
            ...ENTITY_STYLE,
            radius: 5,
            className: 'obstacle-dot' + (sel ? ' selected' : '')
          }),
          id, name
        );
      } else if (geometry.type === 'LineString') {
        const latlngs = geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
        const innerW = 5;
        group.addLayer(L.polyline(latlngs, {
          weight: innerW + 8, color: '#00a5e3', interactive: false,
          lineCap: 'round', lineJoin: 'round',
          className: 'obstacle-line' + (sel ? ' selected' : '')
        }));
        group.addLayer(L.polyline(latlngs, {
          weight: innerW, color: '#ffffff', interactive: false,
          lineCap: 'round', lineJoin: 'round'
        }));
        attach(
          L.polyline(latlngs, { weight: 20, opacity: 0, fillOpacity: 0 }),
          id, name
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
          id, name
        );
      }
    }
  });
</script>
