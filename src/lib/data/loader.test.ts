import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchFeatures, parseFeatures, LoadError, validateCollection } from './loader';

const validCollection = {
  type: 'FeatureCollection',
  club: 'Buitensport Durf',
  version: '2026-07-09',
  features: [
    {
      type: 'Feature',
      id: 'a1b2c3d4-0001-4000-8000-e0f1a2b3c4d5',
      geometry: { type: 'Point', coordinates: [4.3648, 52.0272] },
      properties: { name: 'Klimrek', kind: 'obstacle' }
    }
  ]
};

afterEach(() => vi.restoreAllMocks());

describe('parseFeatures', () => {
  it('accepts valid GeoJSON', async () => {
    const result = await parseFeatures(JSON.stringify(validCollection));
    expect(result.type).toBe('FeatureCollection');
    expect(result.version).toBe('2026-07-09');
    expect(result.features).toHaveLength(1);
  });

  it('throws LoadError on malformed JSON', async () => {
    await expect(parseFeatures('not json')).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when type is not FeatureCollection', async () => {
    const bad = { ...validCollection, type: 'Random' };
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when version is missing', async () => {
    const { version: _v, ...bad } = validCollection;
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when club is missing', async () => {
    const { club: _c, ...bad } = validCollection;
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when a feature id is not a valid UUID', async () => {
    const bad = {
      ...validCollection,
      features: [{ ...validCollection.features[0], id: 'not-a-uuid' }]
    };
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when kind is unknown', async () => {
    const bad = {
      ...validCollection,
      features: [
        {
          ...validCollection.features[0],
          properties: { name: 'x', kind: 'unknown' }
        }
      ]
    };
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });
});

describe('fetchFeatures', () => {
  it('returns parsed collection on HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(validCollection) })
    );
    const result = await fetchFeatures('/data/obstacles.geojson');
    expect(result.features).toHaveLength(1);
  });

  it('throws LoadError on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    );
    await expect(fetchFeatures('/data/obstacles.geojson')).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when fetch itself throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchFeatures('/data/obstacles.geojson')).rejects.toBeInstanceOf(LoadError);
  });
});

describe('validateCollection', () => {
  it('returns valid: true for a well-formed collection', () => {
    const result = validateCollection({
      type: 'FeatureCollection',
      club: 'Test',
      version: '2026-01-01',
      features: []
    });
    expect(result.valid).toBe(true);
  });

  it('accepts an optional .png logo URL', () => {
    const result = validateCollection({
      ...validCollection,
      logo: 'https://example.com/club.png'
    });
    expect(result.valid).toBe(true);
  });

  it('accepts an optional .svg logo URL', () => {
    const result = validateCollection({
      ...validCollection,
      logo: 'https://example.com/club.svg'
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a logo URL with an unsupported extension', () => {
    const result = validateCollection({
      ...validCollection,
      logo: 'https://example.com/club.jpg'
    });
    expect(result.valid).toBe(false);
  });

  it('returns valid: false with an error message for a malformed collection', () => {
    const result = validateCollection({ type: 'FeatureCollection' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
