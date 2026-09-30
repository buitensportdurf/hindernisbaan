<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import L from 'leaflet';
  import type { FeatureCollection } from 'geojson';
  import type { MapFeature } from '$lib/data/types';
  import { TILE_LAYERS, otherTile, TILE_ERROR_THRESHOLD, type TileKey } from './tiles';
  import { isGeomanHandleTarget, syncMapFeatureSelection } from './mapUtils';

  let {
    tile = 'map',
    fitFeatures,
    fitEpoch = 0,
    doubleClickZoom = true,
    selectedId = null,
    onReady,
    onFailover,
    onBothTilesDown,
    onBackgroundClick,
    clicksSuppressed,
    children
  }: {
    tile?: TileKey;
    fitFeatures?: MapFeature[] | null;
    /** Fit-to-features runs once per epoch — bump it to request a new fit. */
    fitEpoch?: number;
    doubleClickZoom?: boolean;
    selectedId?: string | null;
    onReady?: () => void;
    onFailover?: (next: TileKey) => void;
    onBothTilesDown?: () => void;
    onBackgroundClick?: () => void;
    clicksSuppressed?: () => boolean;
    children?: Snippet;
  } = $props();

  const CENTER: [number, number] = [52.027, 4.365];
  let el: HTMLDivElement;
  let map = $state<L.Map | undefined>(undefined);
  let layers: Partial<Record<TileKey, L.TileLayer>> = {};
  let active: TileKey | undefined;
  let failedOnce = false;
  let lastFitEpoch: number | undefined;

  setContext('map', () => map);

  $effect(() => {
    if (!map || !fitFeatures || fitFeatures.length === 0) return;
    if (fitEpoch === lastFitEpoch) return;
    const bounds = L.geoJSON({ type: 'FeatureCollection', features: fitFeatures } as FeatureCollection).getBounds();
    if (bounds.isValid()) {
      map.invalidateSize();
      // One step past the strict fit — features slightly overflow, labels are readable.
      const fitZoom = map.getBoundsZoom(bounds, false, L.point(48, 48));
      map.setView(bounds.getCenter(), Math.min(fitZoom + 1, 19));
      lastFitEpoch = fitEpoch;
    }
  });

  $effect(() => {
    if (!map) return;
    const activeMap = map;
    const id = selectedId;
    const sync = () => {
      queueMicrotask(() => syncMapFeatureSelection(activeMap, id));
    };
    sync();
    activeMap.on('layeradd', sync);
    return () => {
      activeMap.off('layeradd', sync);
    };
  });

  function makeLayer(key: TileKey): L.TileLayer {
    const def = TILE_LAYERS[key];
    let errors = 0;
    const layer = L.tileLayer(def.url, {
      maxZoom: def.maxZoom,
      maxNativeZoom: def.maxNativeZoom ?? def.maxZoom,
      subdomains: def.subdomains ?? 'abc',
      attribution: def.attribution,
      keepBuffer: 1,
      updateWhenIdle: true
    });
    layer.on('tileerror', () => {
      errors++;
      if (errors === TILE_ERROR_THRESHOLD) {
        if (!failedOnce) {
          failedOnce = true;
          onFailover?.(otherTile(key));
        } else {
          onBothTilesDown?.();
        }
      }
    });
    return layer;
  }

  function applyTile(key: TileKey) {
    if (!map) return;
    if (active && layers[active]) map.removeLayer(layers[active]!);
    if (!layers[key]) layers[key] = makeLayer(key);
    layers[key]!.addTo(map);
    active = key;
  }

  onMount(() => {
    map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      doubleClickZoom,
      // Half-level steps: integer snap jumps too far, 0.25 (test frames) felt sticky.
      zoomSnap: 0.5,
      zoomDelta: 0.5
    }).setView(CENTER, 17);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix(false);
    applyTile(tile);
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isGeomanHandleTarget(e.originalEvent.target)) return;
      if (clicksSuppressed?.()) return;
      onBackgroundClick?.();
    });
    onReady?.();
    const onFs = () => map?.invalidateSize();
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      map?.remove();
    };
  });

  $effect(() => {
    if (map && tile !== active) applyTile(tile);
  });
</script>

<div bind:this={el} style="position:absolute;inset:0;z-index:0"></div>
{@render children?.()}
