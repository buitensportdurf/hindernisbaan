import { resolveInitialLocale, LANG_KEY, type Locale } from '$lib/i18n';
import { resolveInitialTile } from '$lib/map/tiles';
import type { TileKey } from '$lib/map/tiles';
import { readKey, writeKey } from '$lib/storage/local';
import type {
  FeatureCollection,
  HindernisFeature,
  ObstacleFeature,
  CombiFeature,
  LandmarkFeature
} from '$lib/data/types';

export type MenuLevel = 'root' | 'settings';
export type LoadState = 'idle' | 'loading' | 'error' | 'loaded';

export function createAppState() {
  let locale = $state<Locale>(
    resolveInitialLocale(
      readKey(LANG_KEY),
      typeof navigator !== 'undefined' ? navigator.language : undefined
    )
  );
  let tile = $state<TileKey>(resolveInitialTile(readKey('durf:tile')));
  let menuOpen = $state(false);
  let menuLevel = $state<MenuLevel>('root');

  let features = $state<HindernisFeature[]>([]);
  let dataVersion = $state<string | null>(null);
  let dataClub = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let loadError = $state<string | null>(null);
  let loadState = $state<LoadState>('idle');

  return {
    get locale() { return locale; },
    get tile() { return tile; },
    get menuOpen() { return menuOpen; },
    get menuLevel() { return menuLevel; },
    get features() { return features; },
    get dataVersion() { return dataVersion; },
    get dataClub() { return dataClub; },
    get dataCount() { return features.length; },
    get selectedId() { return selectedId; },
    get loadError() { return loadError; },
    get loadState() { return loadState; },
    get obstacles(): ObstacleFeature[] {
      return features.filter((f): f is ObstacleFeature => f.properties.kind === 'obstacle');
    },
    get combis(): CombiFeature[] {
      return features.filter((f): f is CombiFeature => f.properties.kind === 'combi');
    },
    get landmarks(): LandmarkFeature[] {
      return features.filter((f): f is LandmarkFeature => f.properties.kind === 'landmark');
    },

    setLocale(l: Locale) { locale = l; writeKey(LANG_KEY, l); },
    setTile(k: TileKey) { tile = k; writeKey('durf:tile', k); menuOpen = false; },
    failoverTile(k: TileKey) { tile = k; },
    toggleMenu() {
      if (!menuOpen) { menuOpen = true; menuLevel = 'root'; }
      else if (menuLevel === 'settings') { menuLevel = 'root'; }
      else { menuOpen = false; }
    },
    closeMenu() { menuOpen = false; menuLevel = 'root'; },
    gotoSettings() { menuLevel = 'settings'; },

    setData(col: FeatureCollection) {
      features = col.features;
      dataVersion = col.version;
      dataClub = col.club;
      loadError = null;
      loadState = 'loaded';
    },
    setLoadError(msg: string) {
      loadError = msg;
      loadState = 'error';
    },
    setLoadState(s: 'idle' | 'loading') {
      loadState = s;
    },
    selectFeature(id: string | null) {
      selectedId = id;
    }
  };
}

export type AppState = ReturnType<typeof createAppState>;
