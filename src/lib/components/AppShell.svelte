<script lang="ts">
  import { onMount } from 'svelte';
  import MapCanvas from '$lib/map/MapCanvas.svelte';
  import Menu from './Menu.svelte';
  import LoadFailDialog from './LoadFailDialog.svelte';
  import TilesDownDialog from './TilesDownDialog.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { fetchFeatures, parseFeatures, LoadError } from '$lib/data/loader';
  import ObstacleLayer from '$lib/map/ObstacleLayer.svelte';
  import CombiLayer from '$lib/map/CombiLayer.svelte';
  import LandmarkLayer from '$lib/map/LandmarkLayer.svelte';
  const app = createAppState();

  let tilesDown = $state(false);

  const LOAD_ERROR_PREVIEWS: Record<string, string> = {
    network: 'Failed to fetch',
    json: 'Invalid JSON in file',
    schema: "Invalid map data: data must have required property 'features'"
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
    const params = devSearchParams();
    const loaderrKey = params?.get('loaderr');
    if (loaderrKey && loaderrKey in LOAD_ERROR_PREVIEWS) {
      app.setLoadError(LOAD_ERROR_PREVIEWS[loaderrKey]);
    } else {
      load();
    }
    if (params?.has('tilesdown')) tilesDown = true;
  });
</script>

<div class="fixed inset-0 overflow-hidden" class:has-selection={app.selectedId !== null}>
  <MapCanvas
    tile={app.tile}
    fitFeatures={app.loadState === 'loaded' ? app.features : null}
    onFailover={(n) => app.failoverTile(n)}
    onBothTilesDown={() => (tilesDown = true)}
    onDeselect={() => app.selectFeature(null)}
  >
    <ObstacleLayer
      features={app.obstacles}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <CombiLayer
      features={app.combis}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <LandmarkLayer
      features={app.landmarks}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
  </MapCanvas>

  <Menu {app} />

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
