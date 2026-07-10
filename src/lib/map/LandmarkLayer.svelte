<script lang="ts">
  import { getContext } from 'svelte';
  import { mount, unmount } from 'svelte';
  import L from 'leaflet';
  import type { LandmarkFeature } from '$lib/data/types';
  import LandmarkPill from './LandmarkPill.svelte';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: LandmarkFeature[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  $effect(() => {
    const map = getMap();
    if (!map) return;

    const group = L.layerGroup().addTo(map);
    const components: ReturnType<typeof mount>[] = [];

    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      const isSelected = f.id === selectedId;

      const container = document.createElement('div');
      const comp = mount(LandmarkPill, {
        target: container,
        props: { icon: f.properties.icon, name: f.properties.name }
      });
      components.push(comp);

      const divIcon = L.divIcon({
        html: container,
        className: 'landmark-marker' + (isSelected ? ' selected' : ''),
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const marker = L.marker([lat, lng], { icon: divIcon, riseOnHover: true });
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      if (f.properties.notes) {
        marker.bindTooltip(f.properties.notes, { direction: 'top', offset: [0, -32], opacity: 1 });
      }
      group.addLayer(marker);
    }

    return () => {
      components.forEach((c) => unmount(c));
      group.remove();
    };
  });
</script>
