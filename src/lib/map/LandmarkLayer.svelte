<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import { mount, unmount } from 'svelte';
  import L from 'leaflet';
  import type { LandmarkFeature } from '$lib/data/types';
  import type { InteractionController } from '$lib/interaction/controller.svelte';
  import LandmarkPill from './LandmarkPill.svelte';
  import { useMapLayer } from './useMapLayer.svelte';
  import { bindFeatureInteraction } from './featureGestures';

  let {
    features,
    interaction
  }: {
    features: LandmarkFeature[];
    interaction: InteractionController;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  // Coordinates + icon only — renaming an obstacle must not remount every landmark.
  const geometryKey = $derived(
    features
      .map(
        (f) =>
          `${f.id}:${f.properties.icon}:${JSON.stringify(f.geometry.coordinates)}`
      )
      .join('\n')
  );

  $effect(() => {
    const names = features.map((f) => [f.id, f.properties.name] as const);
    const map = getMap();
    if (!map) return;
    untrack(() => {
      map.eachLayer((layer) => {
        const feature = (layer as L.Layer & { feature?: LandmarkFeature }).feature;
        if (!feature || feature.properties.kind !== 'landmark') return;
        const name = names.find(([id]) => id === feature.id)?.[1];
        if (name === undefined) return;
        feature.properties.name = name;
        const el = (layer as L.Marker).getElement?.();
        const span = el?.querySelector('.landmark-pill span');
        if (span && span.textContent !== name) span.textContent = name;
      });
    });
  });

  useMapLayer((group) => {
    const components: ReturnType<typeof mount>[] = [];

    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      const container = document.createElement('div');
      components.push(
        mount(LandmarkPill, {
          target: container,
          props: { icon: f.properties.icon, name: f.properties.name }
        })
      );

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
      bindFeatureInteraction(marker, f.id, interaction);
      group.addLayer(marker);
    }

    return () => components.forEach((c) => unmount(c));
  }, () => geometryKey);
</script>
