import { getContext } from 'svelte';
import L from 'leaflet';

/**
 * Composable that owns the layerGroup lifecycle for a map layer component.
 * The setup callback receives the group and may return an optional extra cleanup.
 * Reactive reads inside setup are tracked by $effect — the layer rebuilds when
 * any reactive value (props, state) changes.
 */
export function useMapLayer(setup: (group: L.LayerGroup) => (() => void) | void): void {
  const getMap = getContext<() => L.Map | undefined>('map');
  $effect(() => {
    const map = getMap();
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const cleanup = setup(group);
    return () => {
      cleanup?.();
      group.remove();
    };
  });
}
