<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import L from 'leaflet';
  import type { FeatureCollection } from 'geojson';
  import type { MapFeature } from '$lib/data/types';
  import { TILE_LAYERS, otherTile, TILE_ERROR_THRESHOLD, type TileKey } from './tiles';
  import { isGeomanHandleTarget, isFeatureSurfaceTarget, shouldSuppressMapDeselect } from './mapUtils';

  let {
    tile = 'map',
    fitFeatures,
    doubleClickZoom = true,
    onReady,
    onFailover,
    onBothTilesDown,
    onDeselect,
    children
  }: {
    tile?: TileKey;
    fitFeatures?: MapFeature[] | null;
    doubleClickZoom?: boolean;
    onReady?: () => void;
    onFailover?: (next: TileKey) => void;
    onBothTilesDown?: () => void;
    onDeselect?: () => void;
    children?: Snippet;
  } = $props();

  const CENTER: [number, number] = [52.027, 4.365];
  let el: HTMLDivElement;
  let map = $state<L.Map | undefined>(undefined);
  let layers: Partial<Record<TileKey, L.TileLayer>> = {};
  let active: TileKey | undefined;
  let failedOnce = false;
  let lastFitKey = '';

  function fitKey(features: MapFeature[]): string {
    return features
      .map((f) => f.id)
      .sort()
      .join('|');
  }

  setContext('map', () => map);

  $effect(() => {
    if (!map || !fitFeatures || fitFeatures.length === 0) return;
    const key = fitKey(fitFeatures);
    if (lastFitKey === key) return;
    const bounds = L.geoJSON({ type: 'FeatureCollection', features: fitFeatures } as FeatureCollection).getBounds();
    if (bounds.isValid()) {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 });
      lastFitKey = key;
    }
  });

  function makeLayer(key: TileKey): L.TileLayer {
    const def = TILE_LAYERS[key];
    let errors = 0;
    const layer = L.tileLayer(def.url, {
      maxZoom: def.maxZoom,
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
      doubleClickZoom
    }).setView(CENTER, 16);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix(false);
    applyTile(tile);
    map.on('click', (e: L.LeafletMouseEvent) => {
      const suppressed = shouldSuppressMapDeselect();
      const geomanHandle = isGeomanHandleTarget(e.originalEvent.target);
      const featureSurface = isFeatureSurfaceTarget(e.originalEvent.target);
      if (suppressed || geomanHandle || featureSurface) return;
      onDeselect?.();
    });
    onReady?.();
    return () => map?.remove();
  });

  $effect(() => {
    if (map && tile !== active) applyTile(tile);
  });
</script>

<div bind:this={el} style="position:absolute;inset:0;z-index:0"></div>
{@render children?.()}
