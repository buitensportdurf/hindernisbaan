import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { bindFeatureInteraction } from './featureGestures';
import type { InteractionController } from '$lib/interaction/controller.svelte';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function makeMap(): L.Map {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return L.map(container, { center: [52, 4.5], zoom: 18, renderer: L.svg() });
}

type FakeController = {
  clicksSuppressed: boolean;
  gesturesEnabled: boolean;
  featureClick: ReturnType<typeof vi.fn>;
  featureDoubleClick: ReturnType<typeof vi.fn>;
  gestureStart: ReturnType<typeof vi.fn>;
  gestureEnd: ReturnType<typeof vi.fn>;
};

function makeFakeController(overrides: Partial<FakeController> = {}): FakeController {
  let clicksSuppressed = overrides.clicksSuppressed ?? false;
  return {
    get clicksSuppressed() {
      return clicksSuppressed;
    },
    set clicksSuppressed(value: boolean) {
      clicksSuppressed = value;
    },
    gesturesEnabled: overrides.gesturesEnabled ?? true,
    featureClick: overrides.featureClick ?? vi.fn(),
    featureDoubleClick: overrides.featureDoubleClick ?? vi.fn(),
    gestureStart: overrides.gestureStart ?? vi.fn(),
    gestureEnd: overrides.gestureEnd ?? vi.fn()
  };
}

function mouseOriginalEvent(): Event {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as Event;
}

function touchOriginalEvent(): Event {
  return {
    pointerType: 'touch',
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as Event;
}

describe('bindFeatureInteraction', () => {
  let map: L.Map;
  let layer: L.Polyline;

  beforeEach(() => {
    map = makeMap();
    layer = L.polyline(
      [
        [52.001, 4.5],
        [52.0, 4.503]
      ],
      { weight: 8 }
    ).addTo(map);
  });

  it('double-click calls featureDoubleClick exactly once', () => {
    const controller = makeFakeController();
    bindFeatureInteraction(layer, 'f1', controller as unknown as InteractionController);

    const originalEvent = mouseOriginalEvent();
    layer.fire('click', { latlng: L.latLng(52.0005, 4.5015), originalEvent });
    layer.fire('dblclick', { latlng: L.latLng(52.0005, 4.5015), originalEvent });

    expect(controller.featureDoubleClick).toHaveBeenCalledTimes(1);
    expect(controller.featureDoubleClick).toHaveBeenCalledWith('f1');
  });

  it('after gestureStart + gestureEnd, click is ignored while clicksSuppressed', () => {
    const controller = makeFakeController();
    bindFeatureInteraction(layer, 'f1', controller as unknown as InteractionController);

    layer.fire('pm:dragstart');
    layer.fire('pm:dragend');
    expect(controller.gestureStart).toHaveBeenCalledTimes(1);
    expect(controller.gestureEnd).toHaveBeenCalledTimes(1);

    controller.clicksSuppressed = true;
    layer.fire('click', {
      latlng: L.latLng(52.0005, 4.5015),
      originalEvent: mouseOriginalEvent()
    });

    expect(controller.featureClick).not.toHaveBeenCalled();
  });

  it('does not call featureClick when clicksSuppressed is true', () => {
    const controller = makeFakeController({ clicksSuppressed: true });
    bindFeatureInteraction(layer, 'f1', controller as unknown as InteractionController);

    layer.fire('click', {
      latlng: L.latLng(52.0005, 4.5015),
      originalEvent: mouseOriginalEvent()
    });

    expect(controller.featureClick).not.toHaveBeenCalled();
  });

  it('touch double-tap calls featureDoubleClick once; second tap does not featureClick', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);

    const controller = makeFakeController();
    bindFeatureInteraction(layer, 'f1', controller as unknown as InteractionController);

    const originalEvent = touchOriginalEvent();
    layer.fire('click', { latlng: L.latLng(52.0005, 4.5015), originalEvent });
    vi.setSystemTime(1_000_100);
    layer.fire('click', { latlng: L.latLng(52.0005, 4.5015), originalEvent });

    expect(controller.featureDoubleClick).toHaveBeenCalledTimes(1);
    expect(controller.featureDoubleClick).toHaveBeenCalledWith('f1');
    // First tap selects; second tap is the double and must not also featureClick.
    expect(controller.featureClick).toHaveBeenCalledTimes(1);
  });
});
