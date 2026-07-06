import { describe, it, expect } from 'vitest';
import { TILE_LAYERS, DEFAULT_TILE, otherTile, resolveInitialTile } from './tiles';

describe('TILE_LAYERS', () => {
  it('map is CARTO Voyager with OSM+CARTO attribution', () => {
    expect(TILE_LAYERS.map.url).toContain('basemaps.cartocdn.com/rastertiles/voyager');
    expect(TILE_LAYERS.map.attribution).toBe('© OpenStreetMap © CARTO');
  });
  it('sat is Esri World Imagery', () => {
    expect(TILE_LAYERS.sat.url).toContain('server.arcgisonline.com/ArcGIS/rest/services/World_Imagery');
    expect(TILE_LAYERS.sat.attribution).toBe('© Esri');
  });
});

describe('failover + defaults', () => {
  it('default is map', () => { expect(DEFAULT_TILE).toBe('map'); });
  it('otherTile swaps', () => {
    expect(otherTile('map')).toBe('sat');
    expect(otherTile('sat')).toBe('map');
  });
  it('resolveInitialTile honours a valid stored key, else default', () => {
    expect(resolveInitialTile('sat')).toBe('sat');
    expect(resolveInitialTile(null)).toBe('map');
    expect(resolveInitialTile('bogus')).toBe('map');
  });
});
