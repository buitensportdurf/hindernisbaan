import { describe, expect, it } from 'vitest';
import { validateCollection } from '$lib/data/loader';
import type { CombiFeature, MapFeature, ObstacleFeature } from '$lib/data/types';
import { featureFaults } from './featureFaults';

const square: [number, number][][] = [[[4.5, 52], [4.501, 52], [4.501, 52.001], [4.5, 52.001], [4.5, 52]]];

function obstacle(name: string, id = '00000000-0000-4000-8000-000000000001'): ObstacleFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [4.5, 52] },
    properties: { name, kind: 'obstacle' }
  };
}

function combi(name: string, members: string[], id = '00000000-0000-4000-8000-000000000002'): CombiFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Polygon', coordinates: square },
    properties: { name, kind: 'combi', members: members.map((m) => ({ name: m })) }
  };
}

function collection(features: MapFeature[]) {
  return { type: 'FeatureCollection', club: 'Club', version: '2026-01-01', features };
}

describe('featureFaults', () => {
  it('flags an obstacle without a name', () => {
    const f = obstacle('');
    expect(featureFaults([f]).get(f.id)).toEqual(['nameMissing']);
  });

  it('flags a combi without a name and without members', () => {
    const f = combi('', []);
    expect(featureFaults([f]).get(f.id)).toEqual(['nameMissing', 'membersMissing']);
  });

  it('flags a named combi without members', () => {
    const f = combi('Combi', []);
    expect(featureFaults([f]).get(f.id)).toEqual(['membersMissing']);
  });

  it('leaves valid features and landmarks out', () => {
    const landmark: MapFeature = {
      type: 'Feature',
      id: '00000000-0000-4000-8000-000000000003',
      geometry: { type: 'Point', coordinates: [4.5, 52] },
      properties: { name: '', kind: 'landmark', icon: 'flag' }
    };
    expect(featureFaults([obstacle('Muur'), combi('Combi', ['Balk']), landmark]).size).toBe(0);
  });

  it('matches the schema: each fault fails validation, fixing it passes', () => {
    const cases: [MapFeature, MapFeature][] = [
      [obstacle(''), obstacle('Muur')],
      [combi('', ['Balk']), combi('Combi', ['Balk'])],
      [combi('Combi', []), combi('Combi', ['Balk'])]
    ];
    for (const [broken, fixed] of cases) {
      expect(featureFaults([broken]).size).toBe(1);
      expect(validateCollection(collection([broken])).valid).toBe(false);
      expect(featureFaults([fixed]).size).toBe(0);
      expect(validateCollection(collection([fixed])).valid).toBe(true);
    }
  });
});
