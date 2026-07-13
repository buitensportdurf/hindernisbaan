<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import DrawToolbar from '$lib/design/DrawToolbar.svelte';
  import type { DrawTool } from '$lib/design/drawTool';
  import GeomanController from '$lib/design/GeomanController.svelte';
  import FeatureEditorSheet from '$lib/design/FeatureEditorSheet.svelte';
  import DraftStatus from '$lib/design/DraftStatus.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { createDraftState } from '$lib/state/draft.svelte';
  import { fetchFeatures, LoadError } from '$lib/data/loader';
  import { generateId } from '$lib/data/ids';
  import ObstacleLayer from '$lib/map/ObstacleLayer.svelte';
  import CombiLayer from '$lib/map/CombiLayer.svelte';
  import LandmarkLayer from '$lib/map/LandmarkLayer.svelte';
  import type { HindernisFeature, FeatureCollection } from '$lib/data/types';
  import type L from 'leaflet';
  import { t } from '$lib/i18n';
  import { toast } from 'svelte-sonner';

  const app = createAppState();
  const draft = createDraftState();

  let liveData = $state<FeatureCollection | null>(null);
  let tool = $state<DrawTool>(null);
  let lastInvalidToastAt = 0;

  $effect(() => {
    if (draft.isValid) return;
    const now = Date.now();
    if (now - lastInvalidToastAt < 2000) return;
    lastInvalidToastAt = now;
    toast.error(t(app.locale, 'draft.toast.invalid'));
  });

  onMount(async () => {
    app.setLoadState('loading');
    try {
      const col = await fetchFeatures();
      liveData = col;
      app.setData(col);
      draft.loadOrInit(col);
    } catch (err) {
      app.setLoadError(err instanceof LoadError ? err.message : 'Onbekende fout / Unknown error');
    }
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
      draft.addFeature({
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates: coordinates as [number, number] },
        properties: { name: '', kind: 'obstacle' }
      });
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
    tool = null;
  }

  function handleEdit(feature: HindernisFeature, layer: L.Layer) {
    const geojson = (layer as L.Marker | L.Polyline | L.Polygon).toGeoJSON();
    const coordinates = roundCoords(geojson.geometry.coordinates);
    draft.updateGeometry(feature.id, {
      ...feature.geometry,
      coordinates
    } as HindernisFeature['geometry']);
  }

  function handleRemove(feature: HindernisFeature) {
    draft.removeFeature(feature.id);
    if (app.selectedId === feature.id) app.selectFeature(null);
  }

  function handleDeleteSelected(id: string) {
    draft.removeFeature(id);
    app.selectFeature(null);
  }

  const selectedFeature = $derived(draft.features.find((f) => f.id === app.selectedId) ?? null);
</script>

<AppShell {app} mode="design" hasDraftProblem={!draft.isValid}>
  {#snippet toolbar()}
    <DrawToolbar bind:tool locale={app.locale} />
  {/snippet}

  {#snippet editorPanel()}
    <FeatureEditorSheet
      feature={selectedFeature}
      {draft}
      onRequestDelete={handleDeleteSelected}
      onClose={() => app.selectFeature(null)}
      locale={app.locale}
    />
  {/snippet}

  {#snippet menuStatusExtra()}
    {#if liveData}
      <DraftStatus {draft} live={liveData} locale={app.locale} />
    {/if}
  {/snippet}

  {#snippet mapLayers()}
    <GeomanController {tool} onCreate={handleCreate} onEdit={handleEdit} onRemove={handleRemove} />
    <ObstacleLayer
      features={draft.obstacles}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <CombiLayer
      features={draft.combis}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <LandmarkLayer
      features={draft.landmarks}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
  {/snippet}
</AppShell>
