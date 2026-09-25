import { describe, expect, it } from 'vitest';
import { GEOMETRY_COMMIT_EVENTS, selectedEditConfig } from './selectedEditConfig';
import type { MapFeature } from '$lib/data/types';

function lineObstacle(): MapFeature {
  return {
    type: 'Feature',
    id: 'line-1',
    geometry: {
      type: 'LineString',
      coordinates: [
        [4.36, 52.02],
        [4.37, 52.03]
      ]
    },
    properties: { name: 'Line', kind: 'obstacle' }
  };
}

function polygonObstacle(): MapFeature {
  return {
    type: 'Feature',
    id: 'poly-1',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [4.36, 52.02],
          [4.37, 52.02],
          [4.37, 52.03],
          [4.36, 52.02]
        ]
      ]
    },
    properties: { name: 'Area', kind: 'obstacle' }
  };
}

function pointObstacle(): MapFeature {
  return {
    type: 'Feature',
    id: 'pt-1',
    geometry: { type: 'Point', coordinates: [4.36, 52.02] },
    properties: { name: 'Dot', kind: 'obstacle' }
  };
}

function combi(): MapFeature {
  return {
    type: 'Feature',
    id: 'combi-1',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [4.36, 52.02],
          [4.37, 52.02],
          [4.37, 52.03],
          [4.36, 52.02]
        ]
      ]
    },
    properties: { name: 'Combi', kind: 'combi', members: [] }
  };
}

describe('selectedEditConfig — vertex click removes on lines, not combis', () => {
  it('line obstacles remove a vertex on click (not only right-click)', () => {
    const config = selectedEditConfig(lineObstacle());
    expect(config?.enableVertexEdit).toBe(true);
    expect(config?.removeVertexOn).toBe('click');
    expect(config?.preventMarkerRemoval).toBeFalsy();
  });

  it('polygon obstacles also remove a vertex on click', () => {
    expect(selectedEditConfig(polygonObstacle())?.removeVertexOn).toBe('click');
  });

  it('point obstacles have no vertex removal (drag only)', () => {
    const config = selectedEditConfig(pointObstacle());
    expect(config?.enableVertexEdit).toBe(false);
    expect(config?.removeVertexOn).toBeUndefined();
  });

  it('combis keep preventMarkerRemoval so corner clicks do not delete vertices', () => {
    const config = selectedEditConfig(combi());
    expect(config).toMatchObject({
      preventMarkerRemoval: true,
      hideMiddleMarkers: true
    });
    expect(config?.removeVertexOn).toBeUndefined();
  });
});

describe('GEOMETRY_COMMIT_EVENTS', () => {
  it('persists a vertex add or remove, not only a drag', () => {
    expect(GEOMETRY_COMMIT_EVENTS).toEqual(
      expect.arrayContaining(['pm:vertexadded', 'pm:vertexremoved', 'pm:dragend'])
    );
  });
});
