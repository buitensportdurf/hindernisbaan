<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import '@geoman-io/leaflet-geoman-free';
  import type { MapFeature } from '$lib/data/types';
  import type { InteractionController } from '$lib/interaction/controller.svelte';
  import { syncMapFeatureSelection } from '$lib/map/mapUtils';
  import type { DrawTool } from './drawTool';
  import { GEOMETRY_COMMIT_EVENTS, selectedEditConfig, type SelectedEditConfig } from './selectedEditConfig';
  import { t, type Locale } from '$lib/i18n';

  let {
    interaction,
    onCreate,
    onEdit,
    onRemove,
    locale
  }: {
    interaction: InteractionController;
    onCreate: (shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) => void;
    onEdit: (feature: MapFeature, layer: L.Layer) => void;
    onRemove: (feature: MapFeature) => void;
    locale: Locale;
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

  type PmLayer = {
    setOptions?: (o: object) => void;
    disable: () => void;
    enable?: () => void;
    enableLayerDrag?: () => void;
    disableLayerDrag?: () => void;
    enableRotate?: () => void;
    disableRotate?: () => void;
    enabled?: () => boolean;
    layerDragEnabled?: () => boolean;
    rotateEnabled?: () => boolean;
    /** Geoman internal — repositions vertex handles after geometry changes it doesn't track. */
    _initMarkers?: () => void;
  };

  function isDraggableFeature(feature: MapFeature): boolean {
    return (
      feature.properties.kind === 'obstacle' ||
      feature.properties.kind === 'combi' ||
      feature.properties.kind === 'landmark'
    );
  }

  let pendingMap: L.Map | null = null;
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
      interaction.gestureStart();
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
      interaction.gestureEnd();
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

  function disableLayerEditing(pm: PmLayer) {
    if (pm.layerDragEnabled?.()) pm.disableLayerDrag?.();
    if (pm.rotateEnabled?.()) pm.disableRotate?.();
    if (pm.enabled?.()) pm.disable();
  }

  function applySelectedEdit(map: L.Map, layer: L.Layer, feature: MapFeature, pm: PmLayer, config: SelectedEditConfig) {
    pm.setOptions?.({
      draggable: config.enableDrag,
      allowEditing: config.allowEditing,
      allowRotation: config.allowRotation,
      ...(config.hideMiddleMarkers ? { hideMiddleMarkers: true } : {}),
      ...(config.preventMarkerRemoval ? { preventMarkerRemoval: true } : {}),
      ...(config.removeVertexOn ? { removeVertexOn: config.removeVertexOn } : {})
    });

    if (config.combiRotate) {
      if (pm.rotateEnabled?.()) pm.disableRotate?.();
      // enableLayerDrag() calls disable() — must run before enable() or vertex handles vanish
      if (!pm.layerDragEnabled?.()) pm.enableLayerDrag?.();
      if (config.enableVertexEdit && !pm.enabled?.()) pm.enable?.();
      syncCombiRotateHandle(map, layer as L.Rectangle, feature.id, true);
      return;
    }

    if (config.enableVertexEdit) {
      pm.disableRotate?.();
      // enableLayerDrag() calls disable() — must run before enable() or vertex handles vanish
      if (!pm.layerDragEnabled?.()) pm.enableLayerDrag?.();
      if (!pm.enabled?.()) pm.enable?.();
      return;
    }

    // Point obstacle / landmark: drag only
    if (pm.enabled?.()) pm.disable();
    pm.disableRotate?.();
    if (!pm.layerDragEnabled?.()) pm.enableLayerDrag?.();
  }

  function applyEditState(map: L.Map, activeTool: DrawTool, activeSelectedId: string | null) {
    map.eachLayer((layer) => {
      const feature = (layer as L.Layer & { feature?: MapFeature }).feature;
      const pm = (layer as L.Layer & { pm?: PmLayer }).pm;
      const pmIgnore = (layer as L.Layer & { options?: { pmIgnore?: boolean } }).options?.pmIgnore;
      if (!pm || !feature || pmIgnore) return;

      if (activeTool !== null || !isDraggableFeature(feature)) {
        if (feature.properties.kind === 'combi') removeCombiRotateHandle(map, feature.id);
        disableLayerEditing(pm);
        return;
      }

      const selected = feature.id === activeSelectedId;
      if (!selected) {
        if (feature.properties.kind === 'combi') removeCombiRotateHandle(map, feature.id);
        disableLayerEditing(pm);
        return;
      }

      const config = selectedEditConfig(feature);
      if (!config) {
        disableLayerEditing(pm);
        return;
      }
      applySelectedEdit(map, layer, feature, pm, config);
    });

    for (const id of [...combiRotateHandles.keys()]) {
      if (id !== activeSelectedId) removeCombiRotateHandle(map, id);
    }

    if (activeTool === null && !map.dragging.enabled()) {
      map.dragging.enable();
    }
    syncMapFeatureSelection(map, activeSelectedId);
    queueMicrotask(() => hintVertices(map, locale));
  }

  /** Middle markers grow into a plus on hover (CSS). Real vertices explain click-to-remove. */
  function hintVertices(map: L.Map, activeLocale: Locale) {
    const removeHint = t(activeLocale, 'design.vertex.remove');
    map.eachLayer((layer) => {
      if (!(layer instanceof L.Marker)) return;
      const el = layer.getElement();
      if (!el?.classList.contains('marker-icon') || el.classList.contains('marker-icon-middle')) return;
      if (layer.getTooltip()?.getContent() === removeHint) return;
      layer.unbindTooltip();
      layer.bindTooltip(removeHint, {
        direction: 'top',
        offset: [0, -12],
        opacity: 1,
        className: 'vertex-hint'
      });
    });
  }

  function scheduleSync(map: L.Map) {
    pendingMap = map;
    if (syncScheduled) return;
    syncScheduled = true;
    queueMicrotask(() => {
      syncScheduled = false;
      const pending = pendingMap;
      pendingMap = null;
      if (pending) applyEditState(pending, interaction.tool, interaction.selectedId);
    });
  }

  // Draw tool: enable/disable draw & removal modes. Does not touch global edit mode.
  $effect(() => {
    const map = getMap();
    const tool = interaction.tool;
    if (!map) return;

    function handleCreate(e: { shape: string; layer: L.Layer }) {
      onCreate(e.shape as 'Marker' | 'Line' | 'Polygon' | 'Rectangle', e.layer);
      map!.pm.disableDraw();
    }

    map.on('pm:create', handleCreate);
    map.pm.disableDraw();
    map.pm.disableGlobalRemovalMode();

    if (tool === 'remove') {
      map.pm.enableGlobalRemovalMode();
    } else if (tool) {
      map.pm.enableDraw(SHAPE_BY_TOOL[tool]);
    }

    return () => {
      map.off('pm:create', handleCreate);
      map.pm.disableDraw();
      map.pm.disableGlobalRemovalMode();
    };
  });

  // One-time listeners for the map instance — read tool/selectedId at event time.
  $effect(() => {
    const map = getMap();
    if (!map) return;

    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalRotateMode();

    function handleEdit(e: { layer?: L.Layer; target?: L.Layer }) {
      const layer = e.layer ?? e.target;
      const feature = (layer as (L.Layer & { feature?: MapFeature }) | undefined)?.feature;
      if (feature && layer) {
        interaction.gestureEnd();
        onEdit(feature, layer);
        // Defer until after Svelte rebuilds feature layers (useMapLayer $effect).
        scheduleSync(map!);
      }
    }
    function handleRemove(e: { layer?: L.Layer; target?: L.Layer }) {
      if (interaction.tool !== 'remove') return;
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
      for (const event of GEOMETRY_COMMIT_EVENTS) {
        layer.on(event, handleEdit as L.LeafletEventHandlerFn);
      }
      layer.on('pm:remove', handleRemove as L.LeafletEventHandlerFn);
    }
    function detachLayerHandlers(layer: L.Layer) {
      layer.off('pm:drag', handleLayerDrag as L.LeafletEventHandlerFn);
      for (const event of GEOMETRY_COMMIT_EVENTS) {
        layer.off(event, handleEdit as L.LeafletEventHandlerFn);
      }
      layer.off('pm:remove', handleRemove as L.LeafletEventHandlerFn);
    }
    function handleLayerAdd(e: L.LayerEvent) {
      const layer = e.layer;
      if (!(layer as L.Layer & { feature?: MapFeature }).feature) return;
      attachLayerHandlers(layer);
      scheduleSync(map!);
    }
    function handleLayerRemove(e: L.LayerEvent) {
      const feature = (e.layer as L.Layer & { feature?: MapFeature }).feature;
      if (feature?.properties.kind === 'combi') removeCombiRotateHandle(map!, feature.id);
    }

    map.eachLayer(attachLayerHandlers);
    map.on('layeradd', handleLayerAdd);
    map.on('layerremove', handleLayerRemove);

    return () => {
      map.off('layeradd', handleLayerAdd);
      map.off('layerremove', handleLayerRemove);
      map.eachLayer(detachLayerHandlers);
    };
  });

  // Edit-state: selection + tool drive which layers are draggable/editable.
  $effect(() => {
    const map = getMap();
    const tool = interaction.tool;
    const selectedId = interaction.selectedId;
    if (!map) return;
    applyEditState(map, tool, selectedId);
  });
</script>
