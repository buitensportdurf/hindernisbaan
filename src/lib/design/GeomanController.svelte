<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import '@geoman-io/leaflet-geoman-free';
  import type { MapFeature } from '$lib/data/types';
  import { notifyMapGestureEnd, notifyMapGestureStart, syncMapFeatureSelection } from '$lib/map/mapUtils';
  import type { DrawTool } from './drawTool';

  let {
    tool,
    selectedId = null,
    onCreate,
    onEdit,
    onRemove
  }: {
    tool: DrawTool;
    selectedId?: string | null;
    onCreate: (shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) => void;
    onEdit: (feature: MapFeature, layer: L.Layer) => void;
    onRemove: (feature: MapFeature) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  if (!getMap) {
    throw new Error('GeomanController must be rendered inside MapCanvas (missing map context)');
  }

  const SHAPE_BY_TOOL = {
    point: 'Marker',
    landmark: 'Marker',
    line: 'Line',
    polygon: 'Polygon',
    rectangle: 'Rectangle'
  } as const;

  function isDraggableFeature(feature: MapFeature): boolean {
    return (
      feature.properties.kind === 'obstacle' ||
      feature.properties.kind === 'combi' ||
      feature.properties.kind === 'landmark'
    );
  }

  type PmLayer = {
    setOptions?: (o: object) => void;
    disable: () => void;
    enable?: () => void;
    enableLayerDrag?: () => void;
    disableLayerDrag?: () => void;
    enableRotate?: () => void;
    disableRotate?: () => void;
    enabled?: () => boolean;
    /** Geoman internal — repositions vertex handles after geometry changes it doesn't track. */
    _initMarkers?: () => void;
  };

  let pendingSync: { map: L.Map; tool: DrawTool; selectedId: string | null } | null = null;
  let syncScheduled = false;
  const combiRotateHandles = new Map<string, L.Marker>();

  function combiRotationHandleLatLng(map: L.Map, layer: L.Rectangle, pm: { getRotationCenter?: () => L.LatLng }): L.LatLng {
    const center = pm.getRotationCenter?.() ?? layer.getBounds().getCenter();
    const ring = (layer.getLatLngs()[0] as L.LatLng[]).slice(0, 4);
    const centerPt = map.latLngToLayerPoint(center);
    const edgeMid =
      ring.length >= 2
        ? map.latLngToLayerPoint(
            L.latLng((ring[0].lat + ring[1].lat) / 2, (ring[0].lng + ring[1].lng) / 2)
          )
        : L.point(centerPt.x, centerPt.y - 40);
    const dx = edgeMid.x - centerPt.x;
    const dy = edgeMid.y - centerPt.y;
    const len = Math.hypot(dx, dy) || 1;
    const orbitPx = 36;
    const scale = (len + orbitPx) / len;
    return map.layerPointToLatLng(L.point(centerPt.x + dx * scale, centerPt.y + dy * scale));
  }

  function screenAngleRad(map: L.Map, origin: L.LatLng, point: L.LatLng): number {
    const o = map.latLngToLayerPoint(origin);
    const p = map.latLngToLayerPoint(point);
    return Math.atan2(p.y - o.y, p.x - o.x);
  }

  function normalizeAngleRad(delta: number): number {
    if (delta > Math.PI) return delta - 2 * Math.PI;
    if (delta < -Math.PI) return delta + 2 * Math.PI;
    return delta;
  }

  function syncPmEditHandles(layer: L.Layer) {
    const pm = (layer as L.Layer & { pm?: PmLayer }).pm;
    if (!pm?.enabled?.()) return;
    pm._initMarkers?.();
  }

  function removeCombiRotateHandle(map: L.Map, featureId: string) {
    const handle = combiRotateHandles.get(featureId);
    if (!handle) return;
    const cleanup = (handle as L.Marker & { _combiRotateCleanup?: () => void })._combiRotateCleanup;
    cleanup?.();
    map.removeLayer(handle);
    combiRotateHandles.delete(featureId);
  }

  function syncCombiRotateHandle(map: L.Map, layer: L.Rectangle, featureId: string, active: boolean) {
    removeCombiRotateHandle(map, featureId);
    if (!active) return;

    const pm = layer.pm as {
      getRotationCenter?: () => L.LatLng;
      rotateLayer?: (degrees: number) => void;
    };

    const handle = L.marker(combiRotationHandleLatLng(map, layer, pm), {
      icon: L.divIcon({ className: 'combi-rotate-handle marker-icon', iconSize: [14, 14] }),
      pmIgnore: true,
      draggable: true,
      zIndexOffset: 1000
    }).addTo(map);

    const center = () => pm.getRotationCenter?.() ?? layer.getBounds().getCenter();
    const snapToOrbit = () => handle.setLatLng(combiRotationHandleLatLng(map, layer, pm));

    let lastAngleRad: number | null = null;

    const onGeometryChange = () => {
      snapToOrbit();
      syncPmEditHandles(layer);
    };
    layer.on('pm:drag', onGeometryChange);
    layer.on('pm:dragend', onGeometryChange);
    layer.on('pm:markerdragend', onGeometryChange);

    handle.on('dragstart', () => {
      lastAngleRad = screenAngleRad(map, center(), handle.getLatLng());
      notifyMapGestureStart();
    });
    handle.on('drag', () => {
      if (lastAngleRad === null) return;
      const nextAngleRad = screenAngleRad(map, center(), handle.getLatLng());
      const deltaRad = normalizeAngleRad(nextAngleRad - lastAngleRad);
      if (Math.abs(deltaRad) < 0.001) return;
      pm.rotateLayer?.((deltaRad * 180) / Math.PI);
      syncPmEditHandles(layer);
      lastAngleRad = nextAngleRad;
    });
    handle.on('dragend', () => {
      notifyMapGestureEnd();
      lastAngleRad = null;
      snapToOrbit();
      syncPmEditHandles(layer);
      layer.fire('pm:rotateend', { layer, target: layer });
    });

    (handle as L.Marker & { _combiRotateCleanup?: () => void })._combiRotateCleanup = () => {
      layer.off('pm:drag', onGeometryChange);
      layer.off('pm:dragend', onGeometryChange);
      layer.off('pm:markerdragend', onGeometryChange);
    };

    combiRotateHandles.set(featureId, handle);
  }

  function syncSelectedLayerPm(map: L.Map, activeTool: DrawTool, activeSelectedId: string | null) {
    let pmLayerCount = 0;
    let selectedPmApplied = false;
    map.eachLayer((layer) => {
      const feature = (layer as L.Layer & { feature?: MapFeature }).feature;
      const pm = (layer as L.Layer & { pm?: PmLayer }).pm;
      const pmIgnore = (layer as L.Layer & { options?: { pmIgnore?: boolean } }).options?.pmIgnore;
      if (!pm || !feature || pmIgnore) return;
      pmLayerCount++;

      if (activeTool === null && isDraggableFeature(feature)) {
        const selected = feature.id === activeSelectedId;
        const kind = feature.properties.kind;
        const pmAny = pm as PmLayer & {
          enabled?: () => boolean;
          layerDragEnabled?: () => boolean;
          rotateEnabled?: () => boolean;
        };

        if (selected) {
          selectedPmApplied = true;
          if (kind === 'combi') {
            pm.setOptions?.({
              draggable: true,
              allowEditing: true,
              allowRotation: true,
              hideMiddleMarkers: true,
              preventMarkerRemoval: true
            });
            if (pmAny.rotateEnabled?.()) pm.disableRotate?.();
            // enableLayerDrag() calls disable() — must run before enable() or vertex handles vanish
            if (!pmAny.layerDragEnabled?.()) pm.enableLayerDrag?.();
            if (!pmAny.enabled?.()) pm.enable?.();
            syncCombiRotateHandle(map, layer as L.Rectangle, feature.id, true);
          } else if (kind === 'obstacle') {
            const isPoint = feature.geometry.type === 'Point';
            if (isPoint) {
              pm.setOptions?.({ draggable: true, allowEditing: false, allowRotation: false });
              if (pmAny.enabled?.()) pm.disable();
              pm.disableRotate?.();
              if (!pmAny.layerDragEnabled?.()) pm.enableLayerDrag?.();
            } else {
              pm.setOptions?.({ draggable: true, allowEditing: true, allowRotation: false });
              pm.disableRotate?.();
              if (!pmAny.layerDragEnabled?.()) pm.enableLayerDrag?.();
              if (!pmAny.enabled?.()) pm.enable?.();
            }
          } else if (kind === 'landmark') {
            pm.setOptions?.({ draggable: true, allowEditing: false, allowRotation: false });
            if (pmAny.enabled?.()) pm.disable();
            pm.disableRotate?.();
            if (!pmAny.layerDragEnabled?.()) pm.enableLayerDrag?.();
          }
        } else {
          if (kind === 'combi') removeCombiRotateHandle(map, feature.id);
          if (pmAny.layerDragEnabled?.()) pm.disableLayerDrag?.();
          if (pmAny.rotateEnabled?.()) pm.disableRotate?.();
          if (pmAny.enabled?.()) pm.disable();
        }
      } else {
        const pmAny = pm as PmLayer & { enabled?: () => boolean; layerDragEnabled?: () => boolean; rotateEnabled?: () => boolean };
        if (pmAny.layerDragEnabled?.()) pm.disableLayerDrag?.();
        if (pmAny.rotateEnabled?.()) pm.disableRotate?.();
        if (pmAny.enabled?.()) pm.disable();
      }
    });

    for (const id of [...combiRotateHandles.keys()]) {
      if (id !== activeSelectedId) removeCombiRotateHandle(map, id);
    }

    if (activeTool === null && !map.dragging.enabled()) {
      map.dragging.enable();
    }
    syncMapFeatureSelection(map, activeSelectedId);
  }

  function scheduleSync(map: L.Map, activeTool: DrawTool, activeSelectedId: string | null) {
    pendingSync = { map, tool: activeTool, selectedId: activeSelectedId };
    if (syncScheduled) return;
    syncScheduled = true;
    queueMicrotask(() => {
      syncScheduled = false;
      const pending = pendingSync;
      pendingSync = null;
      if (pending) syncSelectedLayerPm(pending.map, pending.tool, pending.selectedId);
    });
  }

  $effect(() => {
    const map = getMap();
    const activeTool = tool;
    const activeSelectedId = selectedId;
    if (!map) return;

    function handleCreate(e: { shape: string; layer: L.Layer }) {
      onCreate(e.shape as 'Marker' | 'Line' | 'Polygon' | 'Rectangle', e.layer);
      map!.pm.disableDraw();
    }
    function handleEdit(e: { layer?: L.Layer; target?: L.Layer }) {
      const layer = e.layer ?? e.target;
      const feature = (layer as (L.Layer & { feature?: MapFeature }) | undefined)?.feature;
      if (feature && layer) {
        notifyMapGestureEnd();
        onEdit(feature, layer);
        // Defer until after Svelte rebuilds feature layers (useMapLayer $effect).
        queueMicrotask(() => {
          queueMicrotask(() => scheduleSync(map!, activeTool, activeSelectedId));
        });
      }
    }
    function handleRemove(e: { layer?: L.Layer; target?: L.Layer }) {
      if (activeTool !== 'remove') return;
      const layer = e.layer ?? e.target;
      const feature = (layer as (L.Layer & { feature?: MapFeature }) | undefined)?.feature;
      if (feature) onRemove(feature);
    }

    function handleLayerDrag(e: { layer?: L.Layer; target?: L.Layer }) {
      const layer = e.layer ?? e.target;
      if (layer) syncPmEditHandles(layer);
    }
    function attachLayerHandlers(layer: L.Layer) {
      if (!(layer as L.Layer & { feature?: MapFeature }).feature) return;
      layer.on('pm:drag', handleLayerDrag as L.LeafletEventHandlerFn);
      layer.on('pm:dragend', handleEdit as L.LeafletEventHandlerFn);
      layer.on('pm:markerdragend', handleEdit as L.LeafletEventHandlerFn);
      layer.on('pm:rotateend', handleEdit as L.LeafletEventHandlerFn);
      layer.on('pm:remove', handleRemove as L.LeafletEventHandlerFn);
    }
    function detachLayerHandlers(layer: L.Layer) {
      layer.off('pm:drag', handleLayerDrag as L.LeafletEventHandlerFn);
      layer.off('pm:dragend', handleEdit as L.LeafletEventHandlerFn);
      layer.off('pm:markerdragend', handleEdit as L.LeafletEventHandlerFn);
      layer.off('pm:rotateend', handleEdit as L.LeafletEventHandlerFn);
      layer.off('pm:remove', handleRemove as L.LeafletEventHandlerFn);
    }
    function handleLayerAdd(e: L.LayerEvent) {
      const layer = e.layer;
      if (!(layer as L.Layer & { feature?: MapFeature }).feature) return;
      attachLayerHandlers(layer);
      scheduleSync(map!, activeTool, activeSelectedId);
    }
    function handleLayerRemove(e: L.LayerEvent) {
      const feature = (e.layer as L.Layer & { feature?: MapFeature }).feature;
      if (feature?.properties.kind === 'combi') removeCombiRotateHandle(map!, feature.id);
    }

    map.on('pm:create', handleCreate);
    map.eachLayer(attachLayerHandlers);
    map.on('layeradd', handleLayerAdd);
    map.on('layerremove', handleLayerRemove);

    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalRotateMode();
    map.pm.disableGlobalRemovalMode();

    if (activeTool === 'remove') {
      map.pm.enableGlobalRemovalMode();
    } else if (activeTool) {
      map.pm.enableDraw(SHAPE_BY_TOOL[activeTool]);
    }

    scheduleSync(map, activeTool, activeSelectedId);

    return () => {
      map.off('pm:create', handleCreate);
      map.off('layeradd', handleLayerAdd);
      map.off('layerremove', handleLayerRemove);
      map.eachLayer(detachLayerHandlers);
    };
  });
</script>
