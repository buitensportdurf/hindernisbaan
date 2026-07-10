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

    for (const f of features) {
      const isSelected = f.id === selectedId;

      const latlngs = f.geometry.coordinates[0].map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );

      const polygon = L.polygon(latlngs, {
        color: '#00a5e3',
        weight: isSelected ? tweaks.combiWeight : 2,
        dashArray: '6 4',
        lineCap: 'round',
        lineJoin: 'round',
        fillColor: '#00a5e3',
        fillOpacity: isSelected ? tweaks.combiFillOpacity : 0.08,
        className: 'combi-fence' + (isSelected ? ' selected' : '')
      });

      polygon.bindTooltip(f.properties.name, {
        direction: 'top',
        opacity: 1
      });

      polygon.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(polygon);

      const center = polygon.getBounds().getCenter();
      const countIcon = L.divIcon({
        html: `<div class="combi-count">${f.properties.members.length}</div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      const countMarker = L.marker(center, { icon: countIcon, interactive: false });
      group.addLayer(countMarker);
    }

    return () => group.remove();
  });
</script>
