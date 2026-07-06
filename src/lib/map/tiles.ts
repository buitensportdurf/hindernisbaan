export type TileKey = 'map' | 'sat';

export interface TileLayerDef {
  key: TileKey;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
}

export const TILE_LAYERS: Record<TileKey, TileLayerDef> = {
  map: {
    key: 'map',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 20,
    subdomains: 'abcd'
  },
  sat: {
    key: 'sat',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19
  }
};

export const DEFAULT_TILE: TileKey = 'map';
export const TILE_ERROR_THRESHOLD = 10;

export function otherTile(key: TileKey): TileKey {
  return key === 'map' ? 'sat' : 'map';
}

function isTileKey(v: string | null): v is TileKey {
  return v === 'map' || v === 'sat';
}

export function resolveInitialTile(stored: string | null): TileKey {
  return isTileKey(stored) ? stored : DEFAULT_TILE;
}
