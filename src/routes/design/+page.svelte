<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import DrawToolbar from '$lib/design/DrawToolbar.svelte';
  import type { DrawTool } from '$lib/design/drawTool';
  import GeomanController from '$lib/design/GeomanController.svelte';
  import FeatureEditorSheet from '$lib/design/FeatureEditorSheet.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { createDraftState } from '$lib/state/draft.svelte';
  import { fetchFeatures, LoadError } from '$lib/data/loader';
  import { generateId } from '$lib/data/ids';
  import ObstacleLayer from '$lib/map/ObstacleLayer.svelte';
  import CombiLayer from '$lib/map/CombiLayer.svelte';
  import LandmarkLayer from '$lib/map/LandmarkLayer.svelte';
  import type { MapFeature } from '$lib/data/types';
  import type L from 'leaflet';
  import { t } from '$lib/i18n';
  import { toast } from 'svelte-sonner';

  const app = createAppState();
  const draft = createDraftState();

  let tool = $state<DrawTool>(null);
  let detailsOpen = $state(false);
  let lastInvalidToastAt = 0;

  const gesturesEnabled = () => tool === null;

  function handleSelect(id: string) {
    if (tool !== null) return;
    app.selectFeature(id);
  }

  function handleOpenDetails(id: string) {
    if (tool !== null) return;
    app.selectFeature(id);
    detailsOpen = true;
  }

  function closeDetails() {
    detailsOpen = false;
  }

  $effect(() => {
    if (app.selectedId === null) detailsOpen = false;
  });

  // Starting a new drawing exits the current selection.
  $effect(() => {
    if (tool !== null && app.selectedId !== null) {
      app.selectFeature(null);
    }
  });

  $effect(() => {
    if (draft.isValid) return;
    const now = Date.now();
    if (now - lastInvalidToastAt < 2000) return;
    lastInvalidToastAt = now;
    toast.error(t(app.locale, 'draft.toast.invalid'));
  });

  onMount(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Cancel an active draw tool; Geoman aborts its own draw on Escape,
        // so this keeps the toolbar state in sync with the map.
        if (tool !== null) tool = null;
        return;
      }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const el = e.target;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (!app.selectedId || tool !== null) return;
      e.preventDefault();
      deleteSelectedFeature();
    }

    window.addEventListener('keydown', onKeyDown);

    (async () => {
      app.setLoadState('loading');
      try {
        const col = await fetchFeatures();
        app.setData(col);
        draft.loadOrInit(col);
      } catch (err) {
        app.setLoadError(err instanceof LoadError ? err.message : 'Onbekende fout / Unknown error');
      }
    })();

    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function roundCoords<T>(coordinates: T): T {
    return JSON.parse(
      JSON.stringify(coordinates),
      (_key, value) => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value)
    );
  }

  function handleCreate(shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) {
    const geojson = (layer as L.Marker | L.Polyline | L.Polygon).toGeoJSON();
    const coordinates = roundCoords(geojson.geometry.coordinates);
    const id = generateId();

    if (shape === 'Marker') {
      if (tool === 'landmark') {
        draft.addFeature({
          type: 'Feature',
          id,
          geometry: { type: 'Point', coordinates: coordinates as [number, number] },
          properties: { name: '', kind: 'landmark', icon: 'flag' }
        });
      } else {
        draft.addFeature({
          type: 'Feature',
          id,
          geometry: { type: 'Point', coordinates: coordinates as [number, number] },
          properties: { name: '', kind: 'obstacle' }
        });
      }
    } else if (shape === 'Line') {
      draft.addFeature({
        type: 'Feature',
        id,
        geometry: { type: 'LineString', coordinates: coordinates as [number, number][] },
        properties: { name: '', kind: 'obstacle' }
      });
    } else if (shape === 'Rectangle') {
      draft.addFeature({
        type: 'Feature',
        id,
        geometry: { type: 'Polygon', coordinates: coordinates as [number, number][][] },
        properties: { name: '', kind: 'combi', members: [] }
      });
    } else if (shape === 'Polygon') {
      draft.addFeature({
        type: 'Feature',
        id,
        geometry: { type: 'Polygon', coordinates: coordinates as [number, number][][] },
        properties: { name: '', kind: 'obstacle' }
      });
    }

    layer.remove(); // the *Layer components re-render this feature from draft state instead
    app.selectFeature(id);
    detailsOpen = true;
    tool = null;
  }

  function handleEdit(feature: MapFeature, layer: L.Layer) {
    const geojson = (layer as L.Marker | L.Polyline | L.Polygon).toGeoJSON();
    const coordinates = roundCoords(geojson.geometry.coordinates);
    const current = JSON.stringify(feature.geometry.coordinates);
    const next = JSON.stringify(coordinates);
    if (current === next) {
      return;
    }
    draft.updateGeometry(feature.id, {
      ...feature.geometry,
      coordinates
    } as MapFeature['geometry']);
  }

  function handleDeleteSelected(id: string) {
    draft.removeFeature(id);
    app.selectFeature(null);
    detailsOpen = false;
    tool = null;
  }

  function handleRemove(feature: MapFeature) {
    handleDeleteSelected(feature.id);
  }

  function deleteSelectedFeature() {
    if (app.selectedId) handleDeleteSelected(app.selectedId);
  }

  const selectedFeature = $derived(draft.features.find((f) => f.id === app.selectedId) ?? null);
  const fitFeatures = $derived(app.loadState === 'loaded' ? draft.features : null);
</script>

<AppShell {app} mode="design" hasDraftProblem={!draft.isValid} {draft} {fitFeatures}>
  {#snippet toolbar()}
    <DrawToolbar
      bind:tool
      locale={app.locale}
      selectedId={app.selectedId}
      onDeleteSelected={deleteSelectedFeature}
    />
  {/snippet}

  {#snippet editorPanel()}
    <FeatureEditorSheet
      bind:open={detailsOpen}
      feature={selectedFeature}
      {draft}
      onRequestDelete={handleDeleteSelected}
      onClose={closeDetails}
      locale={app.locale}
    />
  {/snippet}


  {#snippet mapLayers()}
    <GeomanController {tool} selectedId={app.selectedId} onCreate={handleCreate} onEdit={handleEdit} onRemove={handleRemove} />
    <ObstacleLayer
      features={draft.obstacles}
      selectedId={app.selectedId}
      onSelect={handleSelect}
      onOpenDetails={handleOpenDetails}
      {gesturesEnabled}
    />
    <CombiLayer
      features={draft.combis}
      selectedId={app.selectedId}
      onSelect={handleSelect}
      onOpenDetails={handleOpenDetails}
      {gesturesEnabled}
    />
    <LandmarkLayer
      features={draft.landmarks}
      selectedId={app.selectedId}
      onSelect={handleSelect}
      onOpenDetails={handleOpenDetails}
      {gesturesEnabled}
    />
  {/snippet}
</AppShell>
