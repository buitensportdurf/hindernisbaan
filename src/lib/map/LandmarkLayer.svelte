<script lang="ts">
  import { getContext } from 'svelte';
  import { mount, unmount } from 'svelte';
  import L from 'leaflet';
  import type { LandmarkFeature } from '$lib/data/types';
  import LandmarkPill from './LandmarkPill.svelte';
  import { useMapLayer } from './useMapLayer.svelte';
  import { attachFeatureGestures, syncMapFeatureSelection } from './mapUtils';

  let {
    features,
    selectedId,
    onSelect,
    onOpenDetails,
    gesturesEnabled
  }: {
    features: LandmarkFeature[];
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
          className: 'landmark-marker',
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        }),
        riseOnHover: true
      });
      (marker as L.Layer & { feature?: LandmarkFeature }).feature = f;
      attachFeatureGestures(marker, f.id, {
        onSelect,
        onOpenDetails,
        enabled: gesturesEnabled
      });
      group.addLayer(marker);
    }

    return () => components.forEach((c) => unmount(c));
  });
</script>
