# Obstacle Map Status — Design

## Problem

The menu currently shows two unrelated, non-data-driven pieces of "version" information:

- The root menu header shows `{app.subtitle} · v2026.juni` — a hardcoded fake app version, unrelated to the loaded data.
- Settings shows a "Map data" ("Kaartgegevens") section with `Aangemaakt {dataVersion} · {dataCount} objecten` — real data info, but only reachable two taps deep and not shown up front.

This is redundant/non-unified, and the obstacle GeoJSON file itself never states which club it belongs to (only the app-level `app.subtitle` string says "Buitensport Durf", disconnected from the data).

## Data model

Add `club` to the obstacle GeoJSON's `FeatureCollection`, alongside the existing `version` field (already serving as a "created at" date, format `YYYY-MM-DD`):

- `src/lib/data/types.ts`: `FeatureCollection` gains `club: string`.
- `src/lib/data/obstacles.schema.json`: add `club` (`type: string`, `minLength: 1`) to `properties` and `required` on the top-level `FeatureCollection` def.
- `static/data/obstacles.geojson`: add `"club": "Buitensport Durf"`.
- `src/lib/state/app.svelte.ts`: add `dataClub` state, set alongside `dataVersion` in `setData()`, exposed as a getter.
- `src/lib/data/loader.test.ts`: add `club` to the `validCollection` fixture; add a test asserting `parseFeatures` rejects a collection missing `club` (mirrors the existing "missing version" test).

## Component: reused in two places

**`src/lib/components/MapDataStatus.svelte`** (new) — a single clickable row: an icon plus `{club} · v{version}`, e.g. `Buitensport Durf · v2026-07-09`. Clicking it opens `MapDataDialog.svelte`. Props: `app: AppState`, `onImport: (text: string) => void`. Only renders when `app.dataVersion !== null` (i.e., after the initial load completes); nothing is shown in its place before that, since the initial fetch of the local static file is effectively instant and a real failure is already handled by the existing blocking `LoadFailDialog`.

Two placements, same component instance pattern:

1. **Root menu header** (`Menu.svelte`) — replaces the current `CardDescription` line (`{app.subtitle} · v2026.juni`). The `app.title` line above it is unchanged. The `app.subtitle` i18n key is deleted (it has no other usage after this change).
2. **Settings panel** (`Menu.svelte`) — replaces the current inline `Aangemaakt … objecten` block, still under a section label with `DatabaseIcon`. The section label itself is renamed from "Map data"/"Kaartgegevens" to reuse the existing `app.title` wording per locale: NL "Hindernis kaart", EN "Obstacle map" (i18n key `settings.mapdata` value changes; key itself stays for minimal diff).

`Menu.svelte` gains a new `onImport` prop, forwarded to `MapDataStatus`. `AppShell.svelte` passes its existing `handleImport` function through: `<Menu {app} onImport={handleImport} />`.

## Component: `MapDataDialog.svelte` (new)

Hand-rolled modal overlay, matching the existing style of `LoadFailDialog.svelte`/`TilesDownDialog.svelte` (fixed inset-0 backdrop + centered card) rather than introducing a new shadcn Dialog primitive — keeps the pattern consistent with the rest of the codebase.

Contents:
- Club: `{club}`
- Aangemaakt/Created: `{version}`
- Objecten/Objects (features): `{dataCount}` — reuses existing `settings.mapdata.created` / `settings.mapdata.count` i18n keys
- Bron/Source: `/data/obstacles.geojson` (the fetch URL constant)
- **Download map** button — serializes the current in-memory `{ type: 'FeatureCollection', version, club, features }` to JSON and triggers a browser download named `obstacles-{version}.geojson`
- **Load another map…** button — same file-input pattern as `LoadFailDialog` (hidden `<input type="file" accept=".geojson,application/geo+json,application/json">`), wired to the `onImport` prop so a bad file routes through the same existing `handleImport` → `LoadError` → `app.setLoadError` path, surfacing the existing blocking `LoadFailDialog` on failure
- Close via backdrop click or a close button

New i18n keys needed (both locales): dialog title, club label, source label, download button, import button. Reuses `settings.mapdata.created` and `settings.mapdata.count` for the created-date and object-count labels.

## Out of scope

- No persistence of downloaded/imported data beyond the current browser session (matches existing `LoadFailDialog` import behavior — this is a static SPA with no backend).
- No validation UI beyond the existing schema-driven `LoadError` messages.
- No change to `menu.design`/`menu.test` (unused, planned future nav items).
