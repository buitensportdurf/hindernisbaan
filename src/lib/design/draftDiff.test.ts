import { describe, expect, it } from 'vitest';
import { diffFeatures } from './draftDiff';
import type { CombiFeature, MapFeature, ObstacleFeature } from '$lib/data/types';

const obstacle = (patch: Partial<ObstacleFeature['properties']> & { id?: string; coordinates?: [number, number] } = {}): ObstacleFeature => ({
  type: 'Feature',
  id: patch.id ?? 'obs-1',
  geometry: { type: 'Point', coordinates: patch.coordinates ?? [4.36, 52.02] },
  properties: { name: patch.name ?? 'Klimrek', kind: 'obstacle', notes: patch.notes }
});

const combi = (members: CombiFeature['properties']['members'], name = 'Parcours'): CombiFeature => ({
  type: 'Feature',
  id: 'combi-1',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] },
  properties: { name, kind: 'combi', members }
});

describe('diffFeatures', () => {
  it('returns nothing when the draft matches the published course', () => {
    const features = [obstacle()];
    expect(diffFeatures(features, features)).toEqual([]);
  });

  it('lists a feature that exists only in the draft as added', () => {
    expect(diffFeatures([], [obstacle()])).toEqual([
      { type: 'added', id: 'obs-1', name: 'Klimrek' }
    ]);
  });

  it('lists a feature missing from the draft as removed', () => {
    expect(diffFeatures([obstacle()], [])).toEqual([
      { type: 'removed', id: 'obs-1', name: 'Klimrek' }
    ]);
  });

  it('names which fields changed', () => {
    const official: MapFeature[] = [obstacle(), combi([{ name: 'Balk' }])];
    const draft: MapFeature[] = [
      obstacle({ name: 'Nieuw klimrek', notes: 'glad', coordinates: [4.37, 52.03] }),
      combi([{ name: 'Balk', notes: 'hoog' }], 'Parcours')
    ];
    expect(diffFeatures(official, draft)).toEqual([
      { type: 'updated', id: 'obs-1', name: 'Nieuw klimrek', fields: ['name', 'notes', 'geometry'] },
      { type: 'updated', id: 'combi-1', name: 'Parcours', fields: ['members'] }
    ]);
  });

  it('treats a missing notes string and an empty one as the same', () => {
    expect(diffFeatures([obstacle()], [obstacle({ notes: '' })])).toEqual([]);
  });
});
