<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import DrawToolbar from '$lib/design/DrawToolbar.svelte';
  import GeomanController from '$lib/design/GeomanController.svelte';
  import FeatureEditorSheet from '$lib/design/FeatureEditorSheet.svelte';
  import { createInteractionController } from '$lib/interaction/controller.svelte';
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
  import { SvelteSet } from 'svelte/reactivity';

  const app = createAppState();
  const draft = createDraftState();

  let lastInvalidToastAt = 0;

  const interaction = createInteractionController({
    openDetailsOn: 'dblclick',
    isMenuOpen: () => app.menuOpen,
    closeMenu: () => app.closeMenu(),
    onDelete: (id) => {
      draft.removeFeature(id);
      interaction.deleted(id);
    }
  });

  $effect(() => {
    if (draft.isValid || interaction.detailsOpen) return;
    const now = Date.now();
    if (now - lastInvalidToastAt < 2000) return;
    lastInvalidToastAt = now;
    toast.error(t(app.locale, 'draft.toast.invalid'));
  });

  onMount(() => {
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
  });

  function roundCoords<T>(coordinates: T): T {
    return JSON.parse(
      JSON.stringify(coordinates),
      (_key, value) => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value)
    );
  }

  function handleCreate(shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) {
    const currentTool = interaction.tool;
    const geojson = (layer as L.Marker | L.Polyline | L.Polygon).toGeoJSON();
    const coordinates = roundCoords(geojson.geometry.coordinates);
    const id = generateId();

    if (shape === 'Marker') {
      if (currentTool === 'landmark') {
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
    pristineIds.add(id);
    interaction.created(id, draft.isValid);
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
    interaction.deleted(id);
  }

  function handleRemove(feature: MapFeature) {
    handleDeleteSelected(feature.id);
  }

  function deleteSelectedFeature() {
    if (interaction.selectedId) handleDeleteSelected(interaction.selectedId);
  }

  function deselectFeature() {
    if (interaction.detailsOpen) interaction.closeDetails();
    interaction.dispatch({ type: 'escape' });
  }

  // Freshly drawn features hide their faults until first deselected.
  const pristineIds = new SvelteSet<string>();
  let lastSelectedId: string | null = null;
  $effect(() => {
    const id = interaction.selectedId;
    if (lastSelectedId !== null && lastSelectedId !== id) pristineIds.delete(lastSelectedId);
    lastSelectedId = id;
  });

  const visibleFaults = $derived.by(() => {
    const out = new Map<string, string>();
    for (const [id, codes] of draft.faults) {
      if (pristineIds.has(id)) continue;
      out.set(id, codes.map((code) => t(app.locale, `fault.${code}`)).join(' · '));
    }
    return out;
  });

  const selectedFeature = $derived(
    draft.features.find((f) => f.id === interaction.selectedId) ?? null
  );
  const fitFeatures = $derived(app.loadState === 'loaded' ? draft.features : null);
</script>

<AppShell {app} {interaction} mode="design" hasDraftProblem={!draft.isValid} {draft} {fitFeatures}>
  {#snippet toolbar()}
    <DrawToolbar
      tool={interaction.tool}
      onToolChange={(t) => interaction.setTool(t)}
      locale={app.locale}
      selectedId={interaction.selectedId}
      onDeleteSelected={deleteSelectedFeature}
      onDeselect={deselectFeature}
    />
  {/snippet}

  {#snippet editorPanel()}
    <FeatureEditorSheet
      open={interaction.detailsOpen}
      onOpenChange={(v) => {
        if (!v) interaction.closeDetails();
      }}
      feature={selectedFeature}
      {draft}
      onRequestDelete={handleDeleteSelected}
      onClose={() => interaction.closeDetails()}
      locale={app.locale}
    />
  {/snippet}


  {#snippet mapLayers()}
    <GeomanController {interaction} locale={app.locale} onCreate={handleCreate} onEdit={handleEdit} onRemove={handleRemove} />
    <ObstacleLayer
      features={draft.obstacles}
      {interaction}
      labelsEnabled={app.labels === 'zoom'}
      faults={visibleFaults}
    />
    <CombiLayer
      features={draft.combis}
      {interaction}
      labelsEnabled={app.labels === 'zoom'}
      faults={visibleFaults}
    />
    <LandmarkLayer
      features={draft.landmarks}
      {interaction}
    />
  {/snippet}
</AppShell>
