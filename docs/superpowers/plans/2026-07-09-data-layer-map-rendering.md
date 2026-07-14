# Data Layer & Map Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load and validate the GeoJSON data file; render obstacles by geometry type (Point→dot, LineString→line, Polygon→shape), combis as rectangle fences with member count, landmarks as permanent pills; wire selection with map-background deselect; add the "map data" row to Settings; blocking load-failure dialog (Retry / Import); non-blocking tiles-unavailable dialog; a dev-only tweaks panel for dialling in selected-state styles; and CI pipeline.

**Architecture:** App state gains `features`, `dataVersion`, `selectedId`, `loadError`, `loadState`. A separate `tweaks.svelte.ts` holds dev-only visual tuning params as module-level `$state`. AppShell fetches data on mount and shows a `LoadFailDialog` on error. MapCanvas exposes the Leaflet map via Svelte context and fires `onDeselect` on bare map clicks; layer components stop propagation on marker clicks to prevent bubbling. ObstacleLayer branches on geometry type; CombiLayer renders rectangle fences (rectangle draw enforced in the Design plan; freeform polygon is a deferred advanced feature); LandmarkLayer mounts `LandmarkPill.svelte` into DivIcon containers via `mount()`. Schema at `src/lib/data/obstacles.schema.json`.

**Tech Stack:** AJV v8 (JSON Schema validation, runtime + CI), `@lucide/svelte` (already installed), Svelte 5 `mount()`/`unmount()` for DivIcon components, GitHub Actions CI, CSS custom properties for tweakable selected-state design tokens.

## Global Constraints

- **SPA only, no backend** — same as Plan 1.
- **Svelte 5 runes** — `$state`, `$derived`, `$props`, `$effect`. No Svelte 4 stores.
- **No Vitest for Svelte components** (deferred per spec §5). Pure-logic modules (`loader.ts`) get Vitest tests.
- **AJV v8** (`ajv@^8`) — install as `dependencies` (runs in the browser and in CI). JSON Schema Draft-07.
- **Schema path:** `src/lib/data/obstacles.schema.json` — imported by the loader as `./obstacles.schema.json`; referenced by CI script as `src/lib/data/obstacles.schema.json`.
- **Data path:** `static/data/obstacles.geojson` — served at `/data/obstacles.geojson`.
- **Lucide icons:** `@lucide/svelte/icons/<name>` tree-shakable imports (package already in devDependencies). `LandmarkPill.svelte` supports these names: `flag`, `users`, `car`, `bike`, `parking`, `toilet`, `map-pin` (fallback). Unknown names fall back to `map-pin`.
- **Lift effect** — applied via CSS class `selected` on the Leaflet marker's DOM element. Obstacle: also `setRadius(11)` + `weight: 3` when selected. Combi: `weight: 3` when selected. Landmark: CSS scale on the pill div.
- **Single `$effect` per layer** tracking both `features` and `selectedId` — re-creates markers on every change. MVP trade-off: simple, correct, imperceptible for ≤ 100 features.
- **Bok blauw** = `#00A5E3`. Ink = `#373737`. Card radius = `1rem`.
- **`durf:` localStorage namespace** — no new keys in this plan.
- **Map center** still `[52.027, 4.365]` zoom 16 — data bounds override in a future plan.
- **pnpm** — use `pnpm add` / `pnpm install`, not `npm`.
- **Obstacle geometry rendering:** Point → `L.circleMarker` dot; LineString → `L.polyline`; Polygon → `L.polygon` with solid (non-dashed) fill — distinguishes obstacle polygons from combi fences visually.
- **Combi shape:** rectangles by default. The rectangle draw constraint is enforced in the Design plan (Plan 5); freeform polygon draw is a deferred advanced feature.
- **Map-click deselect:** `map.on('click', () => onDeselect?.())` in MapCanvas `onMount`. All marker/layer click handlers call `L.DomEvent.stopPropagation(e)` before `onSelect()` to prevent the click bubbling to the map.
- **Selected-state design tokens:** CSS custom properties (`--sel-obs-glow`, `--sel-landmark-scale`, etc.) with defaults in `app.css`. The tweaks panel writes to `document.documentElement.style.setProperty()` for CSS values; Leaflet-specific values (radius, weight, fill-opacity) live in `tweaks.svelte.ts` as module-level `$state` and are read by layer components directly.
- **TweaksPanel is dev-only:** rendered only when `import.meta.env.DEV && selectedId !== null`. No URL param needed; Vite tree-shakes it out of production builds.
- **Feature IDs are plain UUIDs** (`crypto.randomUUID()` at draw time in Plan 5). Schema pattern: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. IDs in `types.ts` are typed as `string` — no separate `UUID` branded type; TypeScript has no built-in UUID type and the schema is the enforcement layer. Gaps from deletions are acceptable.

---

## File Structure

```
src/lib/data/obstacles.schema.json   — JSON Schema (single source of truth)
src/lib/data/types.ts                — TS types (FeatureCollection, MapFeature, Member, …)
src/lib/data/loader.ts               — fetchFeatures(), parseFeatures(), LoadError
src/lib/data/loader.test.ts          — Vitest tests for loader logic

src/lib/components/LoadFailDialog.svelte   — blocking dialog: error + Retry + Import file
src/lib/components/TilesDownDialog.svelte  — non-blocking dialog: tiles unavailable + Dismiss

src/lib/map/ObstacleLayer.svelte     — Point→CircleMarker, LineString→Polyline, Polygon→Polygon; tooltip; .selected lift; reads tweaks
src/lib/map/CombiLayer.svelte        — rectangle Polygon fence + count DivIcon at centroid + tooltip + .selected lift; reads tweaks
src/lib/map/LandmarkLayer.svelte     — permanent pill DivIcon via mount(LandmarkPill) + .selected lift
src/lib/map/LandmarkPill.svelte      — Svelte component: Lucide icon + name, styled as white pill
src/lib/map/TweaksPanel.svelte       — dev-only selected-state style editor (CSS vars + Leaflet params via tweaks)
src/lib/state/tweaks.svelte.ts       — module-level $state for all tunable selected-state params

static/data/obstacles.geojson        — sample data (7 features: 4 obstacles, 1 combi, 2 landmarks)
.github/workflows/ci.yml             — CI: svelte-check, eslint+prettier, schema-validate, vite build

Modify:
src/lib/i18n/dict.ts                 — add load.*, tiles.down.* keys
src/lib/state/app.svelte.ts          — add features/dataVersion/selectedId/loadError/loadState state + setData/setLoadError/setLoadState/selectFeature methods
src/lib/map/MapCanvas.svelte         — add setContext('map', …), children snippet, onDeselect prop + map.on('click') wiring
src/lib/components/AppShell.svelte   — fetch data in onMount, show LoadFailDialog, render layer + TweaksPanel children
src/lib/components/Menu.svelte       — add Map data section in Settings
src/app.css                          — CSS custom property design tokens + .obstacle-dot/.line/.poly, .combi-fence, .landmark-pill, .selected styles
```

---

## Task 1: TypeScript types + JSON schema + sample data

**Files:**
- Create: `src/lib/data/types.ts`
- Create: `src/lib/data/obstacles.schema.json`
- Create: `static/data/obstacles.geojson`

**Interfaces:**
- Produces:
  - `type Geometry = PointGeometry | LineStringGeometry | PolygonGeometry`
  - `interface Member { name: string; notes?: string; position?: [number, number] }`
  - `interface ObstacleFeature`, `CombiFeature`, `LandmarkFeature` with discriminated `properties.kind`
  - `type MapFeature = ObstacleFeature | CombiFeature | LandmarkFeature`
  - `interface FeatureCollection { type: 'FeatureCollection'; version: string; features: MapFeature[] }`

- [ ] **Step 1: Create `src/lib/data/types.ts`**

```ts
export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number];
}

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type Geometry = PointGeometry | LineStringGeometry | PolygonGeometry;

export interface Member {
  name: string;
  notes?: string;
  position?: [number, number];
}

interface BaseProperties {
  name: string;
  notes?: string;
}

export interface ObstacleProperties extends BaseProperties {
  kind: 'obstacle';
}

export interface CombiProperties extends BaseProperties {
  kind: 'combi';
  members: Member[];
}

export interface LandmarkProperties extends BaseProperties {
  kind: 'landmark';
  icon: string;
}

export interface ObstacleFeature {
  type: 'Feature';
  id: string;
  geometry: Geometry;
  properties: ObstacleProperties;
}

export interface CombiFeature {
  type: 'Feature';
  id: string;
  geometry: PolygonGeometry;
  properties: CombiProperties;
}

export interface LandmarkFeature {
  type: 'Feature';
  id: string;
  geometry: PointGeometry;
  properties: LandmarkProperties;
}

export type MapFeature = ObstacleFeature | CombiFeature | LandmarkFeature;

export interface FeatureCollection {
  type: 'FeatureCollection';
  version: string;
  features: MapFeature[];
}
```

- [ ] **Step 2: Create `src/lib/data/obstacles.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "obstacles.schema.json",
  "title": "Hindernisbaan Feature Collection",
  "type": "object",
  "required": ["type", "version", "features"],
  "additionalProperties": false,
  "properties": {
    "type": { "type": "string", "const": "FeatureCollection" },
    "version": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "features": {
      "type": "array",
      "items": { "$ref": "#/$defs/Feature" }
    }
  },
  "$defs": {
    "Feature": {
      "type": "object",
      "required": ["type", "id", "geometry", "properties"],
      "additionalProperties": false,
      "properties": {
        "type": { "type": "string", "const": "Feature" },
        "id": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
        "geometry": { "$ref": "#/$defs/Geometry" },
        "properties": { "$ref": "#/$defs/Properties" }
      }
    },
    "Geometry": {
      "oneOf": [
        { "$ref": "#/$defs/PointGeometry" },
        { "$ref": "#/$defs/LineStringGeometry" },
        { "$ref": "#/$defs/PolygonGeometry" }
      ]
    },
    "PointGeometry": {
      "type": "object",
      "required": ["type", "coordinates"],
      "additionalProperties": false,
      "properties": {
        "type": { "type": "string", "const": "Point" },
        "coordinates": {
          "type": "array",
          "items": { "type": "number" },
          "minItems": 2,
          "maxItems": 3
        }
      }
    },
    "LineStringGeometry": {
      "type": "object",
      "required": ["type", "coordinates"],
      "additionalProperties": false,
      "properties": {
        "type": { "type": "string", "const": "LineString" },
        "coordinates": {
          "type": "array",
          "items": {
            "type": "array",
            "items": { "type": "number" },
            "minItems": 2,
            "maxItems": 3
          },
          "minItems": 2
        }
      }
    },
    "PolygonGeometry": {
      "type": "object",
      "required": ["type", "coordinates"],
      "additionalProperties": false,
      "properties": {
        "type": { "type": "string", "const": "Polygon" },
        "coordinates": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "type": "array",
              "items": { "type": "number" },
              "minItems": 2,
              "maxItems": 3
            },
            "minItems": 4
          },
          "minItems": 1
        }
      }
    },
    "Properties": {
      "oneOf": [
        { "$ref": "#/$defs/ObstacleProperties" },
        { "$ref": "#/$defs/CombiProperties" },
        { "$ref": "#/$defs/LandmarkProperties" }
      ]
    },
    "ObstacleProperties": {
      "type": "object",
      "required": ["name", "kind"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "kind": { "type": "string", "const": "obstacle" },
        "notes": { "type": "string" }
      }
    },
    "CombiProperties": {
      "type": "object",
      "required": ["name", "kind", "members"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "kind": { "type": "string", "const": "combi" },
        "notes": { "type": "string" },
        "members": {
          "type": "array",
          "items": { "$ref": "#/$defs/Member" },
          "minItems": 1
        }
      }
    },
    "LandmarkProperties": {
      "type": "object",
      "required": ["name", "kind", "icon"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "kind": { "type": "string", "const": "landmark" },
        "icon": { "type": "string", "minLength": 1 },
        "notes": { "type": "string" }
      }
    },
    "Member": {
      "type": "object",
      "required": ["name"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "notes": { "type": "string" },
        "position": {
          "type": "array",
          "items": { "type": "number" },
          "minItems": 2,
          "maxItems": 2
        }
      }
    }
  }
}
```

- [ ] **Step 3: Create `static/data/obstacles.geojson`**

Seven features covering all three kinds. Coordinates are realistic positions on/around the Durf obstacle course plot in Delft (center `[52.027, 4.365]`).

```json
{
  "type": "FeatureCollection",
  "version": "2026-07-09",
  "features": [
    {
      "type": "Feature",
      "id": "a1b2c3d4-0001-4000-8000-e0f1a2b3c4d5",
      "geometry": { "type": "Point", "coordinates": [4.3648, 52.0272] },
      "properties": { "name": "Klimrek", "kind": "obstacle" }
    },
    {
      "type": "Feature",
      "id": "a1b2c3d4-0002-4000-8000-e0f1a2b3c4d5",
      "geometry": {
        "type": "LineString",
        "coordinates": [[4.3651, 52.027], [4.3653, 52.0271], [4.3655, 52.027]]
      },
      "properties": {
        "name": "Balkenpad",
        "kind": "obstacle",
        "notes": "Vijf balken op gelijke hoogte, gevorderd niveau"
      }
    },
    {
      "type": "Feature",
      "id": "a1b2c3d4-0003-4000-8000-e0f1a2b3c4d5",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [4.366, 52.0268],
            [4.3664, 52.0268],
            [4.3664, 52.027],
            [4.366, 52.027],
            [4.366, 52.0268]
          ]
        ]
      },
      "properties": { "name": "Zandbak", "kind": "obstacle" }
    },
    {
      "type": "Feature",
      "id": "a1b2c3d4-0004-4000-8000-e0f1a2b3c4d5",
      "geometry": { "type": "Point", "coordinates": [4.3656, 52.0267] },
      "properties": {
        "name": "Touwenparcours",
        "kind": "obstacle",
        "notes": "Zes stations, begin bij de paal met het rode lint"
      }
    },
    {
      "type": "Feature",
      "id": "a1b2c3d4-0005-4000-8000-e0f1a2b3c4d5",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [4.3643, 52.0274],
            [4.365, 52.0274],
            [4.365, 52.0278],
            [4.3643, 52.0278],
            [4.3643, 52.0274]
          ]
        ]
      },
      "properties": {
        "name": "Trapeziumzone",
        "kind": "combi",
        "members": [
          { "name": "Schommel", "position": [4.3645, 52.0275] },
          { "name": "Ladder", "position": [4.3647, 52.0276] },
          { "name": "Touw", "position": [4.3649, 52.0275] }
        ]
      }
    },
    {
      "type": "Feature",
      "id": "a1b2c3d4-0006-4000-8000-e0f1a2b3c4d5",
      "geometry": { "type": "Point", "coordinates": [4.3638, 52.0268] },
      "properties": { "name": "Ingang", "kind": "landmark", "icon": "flag" }
    },
    {
      "type": "Feature",
      "id": "a1b2c3d4-0007-4000-8000-e0f1a2b3c4d5",
      "geometry": { "type": "Point", "coordinates": [4.367, 52.0265] },
      "properties": {
        "name": "Parkeerplaats",
        "kind": "landmark",
        "icon": "car",
        "notes": "Gratis parkeren, max 2 uur"
      }
    }
  ]
}
```

- [ ] **Step 4: Manually validate the sample data against the schema**

Run: `node -e "const Ajv=require('ajv');const a=new Ajv();const s=require('./src/lib/data/obstacles.schema.json');const d=require('./static/data/obstacles.geojson');const v=a.compile(s);console.log(v(d)?'VALID':a.errorsText(v.errors))"`

Expected output: `VALID`

If it prints errors, fix the GeoJSON or schema before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/types.ts src/lib/data/obstacles.schema.json static/data/obstacles.geojson
git commit -m "feat: add feature types, JSON schema, and sample obstacle data"
```

---

## Task 2: Data loader + AJV

**Files:**
- Create: `src/lib/data/loader.ts`, `src/lib/data/loader.test.ts`
- Modify: `package.json` (add `ajv` to dependencies)

**Interfaces:**
- Produces:
  - `class LoadError extends Error` with `cause?: unknown`
  - `fetchFeatures(url?: string): Promise<FeatureCollection>` — fetches `/data/obstacles.geojson`, parses, validates against schema
  - `parseFeatures(text: string): Promise<FeatureCollection>` — parses a JSON string (no fetch), validates

- [ ] **Step 1: Install AJV**

```bash
pnpm add ajv@^8
```

- [ ] **Step 2: Write the failing test**

`src/lib/data/loader.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchFeatures, parseFeatures, LoadError } from './loader';

const validCollection = {
  type: 'FeatureCollection',
  version: '2026-07-09',
  features: [
    {
      type: 'Feature',
      id: 'a1b2c3d4-0001-4000-8000-e0f1a2b3c4d5',
      geometry: { type: 'Point', coordinates: [4.3648, 52.0272] },
      properties: { name: 'Klimrek', kind: 'obstacle' }
    }
  ]
};

afterEach(() => vi.restoreAllMocks());

describe('parseFeatures', () => {
  it('accepts valid GeoJSON', async () => {
    const result = await parseFeatures(JSON.stringify(validCollection));
    expect(result.type).toBe('FeatureCollection');
    expect(result.version).toBe('2026-07-09');
    expect(result.features).toHaveLength(1);
  });

  it('throws LoadError on malformed JSON', async () => {
    await expect(parseFeatures('not json')).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when type is not FeatureCollection', async () => {
    const bad = { ...validCollection, type: 'Random' };
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when version is missing', async () => {
    const { version: _v, ...bad } = validCollection;
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when a feature id is not a valid UUID', async () => {
    const bad = {
      ...validCollection,
      features: [{ ...validCollection.features[0], id: 'not-a-uuid' }]
    };
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when kind is unknown', async () => {
    const bad = {
      ...validCollection,
      features: [
        {
          ...validCollection.features[0],
          properties: { name: 'x', kind: 'unknown' }
        }
      ]
    };
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });
});

describe('fetchFeatures', () => {
  it('returns parsed collection on HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(validCollection) })
    );
    const result = await fetchFeatures('/data/obstacles.geojson');
    expect(result.features).toHaveLength(1);
  });

  it('throws LoadError on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    );
    await expect(fetchFeatures('/data/obstacles.geojson')).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when fetch itself throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchFeatures('/data/obstacles.geojson')).rejects.toBeInstanceOf(LoadError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- loader`
Expected: FAIL — cannot resolve `./loader`.

- [ ] **Step 4: Write `src/lib/data/loader.ts`**

```ts
import Ajv from 'ajv';
import schema from './obstacles.schema.json';
import type { FeatureCollection } from './types';

const ajv = new Ajv();
const validate = ajv.compile(schema);

export class LoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LoadError';
  }
}

function assertValid(data: unknown): asserts data is FeatureCollection {
  if (!validate(data)) {
    throw new LoadError(`Invalid map data: ${ajv.errorsText(validate.errors)}`);
  }
}

export async function fetchFeatures(
  url = '/data/obstacles.geojson'
): Promise<FeatureCollection> {
  let data: unknown;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    throw new LoadError(
      err instanceof Error ? err.message : 'Failed to fetch map data',
      err
    );
  }
  assertValid(data);
  return data;
}

export async function parseFeatures(text: string): Promise<FeatureCollection> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new LoadError('Invalid JSON in file', err);
  }
  assertValid(data);
  return data;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- loader`
Expected: all 8 tests PASS.

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass (i18n, storage, tiles, loader).

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/loader.ts src/lib/data/loader.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add data loader with AJV schema validation"
```

---

## Task 3: i18n additions + app state extensions + dialogs + wiring

**Files:**
- Modify: `src/lib/i18n/dict.ts` — add `load.*` and `tiles.down.*` keys
- Modify: `src/lib/state/app.svelte.ts` — add `features`, `dataVersion`, `selectedId`, `loadError`, `loadState` + methods
- Create: `src/lib/components/LoadFailDialog.svelte`
- Create: `src/lib/components/TilesDownDialog.svelte`
- Modify: `src/lib/map/MapCanvas.svelte` — add context, children snippet, wire `onBothTilesDown`
- Modify: `src/lib/components/AppShell.svelte` — fetch data, render layers, show dialogs
- Modify: `src/app.css` — add marker CSS

**Interfaces:**
- Consumes: `fetchFeatures`, `parseFeatures`, `LoadError` from `$lib/data/loader`; `FeatureCollection`, `MapFeature`, `ObstacleFeature`, `CombiFeature`, `LandmarkFeature` from `$lib/data/types`
- Produces:
  - `app.features: MapFeature[]`, `app.obstacles: ObstacleFeature[]`, `app.combis: CombiFeature[]`, `app.landmarks: LandmarkFeature[]`
  - `app.dataVersion: string | null`, `app.dataCount: number`
  - `app.selectedId: string | null`, `app.loadError: string | null`
  - `app.loadState: 'idle' | 'loading' | 'error' | 'loaded'`
  - `app.setData(col: FeatureCollection): void`, `app.setLoadError(msg: string): void`, `app.setLoadState(s: 'idle' | 'loading'): void`, `app.selectFeature(id: string | null): void`
  - Context key `'map'` in MapCanvas: `() => L.Map | undefined` — a getter that returns undefined until `onMount` finishes

- [ ] **Step 1: Add new i18n keys to `src/lib/i18n/dict.ts`**

The new keys go between `'ls.body'` and the closing of each locale object. Add them to **both** `nl` and `en`:

New `nl` entries:
```ts
'load.title': 'Kaartgegevens niet beschikbaar',
'load.body': 'De kaartgegevens konden niet worden geladen.',
'load.retry': 'Opnieuw proberen',
'load.import': 'Ander bestand importeren…',
'tiles.down.title': 'Kaartlagen niet beschikbaar',
'tiles.down.body': 'Probeer het later opnieuw. De obstakels zijn nog zichtbaar.',
'tiles.down.dismiss': 'Sluiten',
```

New `en` entries:
```ts
'load.title': 'Map data unavailable',
'load.body': 'The map data could not be loaded.',
'load.retry': 'Try again',
'load.import': 'Import another file…',
'tiles.down.title': 'Map tiles unavailable',
'tiles.down.body': 'Try again later. Obstacles are still visible.',
'tiles.down.dismiss': 'Dismiss',
```

After editing, run: `pnpm test -- i18n`
Expected: PASS (the test checks every `nl` key has an `en` counterpart).

- [ ] **Step 2: Extend `src/lib/state/app.svelte.ts`**

Replace the entire file with:

```ts
import { resolveInitialLocale, LANG_KEY, type Locale } from '$lib/i18n';
import { resolveInitialTile } from '$lib/map/tiles';
import type { TileKey } from '$lib/map/tiles';
import { readKey, writeKey } from '$lib/storage/local';
import type {
  FeatureCollection,
  MapFeature,
  ObstacleFeature,
  CombiFeature,
  LandmarkFeature
} from '$lib/data/types';

export type MenuLevel = 'root' | 'settings';
export type LoadState = 'idle' | 'loading' | 'error' | 'loaded';

export function createAppState() {
  let locale = $state<Locale>(
    resolveInitialLocale(
      readKey(LANG_KEY),
      typeof navigator !== 'undefined' ? navigator.language : undefined
    )
  );
  let tile = $state<TileKey>(resolveInitialTile(readKey('durf:tile')));
  let menuOpen = $state(false);
  let menuLevel = $state<MenuLevel>('root');

  let features = $state<MapFeature[]>([]);
  let dataVersion = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let loadError = $state<string | null>(null);
  let loadState = $state<LoadState>('idle');

  return {
    get locale() { return locale; },
    get tile() { return tile; },
    get menuOpen() { return menuOpen; },
    get menuLevel() { return menuLevel; },
    get features() { return features; },
    get dataVersion() { return dataVersion; },
    get dataCount() { return features.length; },
    get selectedId() { return selectedId; },
    get loadError() { return loadError; },
    get loadState() { return loadState; },
    get obstacles(): ObstacleFeature[] {
      return features.filter((f): f is ObstacleFeature => f.properties.kind === 'obstacle');
    },
    get combis(): CombiFeature[] {
      return features.filter((f): f is CombiFeature => f.properties.kind === 'combi');
    },
    get landmarks(): LandmarkFeature[] {
      return features.filter((f): f is LandmarkFeature => f.properties.kind === 'landmark');
    },

    setLocale(l: Locale) { locale = l; writeKey(LANG_KEY, l); },
    setTile(k: TileKey) { tile = k; writeKey('durf:tile', k); menuOpen = false; },
    failoverTile(k: TileKey) { tile = k; },
    toggleMenu() {
      if (!menuOpen) { menuOpen = true; menuLevel = 'root'; }
      else if (menuLevel === 'settings') { menuLevel = 'root'; }
      else { menuOpen = false; }
    },
    closeMenu() { menuOpen = false; menuLevel = 'root'; },
    gotoSettings() { menuLevel = 'settings'; },

    setData(col: FeatureCollection) {
      features = col.features;
      dataVersion = col.version;
      loadError = null;
      loadState = 'loaded';
    },
    setLoadError(msg: string) {
      loadError = msg;
      loadState = 'error';
    },
    setLoadState(s: 'idle' | 'loading') {
      loadState = s;
    },
    selectFeature(id: string | null) {
      selectedId = id;
    }
  };
}

export type AppState = ReturnType<typeof createAppState>;
```

- [ ] **Step 3: Create `src/lib/components/LoadFailDialog.svelte`**

```svelte
<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';

  let {
    locale,
    error,
    onRetry,
    onImport
  }: {
    locale: Locale;
    error: string;
    onRetry: () => void;
    onImport: (text: string) => void;
  } = $props();

  let fileInput: HTMLInputElement;

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    onImport(text);
    (e.target as HTMLInputElement).value = '';
  }
</script>

<div
  class="fixed inset-0 z-[1600] flex items-center justify-center bg-black/60 p-5"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="load-fail-title"
>
  <div
    class="flex w-[min(92vw,380px)] flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-xl"
  >
    <div class="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
      <AlertCircleIcon class="size-6 text-destructive" />
    </div>

    <div>
      <p id="load-fail-title" class="text-base font-semibold text-foreground">
        {t(locale, 'load.title')}
      </p>
      <p class="mt-1 text-sm text-muted-foreground">{error}</p>
    </div>

    <div class="flex w-full flex-col gap-2">
      <Button onclick={onRetry} class="w-full">{t(locale, 'load.retry')}</Button>
      <Button variant="outline" class="w-full" onclick={() => fileInput.click()}>
        {t(locale, 'load.import')}
      </Button>
    </div>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept=".geojson,application/geo+json,application/json"
    class="hidden"
    onchange={handleFileChange}
  />
</div>
```

- [ ] **Step 4: Create `src/lib/components/TilesDownDialog.svelte`**

```svelte
<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import WifiOffIcon from '@lucide/svelte/icons/wifi-off';

  let { locale, onDismiss }: { locale: Locale; onDismiss: () => void } = $props();
</script>

<div
  class="fixed bottom-20 left-1/2 z-[1500] -translate-x-1/2"
  role="status"
  aria-live="polite"
>
  <div
    class="flex items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-lg"
  >
    <WifiOffIcon class="size-4 shrink-0" />
    <div>
      <p class="text-sm font-semibold">{t(locale, 'tiles.down.title')}</p>
      <p class="text-xs opacity-80">{t(locale, 'tiles.down.body')}</p>
    </div>
    <Button
      variant="ghost"
      size="sm"
      class="ml-2 shrink-0 text-background hover:bg-white/20 hover:text-background"
      onclick={onDismiss}
    >
      {t(locale, 'tiles.down.dismiss')}
    </Button>
  </div>
</div>
```

- [ ] **Step 5: Update `src/lib/map/MapCanvas.svelte` — add context and children snippet**

Replace the entire file with:

```svelte
<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import L from 'leaflet';
  import { TILE_LAYERS, otherTile, TILE_ERROR_THRESHOLD, type TileKey } from './tiles';

  let {
    tile = 'map',
    fitFeatures,
    onReady,
    onFailover,
    onBothTilesDown,
    onDeselect,
    children
  }: {
    tile?: TileKey;
    fitFeatures?: import('$lib/data/types').MapFeature[] | null;
    onReady?: () => void;
    onFailover?: (next: TileKey) => void;
    onBothTilesDown?: () => void;
    onDeselect?: () => void;
    children?: Snippet;
  } = $props();

  let hasFit = false;

  $effect(() => {
    if (!map || !fitFeatures || fitFeatures.length === 0 || hasFit) return;
    const bounds = L.geoJSON({ type: 'FeatureCollection', features: fitFeatures }).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 });
      hasFit = true;
    }
  });

  const CENTER: [number, number] = [52.027, 4.365];
  let el: HTMLDivElement;
  let map: L.Map | undefined;
  let layers: Partial<Record<TileKey, L.TileLayer>> = {};
  let active: TileKey | undefined;
  let failedOnce = false;

  setContext('map', () => map);

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
    map = L.map(el, { zoomControl: false, attributionControl: true }).setView(CENTER, 16);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix(false);
    applyTile(tile);
    map.on('click', () => onDeselect?.());
    onReady?.();
    return () => map?.remove();
  });

  $effect(() => {
    if (map && tile !== active) applyTile(tile);
  });
</script>

<div bind:this={el} style="position:absolute;inset:0;z-index:0"></div>
{@render children?.()}
```

- [ ] **Step 6: Update `src/lib/components/AppShell.svelte`**

Replace the entire file with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import MapCanvas from '$lib/map/MapCanvas.svelte';
  import Menu from './Menu.svelte';
  import LoadFailDialog from './LoadFailDialog.svelte';
  import TilesDownDialog from './TilesDownDialog.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { fetchFeatures, parseFeatures, LoadError } from '$lib/data/loader';

  const app = createAppState();

  let tilesDown = $state(false);

  async function load() {
    app.setLoadState('loading');
    try {
      const col = await fetchFeatures();
      app.setData(col);
    } catch (err) {
      app.setLoadError(err instanceof LoadError ? err.message : 'Onbekende fout / Unknown error');
    }
  }

  async function handleImport(text: string) {
    try {
      const col = await parseFeatures(text);
      app.setData(col);
    } catch (err) {
      app.setLoadError(
        err instanceof LoadError ? err.message : 'Ongeldig bestand / Invalid file'
      );
    }
  }

  onMount(load);
</script>

<div class="fixed inset-0 overflow-hidden">
  <MapCanvas
    tile={app.tile}
    fitFeatures={app.loadState === 'loaded' ? app.features : null}
    onFailover={(n) => app.failoverTile(n)}
    onBothTilesDown={() => (tilesDown = true)}
    onDeselect={() => app.selectFeature(null)}
  >
  </MapCanvas>

  <Menu {app} />

  {#if app.loadState === 'error' && app.loadError}
    <LoadFailDialog
      locale={app.locale}
      error={app.loadError}
      onRetry={load}
      onImport={handleImport}
    />
  {/if}

  {#if tilesDown}
    <TilesDownDialog locale={app.locale} onDismiss={() => (tilesDown = false)} />
  {/if}
</div>
```

- [ ] **Step 7: Add marker CSS to `src/app.css`**

Append to `src/app.css`:

```css
/* Selected-state design tokens — defaults; TweaksPanel overrides via setProperty() in dev */
:root {
  --sel-obs-glow: drop-shadow(0 2px 8px rgba(0, 165, 227, 0.7));
  --sel-line-glow: drop-shadow(0 2px 8px rgba(0, 165, 227, 0.5));
  --sel-poly-glow: drop-shadow(0 2px 10px rgba(0, 165, 227, 0.5));
  --sel-combi-glow: drop-shadow(0 2px 10px rgba(0, 165, 227, 0.5));
  --sel-landmark-scale: 1.06;
  --sel-landmark-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  --sel-landmark-y-lift: 8px;
}

/* Obstacle — Point */
.obstacle-dot { transition: r 150ms ease, stroke-width 150ms ease; }
.obstacle-dot.selected { filter: var(--sel-obs-glow); }

/* Obstacle — LineString */
.obstacle-line { transition: stroke-width 150ms ease; }
.obstacle-line.selected { filter: var(--sel-line-glow); }

/* Obstacle — Polygon */
.obstacle-poly { transition: stroke-width 150ms ease; }
.obstacle-poly.selected { filter: var(--sel-poly-glow); }

/* Combi polygon fence */
.combi-fence { transition: stroke-width 150ms ease; }
.combi-fence.selected { filter: var(--sel-combi-glow); }

/* Combi member count badge */
.combi-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 12px;
  background: #00a5e3;
  color: #fff;
  font: 700 12px/1 'Geist', sans-serif;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

/* Landmark pill */
.landmark-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 6px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
  font: 600 12px/1 'Geist', sans-serif;
  color: #373737;
  white-space: nowrap;
  transform: translate(-50%, calc(-100% - 6px));
  transition: transform 150ms ease, box-shadow 150ms ease;
  pointer-events: auto;
  cursor: pointer;
}
.landmark-pill svg { flex-shrink: 0; width: 13px; height: 13px; color: #00a5e3; }
.landmark-marker.selected .landmark-pill {
  transform: translate(-50%, calc(-100% - var(--sel-landmark-y-lift))) scale(var(--sel-landmark-scale));
  box-shadow: var(--sel-landmark-shadow);
}
```

- [ ] **Step 8: Verify the app loads data and shows load-fail dialog**

Run: `pnpm run check && pnpm run dev`

Expected:
- `svelte-check` reports 0 type errors.
- In the browser: the app loads, briefly shows the hardcoded Delft center, then once data arrives the map auto-fits to the bounding box of all 7 sample features. With no markers yet (marker layers land in Tasks 4-6) you won't see them, but the viewport shift confirms `fitBounds` fired.
- To test the error dialog: temporarily rename `static/data/obstacles.geojson` to `obstacles.geojson.bak`, reload. A blocking dialog appears with `load.title`, `load.body`, two buttons. Clicking Retry retries the fetch. The import button opens a file picker. Restore the file after verifying.
- To test tiles-down dialog: there is no easy way to test it without network manipulation; leave it for manual testing after both tile providers are unreachable.

- [ ] **Step 9: Commit**

```bash
git add src/lib/i18n/dict.ts src/lib/state/app.svelte.ts \
  src/lib/components/LoadFailDialog.svelte src/lib/components/TilesDownDialog.svelte \
  src/lib/map/MapCanvas.svelte src/lib/components/AppShell.svelte src/app.css
git commit -m "feat: data state, load-fail dialog, tiles-down dialog, MapCanvas context"
```

---

## Task 4: ObstacleLayer

**Files:**
- Create: `src/lib/map/ObstacleLayer.svelte`
- Modify: `src/lib/components/AppShell.svelte` (add ObstacleLayer inside MapCanvas)

**Interfaces:**
- Consumes: context `'map'` → `() => L.Map | undefined`; props `features: ObstacleFeature[]`, `selectedId: string | null`, `onSelect: (id: string | null) => void`
- Produces: Bok-blauw CircleMarker per obstacle feature at its point/line/polygon centroid. Tooltip shows name. Click sets selection. Selected marker: radius 11, weight 3, CSS class `selected` (drop-shadow glow).

- [ ] **Step 1: Write `src/lib/map/ObstacleLayer.svelte`**

Branches on `f.geometry.type`: Point → `L.circleMarker`, LineString → `L.polyline`, Polygon → `L.polygon` (solid fill, not dashed). All three call `L.DomEvent.stopPropagation(e)` on click. Leaflet-specific selected values come from `tweaks`.

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import type { ObstacleFeature } from '$lib/data/types';
  import { tweaks } from '$lib/state/tweaks.svelte';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: ObstacleFeature[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  $effect(() => {
    const map = getMap();
    if (!map) return;

    const group = L.layerGroup().addTo(map);

    for (const f of features) {
      const isSelected = f.id === selectedId;
      const g = f.geometry;
      let layer: L.CircleMarker | L.Polyline | L.Polygon;

      if (g.type === 'Point') {
        layer = L.circleMarker([g.coordinates[1], g.coordinates[0]], {
          radius: isSelected ? tweaks.obsRadius : 8,
          color: '#ffffff',
          weight: isSelected ? tweaks.obsWeight : 2,
          fillColor: '#00a5e3',
          fillOpacity: 1,
          className: 'obstacle-dot' + (isSelected ? ' selected' : '')
        });
      } else if (g.type === 'LineString') {
        layer = L.polyline(
          g.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
          {
            color: '#00a5e3',
            weight: isSelected ? tweaks.lineWeight : 3,
            lineCap: 'round',
            lineJoin: 'round',
            className: 'obstacle-line' + (isSelected ? ' selected' : '')
          }
        );
      } else {
        layer = L.polygon(
          g.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]),
          {
            color: '#00a5e3',
            weight: isSelected ? tweaks.polyWeight : 2,
            fillColor: '#00a5e3',
            fillOpacity: isSelected ? tweaks.polyFillOpacity : 0.1,
            className: 'obstacle-poly' + (isSelected ? ' selected' : '')
          }
        );
      }

      layer.bindTooltip(f.properties.name, { direction: 'top', offset: [0, -8], opacity: 1 });
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(layer);
    }

    return () => group.remove();
  });
</script>
```

- [ ] **Step 2: Add ObstacleLayer to `src/lib/components/AppShell.svelte`**

In AppShell's `<script>`, add import:
```ts
import ObstacleLayer from '$lib/map/ObstacleLayer.svelte';
```

Inside the `<MapCanvas ...>` element (between the tags), add:
```svelte
<ObstacleLayer
  features={app.obstacles}
  selectedId={app.selectedId}
  onSelect={(id) => app.selectFeature(id)}
/>
```

- [ ] **Step 3: Manually verify obstacle rendering**

Run: `pnpm run dev`, open the browser.

Expected: four Bok-blauw dots appear on the map at the obstacle positions (Klimrek at ~52.0272, Balkenpad as a line midpoint, Zandbak as polygon centroid, Touwenparcours as a dot). Hovering over any dot shows the obstacle name as a tooltip. Clicking a dot changes it to a larger/bolder glow dot. Clicking again (same dot) or the map should deselect — currently clicking the map won't deselect (detail panel in Plan 3 handles dismissal); that's expected for now.

- [ ] **Step 4: Commit**

```bash
git add src/lib/map/ObstacleLayer.svelte src/lib/components/AppShell.svelte
git commit -m "feat: obstacle dot markers with tooltip and selection lift"
```

---

## Task 5: CombiLayer

**Files:**
- Create: `src/lib/map/CombiLayer.svelte`
- Modify: `src/lib/components/AppShell.svelte` (add CombiLayer inside MapCanvas)

**Interfaces:**
- Consumes: context `'map'`; props `features: CombiFeature[]`, `selectedId: string | null`, `onSelect: (id: string | null) => void`
- Produces: Bok-blauw dashed polygon fence per combi feature. A count DivIcon (member count badge) sits at the polygon's bounds center. Tooltip on polygon shows combi name. Click selects. Selection: weight 3 + CSS `selected` (glow).

- [ ] **Step 1: Write `src/lib/map/CombiLayer.svelte`**

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import type { CombiFeature } from '$lib/data/types';
  import { tweaks } from '$lib/state/tweaks.svelte';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: CombiFeature[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  $effect(() => {
    const map = getMap();
    if (!map) return;

    const group = L.layerGroup().addTo(map);

    for (const f of features) {
      const isSelected = f.id === selectedId;

      const latlngs = f.geometry.coordinates[0].map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );

      const polygon = L.polygon(latlngs, {
        color: '#00a5e3',
        weight: isSelected ? tweaks.combiWeight : 2,
        dashArray: '6 4',
        lineCap: 'round',
        lineJoin: 'round',
        fillColor: '#00a5e3',
        fillOpacity: isSelected ? tweaks.combiFillOpacity : 0.08,
        className: 'combi-fence' + (isSelected ? ' selected' : '')
      });

      polygon.bindTooltip(f.properties.name, {
        direction: 'top',
        opacity: 1
      });

      polygon.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(polygon);

      const center = polygon.getBounds().getCenter();
      const countIcon = L.divIcon({
        html: `<div class="combi-count">${f.properties.members.length}</div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      const countMarker = L.marker(center, { icon: countIcon, interactive: false });
      group.addLayer(countMarker);
    }

    return () => group.remove();
  });
</script>
```

- [ ] **Step 2: Add CombiLayer to `src/lib/components/AppShell.svelte`**

In AppShell's `<script>`, add import:
```ts
import CombiLayer from '$lib/map/CombiLayer.svelte';
```

Inside `<MapCanvas ...>`, after `<ObstacleLayer .../>`, add:
```svelte
<CombiLayer
  features={app.combis}
  selectedId={app.selectedId}
  onSelect={(id) => app.selectFeature(id)}
/>
```

- [ ] **Step 3: Manually verify combi rendering**

Run: `pnpm run dev`, open the browser.

Expected: the Trapeziumzone combi appears as a dashed Bok-blauw polygon fence. A blue badge showing `3` (the member count) is centered on the polygon. Hovering the polygon shows "Trapeziumzone" as a tooltip. Clicking the polygon selects it (glow + heavier border). Clicking again doesn't deselect (Plan 3 handles that); expected for now.

- [ ] **Step 4: Commit**

```bash
git add src/lib/map/CombiLayer.svelte src/lib/components/AppShell.svelte
git commit -m "feat: combi polygon fence with member count badge and selection lift"
```

---

## Task 6: LandmarkLayer + LandmarkPill

**Files:**
- Create: `src/lib/map/LandmarkPill.svelte`
- Create: `src/lib/map/LandmarkLayer.svelte`
- Modify: `src/lib/components/AppShell.svelte` (add LandmarkLayer inside MapCanvas)

**Interfaces:**
- Consumes: context `'map'`; props `features: LandmarkFeature[]`, `selectedId: string | null`, `onSelect: (id: string | null) => void`
- Produces: a permanent white pill marker (icon + name) at each landmark's point coordinates. The pill is always visible (no hover needed). Click selects. Selection: CSS `selected` on the marker element (pill scales up + stronger shadow). `LandmarkPill.svelte` is a renderless Svelte component mounted via `mount()` into a DivIcon container div, so it can use `@lucide/svelte` icons normally.

- [ ] **Step 1: Write `src/lib/map/LandmarkPill.svelte`**

This is a Svelte component that renders the pill contents. It's mounted into a DOM element via `mount()` — it is not used directly in templates.

```svelte
<script lang="ts">
  import FlagIcon from '@lucide/svelte/icons/flag';
  import UsersIcon from '@lucide/svelte/icons/users';
  import CarIcon from '@lucide/svelte/icons/car';
  import BikeIcon from '@lucide/svelte/icons/bike';
  import ParkingIcon from '@lucide/svelte/icons/square-parking';
  import ToiletIcon from '@lucide/svelte/icons/toilet';
  import MapPinIcon from '@lucide/svelte/icons/map-pin';
  import type { Component } from 'svelte';

  let { icon, name }: { icon: string; name: string } = $props();

  const ICON_MAP: Record<string, Component> = {
    flag: FlagIcon,
    users: UsersIcon,
    car: CarIcon,
    bike: BikeIcon,
    parking: ParkingIcon,
    toilet: ToiletIcon
  };

  const IconComp = $derived(ICON_MAP[icon] ?? MapPinIcon);
</script>

<div class="landmark-pill">
  <IconComp />
  <span>{name}</span>
</div>
```

- [ ] **Step 2: Write `src/lib/map/LandmarkLayer.svelte`**

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import { mount, unmount } from 'svelte';
  import L from 'leaflet';
  import type { LandmarkFeature } from '$lib/data/types';
  import LandmarkPill from './LandmarkPill.svelte';

  let {
    features,
    selectedId,
    onSelect
  }: {
    features: LandmarkFeature[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  $effect(() => {
    const map = getMap();
    if (!map) return;

    const group = L.layerGroup().addTo(map);
    const components: ReturnType<typeof mount>[] = [];

    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      const isSelected = f.id === selectedId;

      const container = document.createElement('div');
      const comp = mount(LandmarkPill, {
        target: container,
        props: { icon: f.properties.icon, name: f.properties.name }
      });
      components.push(comp);

      const divIcon = L.divIcon({
        html: container,
        className: 'landmark-marker' + (isSelected ? ' selected' : ''),
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const marker = L.marker([lat, lng], { icon: divIcon, riseOnHover: true });
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      if (f.properties.notes) {
        marker.bindTooltip(f.properties.notes, { direction: 'top', offset: [0, -32], opacity: 1 });
      }
      group.addLayer(marker);
    }

    return () => {
      components.forEach((c) => unmount(c));
      group.remove();
    };
  });
</script>
```

- [ ] **Step 3: Add LandmarkLayer to `src/lib/components/AppShell.svelte`**

In AppShell's `<script>`, add import:
```ts
import LandmarkLayer from '$lib/map/LandmarkLayer.svelte';
```

Inside `<MapCanvas ...>`, after `<CombiLayer .../>`, add:
```svelte
<LandmarkLayer
  features={app.landmarks}
  selectedId={app.selectedId}
  onSelect={(id) => app.selectFeature(id)}
/>
```

- [ ] **Step 4: Manually verify landmark rendering**

Run: `pnpm run dev`, open the browser.

Expected: two white pills appear on the map — `⚑ Ingang` and a car-icon `Parkeerplaats`. Both are always visible without hovering. Clicking either pill selects it (pill scales up slightly, stronger shadow). The Parkeerplaats landmark has notes, so hovering shows them as a tooltip.

Verify the icon renders correctly for both `flag` and `car`. If a landmark with an unmapped icon name were added, it should fall back to a `map-pin` icon.

- [ ] **Step 5: Commit**

```bash
git add src/lib/map/LandmarkPill.svelte src/lib/map/LandmarkLayer.svelte \
  src/lib/components/AppShell.svelte
git commit -m "feat: landmark permanent pill markers with Lucide icons and selection lift"
```

---

## Task 7: Settings map-data row + CI pipeline

**Files:**
- Modify: `src/lib/components/Menu.svelte` — add Map data section in Settings panel
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `app.dataVersion: string | null`, `app.dataCount: number`, `t(locale, 'settings.mapdata')`, `t(locale, 'settings.mapdata.created')`, `t(locale, 'settings.mapdata.count')`
- Produces: CI pipeline; Settings panel shows "Kaartgegevens — Aangemaakt {version} · {N} objecten" (or empty when not yet loaded).

- [ ] **Step 1: Add Map data section to `src/lib/components/Menu.svelte`**

In the Settings panel (inside `{:else}` block, after the language section), add before the final `{/if}`:

Find this block in Menu.svelte:
```svelte
          <section class="flex flex-col gap-1.5">
            <p class={sectionLabel}>
              <LanguagesIcon class="size-3" />
              {t(app.locale, 'settings.language')}
            </p>
```

Add a new import at the top of the `<script>` block:
```ts
import DatabaseIcon from '@lucide/svelte/icons/database';
```

Then add after the language section and before the closing `{/if}`:
```svelte
          {#if app.dataVersion !== null}
            <section class="flex flex-col gap-1.5">
              <p class={sectionLabel}>
                <DatabaseIcon class="size-3" />
                {t(app.locale, 'settings.mapdata')}
              </p>
              <p class="px-1 text-xs text-muted-foreground">
                {t(app.locale, 'settings.mapdata.created')}
                {app.dataVersion}
                · {app.dataCount}
                {t(app.locale, 'settings.mapdata.count')}
              </p>
            </section>
          {/if}
```

- [ ] **Step 2: Verify map data row appears in Settings**

Run: `pnpm run dev`. Open the menu → Settings. After the data loads (brief moment), the "Kaartgegevens" section should appear showing "Aangemaakt 2026-07-09 · 7 objecten". Switch language to English: "Created 2026-07-09 · 7 features". Before data loads the section is hidden.

- [ ] **Step 3: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Check, lint, validate, build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type-check (svelte-check)
        run: pnpm run check

      - name: Lint + format
        run: |
          pnpm exec eslint . --max-warnings 0
          pnpm exec prettier --check .

      - name: Validate obstacles.geojson against schema
        run: |
          node --input-type=module <<'EOF'
          import { readFileSync } from 'fs';
          import Ajv from 'ajv';

          const schema = JSON.parse(readFileSync('src/lib/data/obstacles.schema.json', 'utf8'));
          const data = JSON.parse(readFileSync('static/data/obstacles.geojson', 'utf8'));

          const ajv = new Ajv();
          const validate = ajv.compile(schema);

          if (!validate(data)) {
            console.error('Schema validation failed:');
            console.error(ajv.errorsText(validate.errors));
            process.exit(1);
          }
          console.log('obstacles.geojson is valid ✓');
          EOF

      - name: Build
        run: pnpm run build
```

- [ ] **Step 4: Verify CI config is syntactically valid**

Run: `pnpm exec prettier --check .github/workflows/ci.yml || true`

Also check pnpm version: `pnpm --version`. The `pnpm/action-setup@v4` step uses version `9` — update the `version:` field to match the project's actual pnpm version if different. Check with `cat package.json | grep pnpm` or `pnpm --version`.

- [ ] **Step 5: Run the full test suite and build locally**

Run: `pnpm test && pnpm run check && pnpm run build`

Expected: all tests pass, svelte-check reports 0 errors, build succeeds and produces `build/`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Menu.svelte .github/workflows/ci.yml
git commit -m "feat: settings map-data row and CI pipeline"
```

---

## Task 8: Tweaks panel (dev-only selected-state style editor)

**Files:**
- Create: `src/lib/state/tweaks.svelte.ts`
- Create: `src/lib/map/TweaksPanel.svelte`
- Modify: `src/lib/components/AppShell.svelte` (add TweaksPanel)

**Interfaces:**
- Produces: `tweaks` — a module-level `$state` object holding all tunable selected-state params; imported directly by ObstacleLayer, CombiLayer, and TweaksPanel. TweaksPanel also syncs CSS custom properties on `:root` via `document.documentElement.style.setProperty()` whenever `tweaks` values change.

- [ ] **Step 1: Create `src/lib/state/tweaks.svelte.ts`**

```ts
export const tweaks = $state({
  // Obstacle — Point selected
  obsRadius: 11,
  obsWeight: 3,
  obsGlowBlur: 8,
  obsGlowOpacity: 0.7,
  // Obstacle — LineString selected
  lineWeight: 4,
  lineGlowBlur: 8,
  lineGlowOpacity: 0.5,
  // Obstacle — Polygon selected
  polyWeight: 3,
  polyFillOpacity: 0.25,
  polyGlowBlur: 10,
  polyGlowOpacity: 0.5,
  // Combi fence selected
  combiWeight: 3,
  combiFillOpacity: 0.15,
  combiGlowBlur: 10,
  combiGlowOpacity: 0.5,
  // Landmark pill selected
  landmarkScale: 1.06,
  landmarkShadowBlur: 12,
  landmarkYLift: 8
});
```

- [ ] **Step 2: Create `src/lib/map/TweaksPanel.svelte`**

```svelte
<script lang="ts">
  import { tweaks } from '$lib/state/tweaks.svelte';

  $effect(() => {
    const r = document.documentElement;
    r.style.setProperty('--sel-obs-glow',
      `drop-shadow(0 2px ${tweaks.obsGlowBlur}px rgba(0,165,227,${tweaks.obsGlowOpacity}))`);
    r.style.setProperty('--sel-line-glow',
      `drop-shadow(0 2px ${tweaks.lineGlowBlur}px rgba(0,165,227,${tweaks.lineGlowOpacity}))`);
    r.style.setProperty('--sel-poly-glow',
      `drop-shadow(0 2px ${tweaks.polyGlowBlur}px rgba(0,165,227,${tweaks.polyGlowOpacity}))`);
    r.style.setProperty('--sel-combi-glow',
      `drop-shadow(0 2px ${tweaks.combiGlowBlur}px rgba(0,165,227,${tweaks.combiGlowOpacity}))`);
    r.style.setProperty('--sel-landmark-scale', String(tweaks.landmarkScale));
    r.style.setProperty('--sel-landmark-shadow',
      `0 4px ${tweaks.landmarkShadowBlur}px rgba(0,0,0,0.2)`);
    r.style.setProperty('--sel-landmark-y-lift', `${tweaks.landmarkYLift}px`);
  });

  type Param = { key: keyof typeof tweaks; label: string; min: number; max: number; step: number };
  const groups: { title: string; params: Param[] }[] = [
    {
      title: 'Obstacle dot (Point)',
      params: [
        { key: 'obsRadius', label: 'Radius', min: 8, max: 20, step: 1 },
        { key: 'obsWeight', label: 'Weight', min: 1, max: 6, step: 0.5 },
        { key: 'obsGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'obsGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Obstacle line (LineString)',
      params: [
        { key: 'lineWeight', label: 'Weight', min: 1, max: 8, step: 0.5 },
        { key: 'lineGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'lineGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Obstacle polygon (Polygon)',
      params: [
        { key: 'polyWeight', label: 'Weight', min: 1, max: 6, step: 0.5 },
        { key: 'polyFillOpacity', label: 'Fill opacity', min: 0, max: 0.6, step: 0.05 },
        { key: 'polyGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'polyGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Combi fence',
      params: [
        { key: 'combiWeight', label: 'Weight', min: 1, max: 6, step: 0.5 },
        { key: 'combiFillOpacity', label: 'Fill opacity', min: 0, max: 0.4, step: 0.05 },
        { key: 'combiGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'combiGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Landmark pill',
      params: [
        { key: 'landmarkScale', label: 'Scale', min: 1, max: 1.3, step: 0.01 },
        { key: 'landmarkShadowBlur', label: 'Shadow blur', min: 0, max: 24, step: 1 },
        { key: 'landmarkYLift', label: 'Y lift (px)', min: 4, max: 20, step: 1 }
      ]
    }
  ];
</script>

<div
  class="fixed bottom-4 right-4 z-[2000] flex max-h-[80vh] w-64 flex-col overflow-y-auto rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur"
>
  <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
    Selected state tweaks
  </p>

  {#each groups as group}
    <details class="mb-1">
      <summary class="cursor-pointer py-1 text-xs font-semibold">{group.title}</summary>
      <div class="mt-1 flex flex-col gap-1.5 pl-1">
        {#each group.params as p}
          <label class="flex items-center gap-2">
            <span class="w-24 shrink-0 text-[11px] text-muted-foreground">{p.label}</span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={tweaks[p.key]}
              oninput={(e) => {
                (tweaks as Record<string, number>)[p.key] = Number(
                  (e.target as HTMLInputElement).value
                );
              }}
              class="flex-1"
            />
            <span class="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
              {tweaks[p.key]}
            </span>
          </label>
        {/each}
      </div>
    </details>
  {/each}
</div>
```

- [ ] **Step 3: Add TweaksPanel to `src/lib/components/AppShell.svelte`**

Add import to `<script>`:
```ts
import TweaksPanel from '$lib/map/TweaksPanel.svelte';
```

Add before the closing `</div>` of the shell:
```svelte
  {#if import.meta.env.DEV && app.selectedId !== null}
    <TweaksPanel />
  {/if}
```

- [ ] **Step 4: Verify tweaks panel appears and works**

Run: `pnpm run dev`. Click any obstacle, combi, or landmark. The tweaks panel should appear bottom-right with five `<details>` sections. Open "Obstacle dot (Point)", drag the Radius slider — the dot should grow/shrink in real time. Open "Landmark pill", drag Scale — the pill should scale. Open "Combi fence", drag Glow blur — the filter changes.

Check that the panel does not appear in production: `pnpm run build && pnpm run preview`. The panel should be absent in the preview build.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/tweaks.svelte.ts src/lib/map/TweaksPanel.svelte \
  src/lib/components/AppShell.svelte
git commit -m "feat: dev-only tweaks panel for selected-state style exploration"
```

---

## Self-Review

**Spec coverage (Plan 2 slice):**

- §2 Data model:
  - `obstacles.geojson` + `obstacles.schema.json` → Tasks 1, 7. ✓
  - TS types for `obstacle` / `combi` / `landmark` with discriminated union → Task 1. ✓
  - `id` format `DURF-NNN`, schema validates it → Task 1. ✓
  - `members` array inside combi → Task 1 (types + schema). ✓
  - `icon` string on landmark → Task 1. ✓
  - Runtime schema validation (AJV) → Task 2. ✓
  - **Deferred:** builder draft lifecycle, auto-save, continuous validation in builder — Plan 5.

- §3 Map rendering:
  - Obstacle Point → dot; LineString → polyline; Polygon → solid-fill shape → Task 4. ✓
  - Combi → dashed rectangle fence (rectangle enforced at draw time in Plan 5), member count badge, tooltip → Task 5. ✓
  - Landmark → always-visible white pill (Lucide icon + name) → Task 6. ✓
  - Selection `.selected` class + CSS custom property tokens + Leaflet-specific params via `tweaks` → Tasks 4–6, 8. ✓
  - Map-click deselect + marker stopPropagation → Task 3 (MapCanvas) + Tasks 4–6 (per-layer). ✓
  - Dev-only tweaks panel, all four param groups, CSS var sync → Task 8. ✓
  - **Deferred:** detail panel (bottom sheet) → Plan 3. Feature bounds to re-center map → Plan 3.

- §4 Failure modes:
  - Load failure → blocking dialog (Retry + Import) → Task 3. ✓
  - Import corrupt file → `parseFeatures()` validates before accepting → Tasks 2, 3. ✓
  - Both tiles down → non-blocking `TilesDownDialog` → Task 3. ✓
  - localStorage blocking dialog → Plan 1. ✓ (already shipped)
  - **Deferred:** builder draft malformed state, red dot on hamburger → Plan 5.

- §5 CI:
  - `svelte-check` → Task 7 CI. ✓
  - `eslint + prettier --check` → Task 7 CI. ✓
  - Schema validate `obstacles.geojson` → Task 7 CI. ✓
  - `vite build` → Task 7 CI. ✓

- §6 i18n:
  - `load.*` + `tiles.down.*` keys added to both locales → Task 3. ✓
  - Map data row strings already existed (`settings.mapdata.*`) and are used in Task 7. ✓

**Placeholder scan:**
- No TBD, TODO, or "add error handling" phrases. Every code block is complete. ✓

**Type consistency:**
- `MapFeature`, `ObstacleFeature`, `CombiFeature`, `LandmarkFeature` defined in Task 1 `types.ts` and used consistently across Tasks 2–6.
- `LoadError` defined in Task 2 `loader.ts` and used in Task 3 `AppShell.svelte`.
- Context key `'map'` set in Task 3 (`MapCanvas.svelte`) as `() => L.Map | undefined` and consumed in Tasks 4–6 with `getContext<() => L.Map | undefined>('map')`.
- `app.obstacles`, `app.combis`, `app.landmarks` defined in Task 3 `app.svelte.ts` and consumed in Tasks 4–6 `AppShell.svelte`.
- `onSelect` prop signature is `(id: string | null) => void` consistently across all three layer components and the corresponding `app.selectFeature(id)` call in AppShell. ✓
