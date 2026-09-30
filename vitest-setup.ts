import '@testing-library/jest-dom/vitest';

// Svelte bind:clientWidth uses ResizeObserver, which jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom's SVGElement has no createSVGRect, which Leaflet's Browser.svg
// feature-detection relies on — without it, Leaflet silently falls back
// through Canvas (also unavailable in jsdom) to a null renderer, and any
// Path layer (polyline, polygon, circleMarker) throws on addTo(map).
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.createSVGRect) {
  // @ts-expect-error - minimal stub, only its presence is checked by Leaflet
  SVGElement.prototype.createSVGRect = function () {
    return { x: 0, y: 0, width: 0, height: 0 };
  };
}
