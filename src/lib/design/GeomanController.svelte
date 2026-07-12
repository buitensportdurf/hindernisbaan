<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import '@geoman-io/leaflet-geoman-free';
  import type { HindernisFeature } from '$lib/data/types';
  import type { DrawTool } from './drawTool';

  let {
    tool,
    onCreate,
    onEdit,
    onRemove
  }: {
    tool: DrawTool;
    onCreate: (shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) => void;
    onEdit: (feature: HindernisFeature, layer: L.Layer) => void;
    onRemove: (feature: HindernisFeature) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  const SHAPE_BY_TOOL = {
    point: 'Marker',
    line: 'Line',
    polygon: 'Polygon',
    rectangle: 'Rectangle'
  } as const;

  $effect(() => {
    const map = getMap();
    if (!map) return;

    function handleCreate(e: { shape: string; layer: L.Layer }) {
      onCreate(e.shape as 'Marker' | 'Line' | 'Polygon' | 'Rectangle', e.layer);
      map!.pm.disableDraw();
    }
    function handleEdit(e: { layer: L.Layer }) {
      const feature = (e.layer as L.Layer & { feature?: HindernisFeature }).feature;
      if (feature) onEdit(feature, e.layer);
    }
    function handleRemove(e: { layer: L.Layer }) {
      const feature = (e.layer as L.Layer & { feature?: HindernisFeature }).feature;
      if (feature) onRemove(feature);
    }

    map.on('pm:create', handleCreate);
    map.on('pm:edit', handleEdit);
    map.on('pm:remove', handleRemove);

    return () => {
      map.off('pm:create', handleCreate);
      map.off('pm:edit', handleEdit);
      map.off('pm:remove', handleRemove);
    };
  });

  $effect(() => {
    const map = getMap();
    if (!map) return;

    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalRemovalMode();

    if (tool === 'edit') {
      map.pm.enableGlobalEditMode();
    } else if (tool === 'remove') {
      map.pm.enableGlobalRemovalMode();
    } else if (tool) {
      map.pm.enableDraw(SHAPE_BY_TOOL[tool]);
    }
  });
</script>
