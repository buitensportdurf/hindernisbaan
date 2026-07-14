<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import type { ObstacleFeature } from '$lib/data/types';
  import { useMapLayer } from './useMapLayer.svelte';
  import { FILLED_PATH_STYLE, bindFilledPathTooltip, attachFeatureGestures, syncMapFeatureSelection } from './mapUtils';

  let {
    features,
    selectedId,
    onSelect,
    onOpenDetails,
    gesturesEnabled
  }: {
    features: ObstacleFeature[];
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
    // #region agent log
    fetch('http://127.0.0.1:7685/ingest/7b7b46c0-0cc3-475a-b808-df9dc5c6f93b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'88bc55'},body:JSON.stringify({sessionId:'88bc55',runId:'post-fix',hypothesisId:'A',location:'ObstacleLayer.svelte:setup',message:'ObstacleLayer rebuild',data:{featureCount:features.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    function attach(layer: L.Layer, f: ObstacleFeature) {
      (layer as L.Layer & { feature?: ObstacleFeature }).feature = f;
      attachFeatureGestures(layer, f.id, {
        onSelect,
        onOpenDetails,
        enabled: gesturesEnabled
      });
      group.addLayer(layer);
      bindFilledPathTooltip(layer, f.properties.name);
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

        (outerLine as L.Layer & { feature?: ObstacleFeature }).feature = f;
        (innerLine as L.Layer & { feature?: ObstacleFeature }).feature = f;
        group.addLayer(outerLine);
        group.addLayer(innerLine);
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
  });
</script>
