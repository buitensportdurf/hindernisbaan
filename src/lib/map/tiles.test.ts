import { describe, it, expect } from 'vitest';
import { TILE_LAYERS, DEFAULT_TILE, otherTile, resolveInitialTile } from './tiles';

describe('TILE_LAYERS', () => {
  it('map is PDOK BRT grijs with Kadaster attribution', () => {
    expect(TILE_LAYERS.map.url).toContain('service.pdok.nl/brt/achtergrondkaart');
    expect(TILE_LAYERS.map.attribution).toBe('© Kadaster');
    expect(TILE_LAYERS.map.maxNativeZoom).toBe(19);
  });
  it('sat is Esri World Imagery', () => {
    expect(TILE_LAYERS.sat.url).toContain('server.arcgisonline.com/ArcGIS/rest/services/World_Imagery');
    expect(TILE_LAYERS.sat.attribution).toBe('© Esri');
  });
});

describe('failover + defaults', () => {
  it('default is sat', () => { expect(DEFAULT_TILE).toBe('sat'); });
  it('otherTile swaps', () => {
    expect(otherTile('map')).toBe('sat');
    expect(otherTile('sat')).toBe('map');
  });
  it('resolveInitialTile honours a valid stored key, else default', () => {
    expect(resolveInitialTile('map')).toBe('map');
    expect(resolveInitialTile(null)).toBe('sat');
    expect(resolveInitialTile('bogus')).toBe('sat');
  });
});
