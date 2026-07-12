<script lang="ts">
  import { mount, unmount } from 'svelte';
  import L from 'leaflet';
  import type { LandmarkFeature } from '$lib/data/types';
  import LandmarkPill from './LandmarkPill.svelte';
  import { useMapLayer } from './useMapLayer.svelte';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: LandmarkFeature[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } = $props();

  useMapLayer((group) => {
    const components: ReturnType<typeof mount>[] = [];

    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      const container = document.createElement('div');
      components.push(mount(LandmarkPill, {
        target: container,
        props: { icon: f.properties.icon, name: f.properties.name }
      }));

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: container,
          className: 'landmark-marker' + (f.id === selectedId ? ' selected' : ''),
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        }),
        riseOnHover: true
      });
      (marker as L.Layer & { feature?: LandmarkFeature }).feature = f;
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(marker);
    }

    return () => components.forEach((c) => unmount(c));
  });
</script>
