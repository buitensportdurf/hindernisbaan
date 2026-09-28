<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import L from 'leaflet';
  import type { ObstacleFeature } from '$lib/data/types';
  import type { InteractionController } from '$lib/interaction/controller.svelte';
  import { useMapLayer } from './useMapLayer.svelte';
  import { FILLED_PATH_STYLE, OBSTACLE_LABEL_ZOOM, setLayerInvalid, syncFilledPathTooltip } from './mapUtils';
  import { bindFeatureInteraction } from './featureGestures';

  let {
    features,
    interaction,
    labelsEnabled = true,
    faults
  }: {
    features: ObstacleFeature[];
    interaction: InteractionController;
    labelsEnabled?: boolean;
    /** Translated fault text per feature id; faulty features get the invalid outline. */
    faults?: Map<string, string>;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');
  // Geometry only — typing a name must not tear the layer down and redraw it.
  const geometryKey = $derived(
    features
      .map((f) => `${f.id}:${f.geometry.type}:${JSON.stringify(f.geometry.coordinates)}`)
      .join('\n')
  );

  $effect(() => {
    const names = features.map((f) => [f.id, f.properties.name] as const);
    const zoom = labelsEnabled ? OBSTACLE_LABEL_ZOOM : undefined;
    const currentFaults = faults;
    const map = getMap();
    if (!map) return;
    untrack(() => {
      map.eachLayer((layer) => {
        const feature = (layer as L.Layer & { feature?: ObstacleFeature; options?: { pmIgnore?: boolean } }).feature;
        if (!feature) return;
        const name = names.find(([id]) => id === feature.id)?.[1];
        if (name === undefined) return;
        const fault = currentFaults?.get(feature.id);
        setLayerInvalid(layer, !!fault);
        const pmIgnore = (layer as L.Layer & { options?: { pmIgnore?: boolean } }).options?.pmIgnore;
        if (pmIgnore) return;
        syncFilledPathTooltip(layer, name, zoom, 0, fault);
      });
    });
  });

  useMapLayer((group) => {
    function attach(layer: L.Layer, f: ObstacleFeature) {
      (layer as L.Layer & { feature?: ObstacleFeature }).feature = f;
      bindFeatureInteraction(layer, f.id, interaction);
      group.addLayer(layer);
      const fault = faults?.get(f.id);
      setLayerInvalid(layer, !!fault);
      syncFilledPathTooltip(layer, f.properties.name, labelsEnabled ? OBSTACLE_LABEL_ZOOM : undefined, 0, fault);
    }

    for (const f of features) {
      const { geometry } = f;

      if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates;
        attach(
          L.circleMarker([lat, lng], {
            ...FILLED_PATH_STYLE,
            radius: 5,
            className: 'obstacle-dot'
          }),
          f
        );
      } else if (geometry.type === 'LineString') {
        const latlngs = geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
        const innerW = 5;
        const outerLine = L.polyline(latlngs, {
          weight: innerW + 8, color: '#00a5e3', interactive: false,
          lineCap: 'round', lineJoin: 'round',
          className: 'obstacle-line',
          pmIgnore: true
        });
        const innerLine = L.polyline(latlngs, {
          weight: innerW, color: '#ffffff', interactive: false,
          lineCap: 'round', lineJoin: 'round',
          className: 'obstacle-line-inner',
          pmIgnore: true
        });
        const hitLine = L.polyline(latlngs, { weight: 20, opacity: 0, fillOpacity: 0 });

        const syncLineVisuals = () => {
          const ll = hitLine.getLatLngs() as L.LatLng[] | L.LatLng[][];
          outerLine.setLatLngs(ll);
          innerLine.setLatLngs(ll);
        };
        hitLine.on('pm:drag', syncLineVisuals);
        hitLine.on('pm:dragend', syncLineVisuals);
        hitLine.on('pm:markerdrag', syncLineVisuals);
        hitLine.on('pm:markerdragend', syncLineVisuals);
        hitLine.on('pm:vertexadded', syncLineVisuals);
        hitLine.on('pm:vertexremoved', syncLineVisuals);

        (outerLine as L.Layer & { feature?: ObstacleFeature }).feature = f;
        (innerLine as L.Layer & { feature?: ObstacleFeature }).feature = f;
        group.addLayer(outerLine);
        group.addLayer(innerLine);
        setLayerInvalid(outerLine, faults?.has(f.id) ?? false);
        attach(hitLine, f);
      } else if (geometry.type === 'Polygon') {
        const latlngs = geometry.coordinates.map((ring) =>
          ring.map(([lng, lat]) => [lat, lng] as [number, number])
        );
        attach(
          L.polygon(latlngs, {
            ...FILLED_PATH_STYLE,
            className: 'obstacle-poly'
          }),
          f
        );
      }
    }
  }, () => geometryKey);
</script>
