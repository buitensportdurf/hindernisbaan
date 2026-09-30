<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import L from 'leaflet';
  import type { CombiFeature } from '$lib/data/types';
  import type { InteractionController } from '$lib/interaction/controller.svelte';
  import { useMapLayer } from './useMapLayer.svelte';
  import {
    FILLED_PATH_STYLE,
    COMBI_LABEL_ZOOM,
    roundPolygonCorners,
    setLayerInvalid,
    syncFilledPathTooltip
  } from './mapUtils';
  import { bindFeatureInteraction } from './featureGestures';

  let {
    features,
    interaction,
    labelsEnabled = true,
    faults
  }: {
    features: CombiFeature[];
    interaction: InteractionController;
    labelsEnabled?: boolean;
    /** Translated fault text per feature id; faulty features get the invalid outline. */
    faults?: Map<string, string>;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  // Selection only toggles a CSS class — must not tear down / rebuild layers.
  $effect(() => {
    const map = getMap();
    const id = interaction.selectedId;
    if (!map) return;
    queueMicrotask(() => {
      map.eachLayer((layer) => {
        if (!(layer instanceof L.Marker)) return;
        const feature = (layer as L.Layer & { feature?: CombiFeature }).feature;
        if (!feature) return;
        const el = layer.getElement();
        el?.classList.toggle('combi-count--selection-hidden', id !== null && id !== feature.id);
      });
    });
  });

  // Min screen-space edge length (px) below which the count hides.
  // Lower = count survives further zoom-out; one Leaflet zoom step halves the on-screen size.
  const COUNT_FIT_THRESHOLD = 16;

  const geometryKey = $derived(
    features
      .map(
        (f) =>
          `${f.id}:${JSON.stringify(f.geometry.coordinates)}:${f.properties.members.length}`
      )
      .join('\n')
  );

  $effect(() => {
    const names = features.map((f) => [f.id, f.properties.name] as const);
    const zoom = labelsEnabled ? COMBI_LABEL_ZOOM : undefined;
    const currentFaults = faults;
    const map = getMap();
    if (!map) return;
    untrack(() => {
      map.eachLayer((layer) => {
        const feature = (layer as L.Layer & { feature?: CombiFeature }).feature;
        const pmIgnore = (layer as L.Layer & { options?: { pmIgnore?: boolean } }).options?.pmIgnore;
        if (!feature || pmIgnore || !(layer instanceof L.Rectangle)) return;
        const name = names.find(([id]) => id === feature.id)?.[1];
        if (name === undefined) return;
        const fault = currentFaults?.get(feature.id);
        setLayerInvalid(layer, !!fault);
        syncFilledPathTooltip(layer, name, zoom, 1, fault);
      });
    });
  });

  useMapLayer((group) => {
    for (const f of features) {
      const latlngs = f.geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number])
      );

      // L.rectangle → Geoman PM.Edit.Rectangle (4 corners, no freeform vertices).
      const bounds = L.latLngBounds(latlngs[0]);
      const rectangle = L.rectangle(bounds, {
        ...FILLED_PATH_STYLE,
        className: 'combi-zone'
      });
      rectangle.setLatLngs(latlngs);

      const count = f.properties.members.length;
      const countMarker = count > 0
        ? L.marker(rectangle.getBounds().getCenter(), {
            icon: L.divIcon({
              html: String(count),
              className: 'combi-count',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            }),
            interactive: false,
            pmIgnore: true
          })
        : null;
      if (countMarker) (countMarker as L.Layer & { feature?: CombiFeature }).feature = f;

      let lastMinEdge = Infinity;
      const syncCountVisibility = () => {
        countMarker?.getElement()?.classList.toggle('combi-count--hidden', lastMinEdge < COUNT_FIT_THRESHOLD);
      };

      roundPolygonCorners(rectangle, (minEdge) => {
        lastMinEdge = minEdge;
        syncCountVisibility();
        const center = rectangle.getBounds().getCenter();
        if (countMarker && !countMarker.getLatLng().equals(center)) countMarker.setLatLng(center);
      });

      (rectangle as L.Layer & { feature?: CombiFeature }).feature = f;
      bindFeatureInteraction(rectangle, f.id, interaction);
      group.addLayer(rectangle);
      const fault = faults?.get(f.id);
      setLayerInvalid(rectangle, !!fault);
      syncFilledPathTooltip(rectangle, f.properties.name, labelsEnabled ? COMBI_LABEL_ZOOM : undefined, 1, fault);

      if (countMarker) {
        group.addLayer(countMarker);
        // _updatePath may have fired before the marker element existed.
        syncCountVisibility();
      }
    }
  }, () => geometryKey);
</script>
