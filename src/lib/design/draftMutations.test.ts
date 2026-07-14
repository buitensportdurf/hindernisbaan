import { describe, expect, it } from 'vitest';
import {
  addFeature,
  updateFeature,
  setKind,
  removeFeature,
  addMember,
  updateMember,
  removeMember
} from './draftMutations';
import type { MapFeature, ObstacleFeature, CombiFeature } from '$lib/data/types';

const obstacle: ObstacleFeature = {
  type: 'Feature',
  id: 'obs-1',
  geometry: { type: 'Point', coordinates: [4.36, 52.02] },
  properties: { name: 'Klimrek', kind: 'obstacle' }
};

const combi: CombiFeature = {
  type: 'Feature',
  id: 'combi-1',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] },
  properties: { name: 'Parcours', kind: 'combi', members: [{ name: 'Balk 1' }] }
};

describe('addFeature', () => {
  it('appends the feature', () => {
    const result = addFeature([obstacle], combi);
    expect(result).toEqual([obstacle, combi]);
  });
});

describe('updateFeature', () => {
  it('shallow-merges the properties patch for the matching id', () => {
    const result = updateFeature([obstacle], 'obs-1', { name: 'Nieuw klimrek' });
    expect(result[0].properties.name).toBe('Nieuw klimrek');
    expect(result[0].properties.kind).toBe('obstacle');
  });

  it('leaves other features untouched', () => {
    const result = updateFeature([obstacle, combi], 'obs-1', { name: 'X' });
    expect(result[1]).toBe(combi);
  });
});

describe('removeFeature', () => {
  it('removes the feature with the matching id', () => {
    const result = removeFeature([obstacle, combi], 'obs-1');
    expect(result).toEqual([combi]);
  });
});

describe('setKind', () => {
  it('keeps name and notes when switching kind', () => {
    const noted: ObstacleFeature = {
      ...obstacle,
      properties: { name: 'Klimrek', kind: 'obstacle', notes: 'Hoog' }
    };
    const result = setKind([noted], 'obs-1', 'landmark');
    expect(result[0].properties).toEqual({ name: 'Klimrek', notes: 'Hoog', kind: 'landmark', icon: '' });
  });

  it('drops members when switching combi to obstacle', () => {
    const result = setKind([combi], 'combi-1', 'obstacle');
    expect(result[0].properties).toEqual({ name: 'Parcours', kind: 'obstacle' });
  });

  it('drops icon when switching landmark to obstacle', () => {
    const landmark: MapFeature = {
      type: 'Feature',
      id: 'lm-1',
      geometry: { type: 'Point', coordinates: [4.36, 52.02] },
      properties: { name: 'Verzamelplek', kind: 'landmark', icon: 'users' }
    };
    const result = setKind([landmark], 'lm-1', 'obstacle');
    expect(result[0].properties).toEqual({ name: 'Verzamelplek', kind: 'obstacle' });
  });

  it('adds an empty members array when switching to combi', () => {
    const poly: ObstacleFeature = {
      ...obstacle,
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] }
    };
    const result = setKind([poly], 'obs-1', 'combi');
    expect(result[0].properties).toEqual({ name: 'Klimrek', kind: 'combi', members: [] });
  });

  it('keeps existing members when re-selecting combi on a combi', () => {
    const result = setKind([combi], 'combi-1', 'combi');
    expect(result[0].properties).toEqual({ name: 'Parcours', kind: 'combi', members: [{ name: 'Balk 1' }] });
  });
});

describe('addMember', () => {
  it('appends an empty-named member to the matching combi', () => {
    const result = addMember([combi], 'combi-1') as [CombiFeature];
    expect(result[0].properties.members).toEqual([{ name: 'Balk 1' }, { name: '' }]);
  });

  it('is a no-op on a non-combi feature', () => {
    const result = addMember([obstacle], 'obs-1');
    expect(result).toEqual([obstacle]);
  });
});

describe('updateMember', () => {
  it('patches the member at the given index', () => {
    const result = updateMember([combi], 'combi-1', 0, { notes: 'Hoog' }) as [CombiFeature];
    expect(result[0].properties.members[0]).toEqual({ name: 'Balk 1', notes: 'Hoog' });
  });
});

describe('removeMember', () => {
  it('removes the member at the given index', () => {
    const result = removeMember([combi], 'combi-1', 0) as [CombiFeature];
    expect(result[0].properties.members).toEqual([]);
  });
});
