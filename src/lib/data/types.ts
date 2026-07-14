export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number];
}

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type Geometry = PointGeometry | LineStringGeometry | PolygonGeometry;

export interface Member {
  name: string;
  notes?: string;
  position?: [number, number];
}

interface BaseProperties {
  name: string;
  notes?: string;
}

export interface ObstacleProperties extends BaseProperties {
  kind: 'obstacle';
}

export interface CombiProperties extends BaseProperties {
  kind: 'combi';
  members: Member[];
}

export interface LandmarkProperties extends BaseProperties {
  kind: 'landmark';
  icon: string;
}

export interface ObstacleFeature {
  type: 'Feature';
  id: string;
  geometry: Geometry;
  properties: ObstacleProperties;
}

export interface CombiFeature {
  type: 'Feature';
  id: string;
  geometry: PolygonGeometry;
  properties: CombiProperties;
}

export interface LandmarkFeature {
  type: 'Feature';
  id: string;
  geometry: PointGeometry;
  properties: LandmarkProperties;
}

export type MapFeature = ObstacleFeature | CombiFeature | LandmarkFeature;

export interface FeatureCollection {
  type: 'FeatureCollection';
  club: string;
  version: string;
  features: MapFeature[];
}
