import { resolveInitialLocale, LANG_KEY, type Locale } from '$lib/i18n';
import { resolveInitialTile } from '$lib/map/tiles';
import type { TileKey } from '$lib/map/tiles';
import { readKey, writeKey } from '$lib/storage/local';

export type MenuLevel = 'root' | 'settings';

export function createAppState() {
  let locale = $state<Locale>(
    resolveInitialLocale(readKey(LANG_KEY), typeof navigator !== 'undefined' ? navigator.language : undefined)
  );
  let tile = $state<TileKey>(resolveInitialTile(readKey('durf:tile')));
  let menuOpen = $state(false);
  let menuLevel = $state<MenuLevel>('root');

  return {
    get locale() { return locale; },
    get tile() { return tile; },
    get menuOpen() { return menuOpen; },
    get menuLevel() { return menuLevel; },
    setLocale(l: Locale) { locale = l; writeKey(LANG_KEY, l); },
    setTile(k: TileKey) { tile = k; writeKey('durf:tile', k); menuOpen = false; },
    failoverTile(k: TileKey) { tile = k; },
    toggleMenu() {
      if (!menuOpen) { menuOpen = true; menuLevel = 'root'; }
      else if (menuLevel === 'settings') { menuLevel = 'root'; }
      else { menuOpen = false; }
    },
    closeMenu() { menuOpen = false; menuLevel = 'root'; },
    gotoSettings() { menuLevel = 'settings'; }
  };
}

export type AppState = ReturnType<typeof createAppState>;
