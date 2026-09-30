<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import MapCanvas from '$lib/map/MapCanvas.svelte';
  import Menu from './Menu.svelte';
  import LoadFailDialog from './LoadFailDialog.svelte';
  import TilesDownDialog from './TilesDownDialog.svelte';
  import { createAppState, type AppState } from '$lib/state/app.svelte';
  import type { InteractionController } from '$lib/interaction/controller.svelte';
  import { fetchFeatures, parseFeatures, LoadError } from '$lib/data/loader';
  import ObstacleLayer from '$lib/map/ObstacleLayer.svelte';
  import CombiLayer from '$lib/map/CombiLayer.svelte';
  import LandmarkLayer from '$lib/map/LandmarkLayer.svelte';

  let {
    app = createAppState(),
    interaction,
    mode = 'map',
    showMenu = true,
    hasDraftProblem = false,
    draft = undefined,
    fitFeatures: fitFeaturesProp = undefined,
    toolbar,
    editorPanel,
    menuStatusExtra,
    mapLayers
  }: {
    app?: AppState;
    interaction: InteractionController;
    mode?: 'map' | 'design' | 'test';
    showMenu?: boolean;
    hasDraftProblem?: boolean;
    draft?: import('$lib/state/draft.svelte').DraftState;
    fitFeatures?: import('$lib/data/types').MapFeature[] | null;
    toolbar?: Snippet;
    editorPanel?: Snippet;
    menuStatusExtra?: Snippet;
    mapLayers?: Snippet;
  } = $props();

  let tilesDown = $state(false);

  const LOAD_ERROR_PREVIEWS: Record<string, string> = {
    network: 'Failed to fetch',
    json: 'Invalid JSON in file',
    schema: "Invalid obstacle course: data must have required property 'features'"
  };

  function devSearchParams(): URLSearchParams | null {
    if (!import.meta.env.DEV || typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search);
  }

  async function load() {
    app.setLoadState('loading');
    try {
      const col = await fetchFeatures();
      app.setData(col);
    } catch (err) {
      app.setLoadError(err instanceof LoadError ? err.message : 'Onbekende fout / Unknown error');
    }
  }

  async function handleImport(text: string) {
    try {
      const col = await parseFeatures(text);
      app.setData(col);
    } catch (err) {
      app.setLoadError(
        err instanceof LoadError ? err.message : 'Ongeldig bestand / Invalid file'
      );
    }
  }

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => interaction.handleKeydown(e);
    // Capture runs before the dialog's bubble handler, so Escape still sees details as open.
    window.addEventListener('keydown', onKeyDown, true);

    const params = devSearchParams();
    const loaderrKey = params?.get('loaderr');
    if (loaderrKey && loaderrKey in LOAD_ERROR_PREVIEWS) {
      app.setLoadError(LOAD_ERROR_PREVIEWS[loaderrKey]);
    } else if (mode !== 'design') {
      load();
    }
    if (params?.has('tilesdown')) tilesDown = true;
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  const fitFeaturesResolved = $derived(
    fitFeaturesProp !== undefined
      ? fitFeaturesProp
      : app.loadState === 'loaded'
        ? app.features
        : null
  );
</script>

<div class="fixed inset-0 overflow-hidden" class:has-selection={interaction.selectedId !== null}>
  <Toaster position="bottom-center" richColors closeButton />
  <MapCanvas
    tile={app.tile}
    fitFeatures={fitFeaturesResolved}
    fitEpoch={app.dataEpoch}
    doubleClickZoom={mode !== 'design'}
    selectedId={interaction.selectedId}
    onFailover={(n) => app.failoverTile(n)}
    onBothTilesDown={() => (tilesDown = true)}
    onBackgroundClick={() => interaction.backgroundClick()}
    clicksSuppressed={() => interaction.clicksSuppressed}
  >
    {#if mode === 'map'}
      <ObstacleLayer
        features={app.obstacles}
        {interaction}
        labelsEnabled={app.labels === 'zoom'}
      />
      <CombiLayer
        features={app.combis}
        {interaction}
        labelsEnabled={app.labels === 'zoom'}
      />
      <LandmarkLayer
        features={app.landmarks}
        {interaction}
      />
    {/if}
    {@render mapLayers?.()}
  </MapCanvas>

  {#if showMenu}
    <Menu {app} onImport={handleImport} {mode} {draft} statusExtra={menuStatusExtra} {hasDraftProblem} />
  {/if}

  {@render toolbar?.()}
  {@render editorPanel?.()}

  {#if app.loadState === 'error' && app.loadError}
    <LoadFailDialog
      locale={app.locale}
      error={app.loadError}
      onRetry={load}
      onImport={handleImport}
    />
  {/if}

  {#if tilesDown}
    <TilesDownDialog locale={app.locale} onDismiss={() => (tilesDown = false)} />
  {/if}


</div>
