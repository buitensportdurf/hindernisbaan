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
  import TweaksPanel from '$lib/map/TweaksPanel.svelte';

  const app = createAppState();

  let tilesDown = $state(false);

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

  onMount(load);
</script>

<div class="fixed inset-0 overflow-hidden">
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

  {#if import.meta.env.DEV && app.selectedId !== null}
    <TweaksPanel />
  {/if}
</div>
