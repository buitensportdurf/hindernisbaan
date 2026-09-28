import L from 'leaflet';
import { t, type Locale } from '$lib/i18n';
import type { DrawTool } from './drawTool';

const SHAPE_BY_TOOL = {
  point: 'Marker',
  landmark: 'Marker',
  line: 'Line',
  polygon: 'Polygon',
  rectangle: 'Rectangle'
} as const;

/**
 * Geoman's `firstVertex` is shared by every vertex-based shape, so rectangle copy is
 * swapped in per tool. `setLang` merges into its fallback table in place, so the
 * rectangle table is built on a key that doesn't exist: it holds only these strings,
 * and Geoman falls back to its own English for everything else.
 */
function applyDrawLanguage(map: L.Map, tool: DrawTool, locale: Locale): void {
  if (tool !== 'rectangle') {
    map.pm.setLang('en');
    return;
  }
  map.pm.setLang(
    `app-rectangle-${locale}` as never,
    {
      tooltips: {
        firstVertex: t(locale, 'design.draw.rectangle.start'),
        finishRect: t(locale, 'design.draw.rectangle.finish')
      }
    },
    'app-empty' as never
  );
}

/**
 * Switches Geoman into the draw or removal mode for `tool`. Returns a cleanup that
 * leaves no mode active. Rectangles are drawn click-click: map panning is off while
 * that tool is active, because Leaflet drops a click whose pointer moved a few pixels
 * (it counts as a pan) and the rectangle would never start or finish.
 */
export function applyDrawTool(map: L.Map, tool: DrawTool, locale: Locale): () => void {
  applyDrawLanguage(map, tool, locale);
  map.pm.disableDraw();
  map.pm.disableGlobalRemovalMode();

  if (tool === 'remove') {
    map.pm.enableGlobalRemovalMode();
  } else if (tool) {
    map.pm.enableDraw(SHAPE_BY_TOOL[tool]);
  }

  const lockPan = tool === 'rectangle';
  if (lockPan) map.dragging.disable();

  return () => {
    map.pm.disableDraw();
    map.pm.disableGlobalRemovalMode();
    if (lockPan) map.dragging.enable();
  };
}

/**
 * Middle markers grow into a plus on hover (CSS). Real vertices explain click-to-remove.
 * While drawing, Geoman's own markers (cursor, placed corners) share the `marker-icon`
 * class and carry its draw hint, so nothing is touched then.
 */
export function hintVertices(map: L.Map, locale: Locale): void {
  if (map.pm.globalDrawModeEnabled()) return;
  const removeHint = t(locale, 'design.vertex.remove');
  map.eachLayer((layer) => {
    if (!(layer instanceof L.Marker)) return;
    const el = layer.getElement();
    if (!el?.classList.contains('marker-icon') || el.classList.contains('marker-icon-middle')) return;
    if (layer.getTooltip()?.getContent() === removeHint) return;
    layer.unbindTooltip();
    layer.bindTooltip(removeHint, {
      direction: 'top',
      offset: [0, -12],
      opacity: 1,
      className: 'vertex-hint'
    });
  });
}
