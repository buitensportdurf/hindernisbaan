import type L from 'leaflet';

/** Shared base style for filled map entities (obstacles + combi zones). */
export const ENTITY_STYLE = {
  color: '#00a5e3',
  weight: 10,
  fillColor: '#ffffff',
  fillOpacity: 1,
} as const;

/** Appends a native SVG <title> tooltip to a Leaflet path layer's element. */
export function addSvgTitle(layer: L.Layer, text: string): void {
  const path = (layer as any)._path as SVGElement | undefined;
  if (!path) return;
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = text;
  path.appendChild(t);
}
