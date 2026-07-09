<script lang="ts">
  import MapCanvas from '$lib/map/MapCanvas.svelte';
  import Menu from './Menu.svelte';
  import { createAppState } from '$lib/state/app.svelte';

  const app = createAppState();
</script>

<div class="fixed inset-0 overflow-hidden">
  <MapCanvas tile={app.tile} onFailover={(n) => app.failoverTile(n)} />
  <Menu {app} />
</div>
