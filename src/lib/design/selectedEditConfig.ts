import type { MapFeature } from '$lib/data/types';

export type SelectedEditConfig = {
  allowEditing: boolean;
  allowRotation: boolean;
  enableVertexEdit: boolean;
  enableDrag: boolean;
  combiRotate: boolean;
  hideMiddleMarkers?: boolean;
  preventMarkerRemoval?: boolean;
  /** Geoman default is "contextmenu"; lines/polygons use click so the hint matches. */
  removeVertexOn?: 'click' | 'contextmenu';
};

/** Events that change stored geometry. Vertex add/remove must be here — drag is not the only edit. */
export const GEOMETRY_COMMIT_EVENTS = [
  'pm:dragend',
  'pm:markerdragend',
  'pm:rotateend',
  'pm:vertexadded',
  'pm:vertexremoved'
] as const;

/** Point obstacle, landmark, path obstacle, and combi — lookup instead of nested if/else. */
export function selectedEditConfig(feature: MapFeature): SelectedEditConfig | null {
  const kind = feature.properties.kind;
  if (kind === 'combi') {
    return {
      allowEditing: true,
      allowRotation: true,
      enableVertexEdit: true,
      enableDrag: true,
      combiRotate: true,
      hideMiddleMarkers: true,
      preventMarkerRemoval: true
    };
  }
  if (kind === 'landmark') {
    return {
      allowEditing: false,
      allowRotation: false,
      enableVertexEdit: false,
      enableDrag: true,
      combiRotate: false
    };
  }
  if (kind === 'obstacle') {
    const isPoint = feature.geometry.type === 'Point';
    return {
      allowEditing: !isPoint,
      allowRotation: false,
      enableVertexEdit: !isPoint,
      enableDrag: true,
      combiRotate: false,
      // Geoman defaults to right-click; click matches the hover hint on vertices.
      ...(isPoint ? {} : { removeVertexOn: 'click' as const })
    };
  }
  return null;
}
