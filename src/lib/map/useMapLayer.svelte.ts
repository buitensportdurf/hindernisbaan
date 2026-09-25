import { getContext, untrack } from 'svelte';
import L from 'leaflet';

/**
 * Composable that owns the layerGroup lifecycle for a map layer component.
 * The setup callback receives the group and may return an optional extra cleanup.
 * Pass `key` to rebuild only when that value changes; setup then runs untracked
 * so unrelated reactive reads (a feature's name, for example) do not redraw the map.
 * Without `key`, reactive reads inside setup are tracked and the layer rebuilds
 * when any of them change.
 */
export function useMapLayer(
  setup: (group: L.LayerGroup) => (() => void) | void,
  key?: () => unknown
): void {
  const getMap = getContext<() => L.Map | undefined>('map');
  $effect(() => {
    key?.();
    const map = getMap();
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const cleanup = key ? untrack(() => setup(group)) : setup(group);
    return () => {
      cleanup?.();
      group.remove();
    };
  });
}
