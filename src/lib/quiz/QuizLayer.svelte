<script lang="ts">
  import { getContext, mount, unmount, untrack } from 'svelte';
  import L from 'leaflet';
  import type { LandmarkFeature } from '$lib/data/types';
  import LandmarkPill from '$lib/map/LandmarkPill.svelte';
  import { useMapLayer } from '$lib/map/useMapLayer.svelte';
  import {
    FILLED_PATH_STYLE,
    bindPlacedLabel,
    escapeHtml,
    keepLabelsInView,
    roundPolygonCorners,
    unbindPlacedLabel
  } from '$lib/map/mapUtils';
  import type { Quizzable } from './quiz';
  import type { QuizView, StampKind } from './view';

  let {
    features,
    landmarks,
    view,
    stamps,
    animateStamps = true,
    reducedMotion = false,
    padding,
    onTap
  }: {
    features: Quizzable[];
    landmarks: LandmarkFeature[];
    view: QuizView;
    stamps: Record<string, StampKind>;
    /** New stamps drop in with a ripple; off when reopening a finished run. */
    animateStamps?: boolean;
    reducedMotion?: boolean;
    /** Screen space covered by the rail and the sheet, measured when the camera moves. */
    padding: () => { top: number; bottom: number };
    onTap?: (id: string) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  type Shape = {
    feature: Quizzable;
    /** Drawn paths that take the state classes. */
    visuals: L.Path[];
    /** Receives taps and carries the stamp label. */
    anchor: L.Path;
    bounds: L.LatLngBounds;
  };

  const LINE_STYLE = { lineCap: 'round', lineJoin: 'round', interactive: false } as const;
  /** Placement order: names you still have to learn get the best spots. */
  const STAMP_TIER: Record<StampKind, number> = { reveal: 3, known: 2, missed: 1 };
  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  let shapes = new Map<string, Shape>();
  let shapesVersion = $state(0);
  const bound = new Map<string, StampKind>();
  let tappable = false;
  let framedKey: string | null = null;

  const toLatLng = ([lng, lat]: [number, number]) => L.latLng(lat, lng);

  function featureBounds(f: Quizzable): L.LatLngBounds {
    const g = f.geometry;
    const pts = g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates[0];
    return L.latLngBounds(pts.map(toLatLng));
  }

  function outline(f: Quizzable, style: L.PathOptions): L.Path {
    const g = f.geometry;
    if (g.type === 'Point') return L.circleMarker(toLatLng(g.coordinates), { ...style, radius: 5 });
    if (g.type === 'LineString') return L.polyline(g.coordinates.map(toLatLng), { ...LINE_STYLE, ...style });
    const latlngs = g.coordinates.map((ring) => ring.map(toLatLng));
    if (f.properties.kind !== 'combi') return L.polygon(latlngs, style);
    const rect = L.rectangle(L.latLngBounds(latlngs[0]), style);
    rect.setLatLngs(latlngs);
    roundPolygonCorners(rect);
    return rect;
  }

  // Label placement measures the bubble, so only the face inside it animates.
  function stampHtml(kind: StampKind, name: string, fresh: 'no' | 'now' | 'late'): string {
    const cls = ['quiz-stamp-face', `quiz-stamp--${kind}`];
    if (fresh !== 'no') cls.push('quiz-stamp--new');
    if (fresh === 'late') cls.push('quiz-stamp--late');
    const body =
      kind === 'known'
        ? `<span class="quiz-stamp-tick">${CHECK_SVG}</span>${escapeHtml(name)}`
        : kind === 'missed'
          ? '?'
          : escapeHtml(name);
    return `<span class="tooltip-bubble quiz-stamp"><span class="${cls.join(' ')}">${body}</span></span>`;
  }

  function ripple(s: Shape, kind: StampKind): void {
    const map = getMap();
    if (!map) return;
    const late = kind === 'reveal' ? ' quiz-ripple--late' : '';
    const marker = L.marker(s.bounds.getCenter(), {
      icon: L.divIcon({
        html: `<div class="quiz-ripple quiz-ripple--${kind}${late}"></div>`,
        className: 'quiz-ripple-host',
        iconSize: [0, 0]
      }),
      interactive: false,
      keyboard: false
    }).addTo(map);
    setTimeout(() => marker.remove(), 1400);
  }

  const geometryKey = $derived(
    features.map((f) => `${f.id}:${f.properties.name}:${JSON.stringify(f.geometry.coordinates)}`).join('\n')
  );

  useMapLayer((group) => {
    const next = new Map<string, Shape>();
    // Points last so their hit circles sit on top of combis they stand in.
    const rank = (f: Quizzable) => (f.properties.kind === 'combi' ? 0 : f.geometry.type === 'Point' ? 2 : 1);
    for (const f of [...features].sort((a, b) => rank(a) - rank(b))) {
      let visuals: L.Path[];
      let anchor: L.Path;
      if (f.geometry.type === 'LineString') {
        const outer = outline(f, { weight: 13, color: '#00a5e3', className: 'quiz-shape quiz-line' });
        const inner = outline(f, { weight: 5, color: '#ffffff', className: 'quiz-line-inner' });
        anchor = outline(f, { weight: 26, opacity: 0, interactive: true, className: 'quiz-hit' });
        visuals = [outer, inner];
      } else if (f.geometry.type === 'Point') {
        const dot = outline(f, { ...FILLED_PATH_STYLE, interactive: false, className: 'quiz-shape quiz-fill' });
        anchor = L.circleMarker(toLatLng(f.geometry.coordinates), {
          radius: 18,
          stroke: false,
          fillOpacity: 0,
          className: 'quiz-hit'
        });
        visuals = [dot];
      } else {
        anchor = outline(f, { ...FILLED_PATH_STYLE, className: 'quiz-shape quiz-fill' });
        visuals = [anchor];
      }
      for (const v of visuals) group.addLayer(v);
      if (!visuals.includes(anchor)) group.addLayer(anchor);
      (anchor as L.Layer & { feature?: Quizzable }).feature = f;
      anchor.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stop(e);
        if (tappable) onTap?.(f.id);
      });
      next.set(f.id, { feature: f, visuals, anchor, bounds: featureBounds(f) });
    }
    shapes = next;
    bound.clear();
    framedKey = null;
    shapesVersion += 1;
    return () => {
      for (const s of next.values()) unbindPlacedLabel(s.anchor);
      bound.clear();
      shapes = new Map();
    };
  }, () => geometryKey);

  const landmarkKey = $derived(
    landmarks
      .map((f) => `${f.id}:${f.properties.icon}:${f.properties.name}:${JSON.stringify(f.geometry.coordinates)}`)
      .join('\n')
  );

  useMapLayer((group) => {
    const components: ReturnType<typeof mount>[] = [];
    for (const f of landmarks) {
      const container = document.createElement('div');
      components.push(
        mount(LandmarkPill, { target: container, props: { icon: f.properties.icon, name: f.properties.name } })
      );
      const [lng, lat] = f.geometry.coordinates;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: container,
          className: 'landmark-marker quiz-landmark',
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        }),
        interactive: false,
        keyboard: false
      });
      // Stamps avoid landmark pills during label placement.
      (marker as L.Layer & { feature?: LandmarkFeature }).feature = f;
      group.addLayer(marker);
    }
    return () => components.forEach((c) => unmount(c));
  }, () => landmarkKey);

  // Test-mode map: muted tiles. Zoom snap lives on MapCanvas so wheel/pinch match other modes.
  $effect(() => {
    const map = getMap();
    if (!map) return;
    const container = map.getContainer();
    container.classList.add('quiz-map');
    return () => {
      container.classList.remove('quiz-map', 'quiz-tappable', 'quiz-hide-landmarks');
    };
  });

  $effect(() => {
    tappable = view.tappable;
    const container = getMap()?.getContainer();
    container?.classList.toggle('quiz-tappable', view.tappable);
    container?.classList.toggle('quiz-hide-landmarks', view.hideLandmarks);
  });

  $effect(() => {
    shapesVersion;
    const { targetId, pickedId, rightId, wrongId, dimOthers } = view;
    for (const [id, s] of shapes) {
      for (const v of s.visuals) {
        const el = v.getElement();
        if (!el) continue;
        el.classList.toggle('is-dim', dimOthers && id !== targetId);
        el.classList.toggle('is-target', id === targetId);
        el.classList.toggle('is-picked', id === pickedId);
        el.classList.toggle('is-right', id === rightId);
        el.classList.toggle('is-wrong', id === wrongId);
      }
    }
  });

  $effect(() => {
    shapesVersion;
    const map = getMap();
    const s = view.halo && view.targetId ? shapes.get(view.targetId) : undefined;
    if (!map || !s) return;
    const halo = outline(s.feature, {
      color: '#00a5e3',
      weight: 14,
      fill: false,
      interactive: false,
      className: 'quiz-halo'
    }).addTo(map);
    const late = outline(s.feature, {
      color: '#00a5e3',
      weight: 14,
      fill: false,
      interactive: false,
      className: 'quiz-halo quiz-halo--late'
    }).addTo(map);
    halo.bringToBack();
    late.bringToBack();
    return () => {
      halo.remove();
      late.remove();
    };
  });

  $effect(() => {
    shapesVersion;
    const next = stamps;
    const animate = animateStamps && !reducedMotion;
    untrack(() => {
      for (const [id, kind] of Object.entries(next)) {
        const s = shapes.get(id);
        if (!s || bound.get(id) === kind) continue;
        const fresh = animate && kind !== 'missed';
        bindPlacedLabel(
          s.anchor,
          stampHtml(kind, s.feature.properties.name, fresh ? (kind === 'reveal' ? 'late' : 'now') : 'no'),
          STAMP_TIER[kind]
        );
        bound.set(id, kind);
        if (fresh) ripple(s, kind);
      }
      for (const id of [...bound.keys()]) {
        if (id in next) continue;
        const s = shapes.get(id);
        if (s) unbindPlacedLabel(s.anchor);
        bound.delete(id);
      }
    });
  });

  $effect(() => {
    shapesVersion;
    const { frameKey, frameIds, maxZoom, frameShift } = view;
    const map = getMap();
    if (!map || shapes.size === 0 || frameKey === framedKey) return;
    const frame = requestAnimationFrame(() => {
      const list = frameIds.length
        ? frameIds.flatMap((id) => shapes.get(id) ?? [])
        : [...shapes.values()];
      if (list.length === 0) return;
      const bounds = L.latLngBounds([]);
      for (const s of list) bounds.extend(s.bounds);
      if (frameShift) bounds.extend(toLatLng(frameShift));
      const pad = padding();
      const opts = {
        paddingTopLeft: L.point(24, pad.top + 20),
        paddingBottomRight: L.point(24, pad.bottom + 20),
        maxZoom
      };
      if (framedKey === null || reducedMotion) map.fitBounds(bounds, { ...opts, animate: false });
      else map.flyToBounds(bounds, { ...opts, duration: 0.48 });
      framedKey = frameKey;
    });
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    const map = getMap();
    if (!map) return;
    return keepLabelsInView(map, () => {
      const pad = padding();
      return { top: pad.top + 6, right: 6, bottom: pad.bottom + 6, left: 6 };
    });
  });
</script>
