import { afterEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { applyDrawTool, hintVertices } from './drawMode';

const maps: L.Map[] = [];

afterEach(() => {
  maps.splice(0).forEach((map) => map.remove());
  document.body.innerHTML = '';
});

function makeMap(): L.Map {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // No inertia: its pan animation would outlive the map once the test removes it.
  const map = L.map(container, { center: [52, 4.5], zoom: 18, renderer: L.svg(), inertia: false });  maps.push(map);
  return map;
}

/** A mouse event as a browser delivers it; jsdom reports `which: 0`, which Leaflet's drag ignores. */
function mouse(type: string, x: number, y: number, buttons = 1): MouseEvent {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons
  });
  Object.defineProperty(event, 'which', { value: 1 });
  return event;
}

/** A real click. `wiggle` moves the pointer between press and release, as a hand does. */
function clickAt(map: L.Map, x: number, y: number, wiggle = 0): void {
  const target = map.getContainer().querySelector('.leaflet-map-pane') ?? map.getContainer();
  target.dispatchEvent(mouse('mousedown', x, y));
  if (wiggle) {
    target.dispatchEvent(mouse('mousemove', x + wiggle, y + wiggle));
    target.dispatchEvent(mouse('mousemove', x + wiggle * 2, y + wiggle * 2));
  }
  const endX = x + wiggle * 2;
  const endY = y + wiggle * 2;
  target.dispatchEvent(mouse('mouseup', endX, endY, 0));
  target.dispatchEvent(mouse('click', endX, endY, 0));
}

/** Press, move far, release — a pan gesture. Reports whether Leaflet treated it as a map drag. */
function dragAcross(map: L.Map): boolean {
  const target = map.getContainer().querySelector('.leaflet-map-pane') ?? map.getContainer();
  let panned = false;
  map.once('dragstart', () => (panned = true));
  target.dispatchEvent(mouse('mousedown', 100, 100));
  target.dispatchEvent(mouse('mousemove', 130, 130));
  target.dispatchEvent(mouse('mousemove', 160, 160));
  target.dispatchEvent(mouse('mouseup', 160, 160, 0));
  return panned;
}

function hintText(map: L.Map): string | undefined {
  const draw = (map.pm.Draw as unknown as { Rectangle: { _hintMarker?: L.Marker } }).Rectangle;
  const content = draw._hintMarker?.getTooltip()?.getContent();
  return typeof content === 'string' ? content : undefined;
}

describe('applyDrawTool — creating a combi (rectangle)', () => {
  it('two clicks draw a rectangle', () => {
    const map = makeMap();
    const onCreate = vi.fn();
    map.on('pm:create', onCreate);
    applyDrawTool(map, 'rectangle', 'en');

    clickAt(map, 100, 100);
    clickAt(map, 180, 160);

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].shape).toBe('Rectangle');
  });

  it('a click that moves a few pixels still places each corner instead of panning the map', () => {
    const map = makeMap();
    const onCreate = vi.fn();
    map.on('pm:create', onCreate);
    applyDrawTool(map, 'rectangle', 'en');

    clickAt(map, 100, 100, 4);
    clickAt(map, 180, 160, 4);

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('a drag does not pan the map while the rectangle tool is active, and does again afterwards', () => {
    const map = makeMap();
    const cleanup = applyDrawTool(map, 'rectangle', 'en');
    expect(dragAcross(map)).toBe(false);

    cleanup();
    expect(dragAcross(map)).toBe(true);
  });

  it('the hint talks about corners, in the app language, for both steps', () => {
    const map = makeMap();
    applyDrawTool(map, 'rectangle', 'nl');
    expect(hintText(map)).toBe('Klik om de eerste hoek te plaatsen');

    clickAt(map, 100, 100);
    expect(hintText(map)).toBe('Klik om de tegenoverliggende hoek te plaatsen');
  });

  it('vertex hints do not replace the draw hint on Geoman\'s drawing markers', () => {
    const map = makeMap();
    applyDrawTool(map, 'rectangle', 'en');
    hintVertices(map, 'en');
    expect(hintText(map)).toBe('Click to place the first corner');

    clickAt(map, 100, 100);
    hintVertices(map, 'en');
    expect(hintText(map)).toBe('Click to place the opposite corner');
  });

  it('other tools keep Geoman\'s own wording and leave map panning alone', () => {
    const map = makeMap();
    applyDrawTool(map, 'rectangle', 'en')();
    applyDrawTool(map, 'line', 'en');

    const line = (map.pm.Draw as unknown as { Line: { _hintMarker?: L.Marker } }).Line;
    expect(line._hintMarker?.getTooltip()?.getContent()).toBe('Click to place first vertex');
    expect(dragAcross(map)).toBe(true);
  });
});

describe('hintVertices', () => {
  it('explains click-to-remove on vertices when no draw tool is active', () => {
    const map = makeMap();
    const vertex = L.marker([52, 4.5], { icon: L.divIcon({ className: 'marker-icon' }) }).addTo(map);
    const middle = L.marker([52, 4.5], {
      icon: L.divIcon({ className: 'marker-icon marker-icon-middle' })
    }).addTo(map);

    hintVertices(map, 'en');

    expect(vertex.getTooltip()?.getContent()).toBe('Drag or click to remove');
    expect(middle.getTooltip()).toBeUndefined();
  });
});
