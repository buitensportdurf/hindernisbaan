import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import {
  bindFilledPathTooltip,
  keepLabelsInView,
  placeLabels,
  syncFilledPathTooltip,
  syncMapFeatureSelection,
  tooltipAnchor
} from './mapUtils';

/**
 * jsdom has no layout engine, so every element reports a 0x0 box by default.
 * placeLabels() measures real bubble size via getBoundingClientRect() — mock
 * a fixed, realistic size so the placement math has something to work with.
 */
const BUBBLE_SIZE = { width: 80, height: 24 };

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: BUBBLE_SIZE.width,
    height: BUBBLE_SIZE.height,
    top: 0,
    left: 0,
    right: BUBBLE_SIZE.width,
    bottom: BUBBLE_SIZE.height,
    x: 0,
    y: 0,
    toJSON() {}
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function makeMap(): L.Map {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // jsdom's SVG/Canvas feature detection doesn't clear Leaflet's default
  // renderer bar, so pick one explicitly instead of leaving it to auto-detect.
  return L.map(container, { center: [52, 4.5], zoom: 18, renderer: L.svg() });
}

describe('bindFilledPathTooltip — click no longer strands a hover tooltip at the feature center', () => {
  it('reopening via click keeps the tooltip at tooltipAnchor(), not the raw feature center', async () => {
    const map = makeMap();
    const line = L.polyline(
      [
        [52.001, 4.5],
        [52.0, 4.503],
        [51.999, 4.506]
      ],
      { weight: 16 }
    ).addTo(map);
    bindFilledPathTooltip(line, 'Test obstacle');

    // Real hover: Leaflet's internal handler opens the tooltip and our
    // 'tooltipopen' listener repositions it to tooltipAnchor() (top-center).
    line.fire('mouseover', { latlng: L.latLng(52.0005, 4.5015) });
    const tooltip = line.getTooltip()!;
    expect(tooltip.isOpen()).toBe(true);
    expect(tooltip.getLatLng()).toEqual(tooltipAnchor(line));

    // Real click while already hovering: Leaflet's own click handler re-opens
    // the tooltip and — regardless of any fix — synchronously resets it to
    // getCenter() first (Layer.Tooltip's _prepareOpen default). Without the
    // fix this is where it would stay, since 'tooltipopen' never re-fires for
    // an already-open tooltip.
    line.fire('click', { latlng: L.latLng(52.0005, 4.5015) });

    // The fix corrects it back via queueMicrotask; flush one microtask tick.
    await Promise.resolve();

    expect(tooltip.getLatLng()).toEqual(tooltipAnchor(line));
  });

  it('a move event (selection enabling drag) puts the tooltip back on tooltipAnchor()', async () => {
    const map = makeMap();
    const line = L.polyline(
      [
        [52.001, 4.5],
        [51.999, 4.506]
      ],
      { weight: 16 }
    ).addTo(map);
    bindFilledPathTooltip(line, 'Moved obstacle');
    line.fire('mouseover', { latlng: L.latLng(52, 4.503) });
    const tooltip = line.getTooltip()!;
    tooltip.setLatLng(line.getBounds().getCenter());

    line.fire('move', { latlng: line.getBounds().getCenter() });
    await Promise.resolve();

    expect(tooltip.getLatLng()).toEqual(tooltipAnchor(line));
  });

  it('a fresh (not previously open) tooltip opens directly at tooltipAnchor() on click', () => {
    const map = makeMap();
    const line = L.polyline(
      [
        [52.001, 4.5],
        [52.0, 4.503]
      ],
      { weight: 16 }
    ).addTo(map);
    bindFilledPathTooltip(line, 'Fresh obstacle');

    line.fire('click', { latlng: L.latLng(52.0005, 4.5015) });

    expect(line.getTooltip()!.getLatLng()).toEqual(tooltipAnchor(line));
  });

  it('a permanent label stays open after deselect (mouseout + move from Geoman disable)', async () => {
    const map = makeMap();
    map.setZoom(20);
    const line = L.polyline(
      [
        [52.001, 4.5],
        [52.0, 4.503]
      ],
      { weight: 16 }
    ).addTo(map);
    bindFilledPathTooltip(line, 'Permanent obstacle', map.getZoom());

    const tooltip = line.getTooltip()!;
    expect(tooltip.options.permanent).toBe(true);
    expect(tooltip.isOpen()).toBe(true);

    // Deselect path: mouse leaves the feature, Geoman disable fires `move`.
    line.fire('mouseout');
    line.fire('move', { latlng: line.getBounds().getCenter() });
    // Accidental close (Leaflet `remove` during handle teardown, etc.)
    line.closeTooltip();
    await Promise.resolve();

    expect(line.getTooltip()!.isOpen()).toBe(true);
    expect(line.getTooltip()!.getLatLng()).toEqual(tooltipAnchor(line));
  });
});

describe('filled path tooltip — fault text', () => {
  function openBubble(layer: L.CircleMarker): HTMLElement | null {
    layer.fire('mouseover', { latlng: layer.getLatLng() });
    return layer.getTooltip()?.getElement()?.querySelector('.tooltip-bubble') ?? null;
  }

  it('a nameless feature with a fault shows just the fault', () => {
    const map = makeMap();
    const marker = L.circleMarker(map.getCenter(), { radius: 5 }).addTo(map);
    bindFilledPathTooltip(marker, '', undefined, 0, 'Name missing');

    const bubble = openBubble(marker);
    expect(bubble?.textContent).toBe('Name missing');
    expect(bubble?.querySelector('.tooltip-fault')?.textContent).toBe('Name missing');
  });

  it('a named feature with a fault shows the name with the fault after it', () => {
    const map = makeMap();
    const marker = L.circleMarker(map.getCenter(), { radius: 5 }).addTo(map);
    bindFilledPathTooltip(marker, 'Combi', undefined, 1, 'No members');

    const bubble = openBubble(marker);
    expect(bubble?.firstChild?.textContent).toBe('Combi');
    expect(bubble?.querySelector('.tooltip-fault')?.textContent).toBe('No members');
  });

  it('sync binds a tooltip when a fault appears and swaps it for the name once fixed', () => {
    const map = makeMap();
    const marker = L.circleMarker(map.getCenter(), { radius: 5 }).addTo(map);
    syncFilledPathTooltip(marker, '');
    expect(marker.getTooltip()).toBeUndefined();

    syncFilledPathTooltip(marker, '', undefined, 0, 'Name missing');
    expect(marker.getTooltip()).toBeDefined();

    syncFilledPathTooltip(marker, 'Muur');
    const bubble = openBubble(marker);
    expect(bubble?.textContent).toBe('Muur');
    expect(bubble?.querySelector('.tooltip-fault')).toBeNull();
  });
});

describe('placeLabels — dense clusters no longer sacrifice labels that have room further out', () => {
  /** Deterministic tight packing — same generator used in the visual test harness. */
  function sunflowerPoints(n: number, scaleDeg: number, center: L.LatLng): L.LatLng[] {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const points: L.LatLng[] = [];
    for (let i = 0; i < n; i++) {
      const r = scaleDeg * Math.sqrt(i + 0.5);
      const theta = i * golden;
      points.push(L.latLng(center.lat + r * Math.sin(theta), center.lng + r * Math.cos(theta)));
    }
    return points;
  }

  it('rescues a label whose immediate ring is fully blocked by placing it on a wider ring', () => {
    const map = makeMap();
    const center = map.getCenter();
    const points = sunflowerPoints(14, 0.00004, center);

    const markers = points.map((ll, i) => {
      const marker = L.circleMarker(ll, { radius: 5 }).addTo(map);
      bindFilledPathTooltip(marker, 'Obstacle ' + (i + 1), map.getZoom(), 0);
      return marker;
    });

    placeLabels(map);

    const culled = markers.filter((m) => m.getTooltip()!.getElement()?.classList.contains('tooltip-culled'));
    // A single fixed-radius ring reliably strands the innermost, fully-surrounded
    // markers in this packing (verified against the pre-fix algorithm in the
    // visual harness); the ring-expansion fix should rescue all but at most one.
    expect(culled.length).toBeLessThanOrEqual(1);

    // Directly confirm the *mechanism*: at least one label had to step out past
    // the first ring's maximum reach (hw + bubble half-width + LABEL_EDGE_GAP =
    // 8 + 40 + 6 = 54px) to find a free spot — proving ring expansion actually
    // ran, not just that this cluster happened not to need it.
    const ring0MaxReach = 8 + 10 + BUBBLE_SIZE.width / 2 + 16;
    const usedWiderRing = markers.some((m) => {
      const tooltip = m.getTooltip()!;
      if (tooltip.getElement()?.classList.contains('tooltip-culled')) return false;
      const markerPt = map.latLngToContainerPoint(m.getLatLng());
      const labelPt = map.latLngToContainerPoint(tooltip.getLatLng()!);
      const dx = Math.abs(labelPt.x - markerPt.x);
      const dy = Math.abs(labelPt.y - markerPt.y);
      return Math.hypot(dx, dy) > ring0MaxReach;
    });
    expect(usedWiderRing).toBe(true);
  });

  it('a single isolated label is placed with no ring expansion needed', () => {
    const map = makeMap();
    const marker = L.circleMarker(map.getCenter(), { radius: 5 }).addTo(map);
    bindFilledPathTooltip(marker, 'Solo obstacle', map.getZoom(), 0);

    placeLabels(map);

    expect(marker.getTooltip()!.getElement()?.classList.contains('tooltip-culled')).toBe(false);
  });
});

describe('keepLabelsInView — labels stay inside the visible map', () => {
  it('moves a label that would leave the map back inside, and only when asked', () => {
    const map = makeMap();
    // jsdom maps have no size, so the centre sits at container (0, 0): the top-left corner.
    vi.spyOn(map, 'getSize').mockReturnValue(L.point(400, 300));
    const marker = L.circleMarker(map.getCenter(), { radius: 5 }).addTo(map);
    bindFilledPathTooltip(marker, 'Corner obstacle', map.getZoom(), 0);
    const labelBox = () => {
      const p = map.latLngToContainerPoint(marker.getTooltip()!.getLatLng()!);
      return { left: p.x - BUBBLE_SIZE.width / 2, top: p.y - BUBBLE_SIZE.height / 2 };
    };

    placeLabels(map);
    expect(labelBox().top).toBeLessThan(0);

    const release = keepLabelsInView(map, () => ({ top: 0, right: 0, bottom: 0, left: 0 }));
    placeLabels(map);
    expect(labelBox().left).toBeGreaterThanOrEqual(0);
    expect(labelBox().top).toBeGreaterThanOrEqual(0);
    expect(marker.getTooltip()!.getElement()?.classList.contains('tooltip-culled')).toBe(false);

    release();
    placeLabels(map);
    expect(labelBox().top).toBeLessThan(0);
  });
});

describe('syncMapFeatureSelection — hide other features\' name tooltips', () => {
  function taggedMarker(map: L.Map, id: string, name: string, latlng: L.LatLng): L.CircleMarker {
    const marker = L.circleMarker(latlng, { radius: 5 }).addTo(map);
    (marker as L.Layer & { feature?: { id: string } }).feature = { id };
    bindFilledPathTooltip(marker, name, map.getZoom(), 0);
    return marker;
  }

  it('hides non-selected permanent labels and keeps the selected one', () => {
    const map = makeMap();
    map.setZoom(20);
    const a = taggedMarker(map, 'a', 'Alpha', L.latLng(52.001, 4.5));
    const b = taggedMarker(map, 'b', 'Beta', L.latLng(52.0, 4.503));

    expect(a.getTooltip()!.isOpen()).toBe(true);
    expect(b.getTooltip()!.isOpen()).toBe(true);

    syncMapFeatureSelection(map, 'a');

    expect(a.getTooltip()!.getElement()?.classList.contains('tooltip-selection-hidden')).toBe(false);
    expect(b.getTooltip()!.getElement()?.classList.contains('tooltip-selection-hidden')).toBe(true);
    // Selected label stays open; others stay bound (permanent reopen) but are visually hidden.
    expect(a.getTooltip()!.isOpen()).toBe(true);
    expect(b.getTooltip()!.isOpen()).toBe(true);
  });

  it('shows all labels again when selection clears', () => {
    const map = makeMap();
    map.setZoom(20);
    const a = taggedMarker(map, 'a', 'Alpha', L.latLng(52.001, 4.5));
    const b = taggedMarker(map, 'b', 'Beta', L.latLng(52.0, 4.503));

    syncMapFeatureSelection(map, 'b');
    expect(a.getTooltip()!.getElement()?.classList.contains('tooltip-selection-hidden')).toBe(true);

    syncMapFeatureSelection(map, null);

    expect(a.getTooltip()!.getElement()?.classList.contains('tooltip-selection-hidden')).toBe(false);
    expect(b.getTooltip()!.getElement()?.classList.contains('tooltip-selection-hidden')).toBe(false);
  });

  it('hides a hover tooltip that opens on a non-selected feature', () => {
    const map = makeMap();
    // No permanentAtZoom — hover-only tooltips.
    const a = L.circleMarker(L.latLng(52.001, 4.5), { radius: 5 }).addTo(map);
    const b = L.circleMarker(L.latLng(52.0, 4.503), { radius: 5 }).addTo(map);
    (a as L.Layer & { feature?: { id: string } }).feature = { id: 'a' };
    (b as L.Layer & { feature?: { id: string } }).feature = { id: 'b' };
    bindFilledPathTooltip(a, 'Alpha');
    bindFilledPathTooltip(b, 'Beta');

    syncMapFeatureSelection(map, 'a');
    b.fire('mouseover', { latlng: L.latLng(52.0, 4.503) });

    expect(b.getTooltip()!.isOpen()).toBe(true);
    expect(b.getTooltip()!.getElement()?.classList.contains('tooltip-selection-hidden')).toBe(true);
  });
});
