import L from 'leaflet';
import type { InteractionController } from '$lib/interaction/controller.svelte';

const DOUBLE_TAP_MS = 350;
const OPENED_BY_TAP_MS = 400;

function isTouchOriginalEvent(originalEvent: Event | undefined): boolean {
  if (!originalEvent) return false;
  if (typeof TouchEvent !== 'undefined' && originalEvent instanceof TouchEvent) return true;
  return (originalEvent as PointerEvent).pointerType === 'touch';
}

/** Wire Leaflet/Geoman feature events to the shared interaction controller. */
export function bindFeatureInteraction(
  layer: L.Layer,
  featureId: string,
  controller: InteractionController
): void {
  let lastTapAt = 0;
  let openedByTapUntil = 0;

  layer.on('pm:dragstart', () => {
    if (!controller.gesturesEnabled) return;
    controller.gestureStart();
  });

  layer.on('pm:dragend', () => {
    if (!controller.gesturesEnabled) return;
    controller.gestureEnd();
  });

  layer.on('pm:rotatestart', () => {
    if (!controller.gesturesEnabled) return;
    controller.gestureStart();
  });

  layer.on('pm:rotateend', () => {
    if (!controller.gesturesEnabled) return;
    controller.gestureEnd();
  });

  layer.on('pm:markerdragstart', () => {
    if (!controller.gesturesEnabled) return;
    controller.gestureStart();
  });

  layer.on('pm:markerdragend', () => {
    if (!controller.gesturesEnabled) return;
    controller.gestureEnd();
  });

  layer.on('click', (e: L.LeafletMouseEvent) => {
    if (controller.clicksSuppressed || !controller.gesturesEnabled) return;

    L.DomEvent.stop(e);

    const now = Date.now();
    if (isTouchOriginalEvent(e.originalEvent) && now - lastTapAt < DOUBLE_TAP_MS) {
      lastTapAt = 0;
      openedByTapUntil = now + OPENED_BY_TAP_MS;
      controller.featureDoubleClick(featureId);
      return;
    }

    if (isTouchOriginalEvent(e.originalEvent)) {
      lastTapAt = now;
    } else {
      lastTapAt = 0;
    }

    controller.featureClick(featureId);
  });

  layer.on('dblclick', (e: L.LeafletMouseEvent) => {
    if (controller.clicksSuppressed || !controller.gesturesEnabled) return;

    L.DomEvent.stop(e);
    L.DomEvent.preventDefault(e.originalEvent);

    const now = Date.now();
    if (now < openedByTapUntil) {
      openedByTapUntil = 0;
      return;
    }

    controller.featureDoubleClick(featureId);
  });
}
