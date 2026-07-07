<script lang="ts">
  import { t, LOCALES, type Locale } from '$lib/i18n';
  import { TILE_LAYERS, type TileKey } from '$lib/map/tiles';
  import type { AppState } from '$lib/state/app.svelte';
  let { app }: { app: AppState } = $props();

  const rowBase =
    'display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;background:transparent;border:none;border-radius:10px;cursor:pointer;font:600 14px var(--font-sans);color:#232323;text-align:left';
</script>

<div onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1"
  style="position:absolute;top:64px;left:12px;z-index:1200;width:min(86vw,300px);max-height:78vh;overflow:auto;background:#fff;border:1px solid var(--border-subtle);border-radius:16px;box-shadow:var(--shadow-md);padding:10px">
  {#if app.menuLevel === 'root'}
    <div style="display:flex;align-items:center;gap:10px;padding:2px 8px 12px">
      <div>
        <div style="font:700 14.5px var(--font-sans);color:#232323">{t(app.locale, 'app.title')}</div>
        <div style="font:500 11px var(--font-sans);color:var(--text-muted)">{t(app.locale, 'app.subtitle')} · v2026.juni</div>
      </div>
    </div>
    <button style={rowBase} onclick={() => app.gotoSettings()}>
      <span style="flex:1">{t(app.locale, 'menu.settings')}</span>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg>
    </button>
  {:else}
    <div style="font:700 15px var(--font-sans);color:#232323;padding:2px 8px 12px">{t(app.locale, 'settings.title')}</div>
    <div style="font:700 10px var(--font-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:4px 12px">{t(app.locale, 'settings.tiles')}</div>
    {#each ['map', 'sat'] as key (key)}
      <button style={rowBase + (app.tile === key ? ';background:var(--brand-subtle)' : '')} onclick={() => app.setTile(key as TileKey)}>
        <span style="flex:1">{t(app.locale, key === 'map' ? 'settings.tiles.map' : 'settings.tiles.sat')}
          <span style="font-weight:500;color:var(--text-muted);font-size:12px">· {t(app.locale, key === 'map' ? 'settings.tiles.map.sub' : 'settings.tiles.sat.sub')}</span>
        </span>
      </button>
    {/each}
    <div style="height:1px;background:var(--border-subtle);margin:8px 6px"></div>
    <div style="font:700 10px var(--font-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:4px 12px">{t(app.locale, 'settings.language')}</div>
    <div style="display:flex;gap:8px;padding:4px 12px 8px">
      {#each LOCALES as l (l)}
        <button onclick={() => app.setLocale(l)}
          style="flex:1;padding:8px;border-radius:8px;border:1.5px solid {app.locale === l ? 'var(--bok-500)' : 'var(--border)'};background:{app.locale === l ? 'var(--brand-subtle)' : '#fff'};font:600 13px var(--font-sans);cursor:pointer;text-transform:uppercase">{l}</button>
      {/each}
    </div>
  {/if}
</div>
