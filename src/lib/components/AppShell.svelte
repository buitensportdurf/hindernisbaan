<script lang="ts">
  import MapCanvas from '$lib/map/MapCanvas.svelte';
  import Menu from './Menu.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { t } from '$lib/i18n';

  const app = createAppState();
</script>

<div style="position:fixed;inset:0;overflow:hidden">
  <MapCanvas tile={app.tile} onFailover={(n) => app.failoverTile(n)} />

  <button aria-label={t(app.locale, 'menu.settings')} onclick={() => app.toggleMenu()}
    style="position:absolute;top:12px;left:12px;width:44px;height:44px;z-index:1250;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--border-subtle);border-radius:12px;box-shadow:var(--shadow-md);cursor:pointer;color:#232323">
    {#if app.menuOpen && app.menuLevel === 'settings'}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
    {:else if app.menuOpen}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
    {:else}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"></path></svg>
    {/if}
  </button>

  {#if app.menuOpen}
    <div onclick={() => app.closeMenu()} role="presentation"
      style="position:absolute;inset:0;z-index:1150;background:rgba(0,0,0,.04)"></div>
    <Menu {app} />
  {/if}
</div>
