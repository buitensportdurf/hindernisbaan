# hindernisbaan — Design Spec

**Date:** 2026-06-25 · **Updated:** 2026-07-01
**Status:** Approved (brainstorm complete; ready for implementation planning)
**Owner:** [me@felixakkermans.com](mailto:me@felixakkermans.com) (buitensportdurf)

> **2026-07-01 revision:** added the `landmark` kind (§2), swapped tile providers to CARTO Voyager + Esri (§3–4), added an Internationalization section (§6), and adopted the Durf design system (Lucide + Geist + Bok blauw, shadcn-svelte token path).

---

## 1. Project overview & scope

A spatial knowledge base for Buitensport Durf's outdoor obstacle course, but designed org agnostic so it can be used by others too. Lets editors draw and label obstacles on a map and lets members view that map. A future personal-knowledge **Test** mode is planned but out of scope for MVP.

### Modes (MVP)

- **Map** — public, read-only view of obstacles on a tiled basemap
- **Design** — authoring view at `/design` (unlinked from public navigation): draw/edit/delete obstacles, export GeoJSON
- **Search** — cross-cutting pseudo-mode (available in Map and Design; hidden in Test)

### Modes (deferred)

- **Test** — personal-knowledge quiz mode; runs stored locally with seed

### Platform priorities

- **Mobile-first** for Map view (members on-site)
- **Desktop-primary** for Design view (large screen needed for accurate drawing)
- Design view should not crash on mobile, but is not optimized for it

### Scope guardrails

- No auth in the app; write control = GitHub repo write access
- No backend; no database; no server runtime
- Single source of truth: one GeoJSON file in the repo
- Edits are infrequent (≤ monthly cadence)

---

## 2. Data model

### Canonical store

`static/data/obstacles.geojson` — a single GeoJSON `FeatureCollection`, deployed as a static asset, committed to git.

### File-level metadata

Top-level `FeatureCollection` carries:

```jsonc
{
  "type": "FeatureCollection",
  "version": "2026-06-22",   // ISO date string, serves as version
  "features": [ ... ]
}
```

The date doubles as the version — no separate `createdAt` / `updatedAt` fields. A new version is a new file content (new commit).

### Feature shape

Every feature has `properties.kind`, one of:

- `"obstacle"` — standalone obstacle (point / line / polygon)
- `"combi"` — a logical group of named members; the feature's geometry is the group's outline (typically a polygon fence)
- `"landmark"` — a place-of-interest, not an obstacle: verzamelplek, parking, fietsenstalling, toilet, EHBO, etc. Carries an `icon`. Renders as an **always-visible labeled pill** (icon + name), distinct from obstacles (a dot with hover tooltip) and combis (a numbered fenced blob).

```jsonc
{
  "type": "Feature",
  "id": "<stable-internal-id>",            // never shown in UI (see IDs)
  "geometry": { "type": "Point|LineString|Polygon", "coordinates": [...] },
  "properties": {
    "name": "string",
    "kind": "obstacle" | "combi" | "landmark",
    "icon": "string?",                     // only on kind: landmark — a Lucide icon name (Durf DS iconset)
    "notes": "string?",                    // freeform misc
    "members": [                           // only on kind: combi
      {
        "name": "string",
        "notes": "string?",
        "position": [lng, lat]             // optional; defaults to centroid of parent geometry
      }
    ]
  }
}
```

### Landmark icons

`properties.icon` is a **Lucide icon name** drawn from the Durf design-system iconset (Lucide is the DS's icon library — see §3). The editor shows an icon picker over that set when `kind: landmark`. Sensible defaults: `users`/`flag` for verzamelplek, `car`/`parking` for parking, `bike` for fietsenstalling. Deferred (post-MVP): custom uploaded icons and using the Durf ibex app-icon mark as a landmark icon.

### Landmark behavior

Landmarks are typically **points**. Landmarks are **selectable and editable**: tapping one in Map mode opens the detail panel (name + notes); in Design mode it opens the editor like any feature. They are included in search.

### Member rendering

Members do **not** render as standalone map features for visual simplicity. They are sub-records inside their parent combi. UI exposes them via the combi's detail panel and search.

### IDs

Every feature carries a stable `id`, generated once at draw time and preserved across renames so git diffs stay meaningful. Format: sequential, human-readable `DURF-001`, `DURF-002`, … The id is a **purely internal / data-layer concern — it is never surfaced in the UI** (detail panel and search show name, kind, and geometry only). Never render raw ids to end users.

### Schema enforcement

`obstacles.schema.json` lives in the repo and is the single source of truth. Used in:

- CI (validates the data file on every PR)
- Builder runtime (continuous validation between edits)
- Import flow (validates before replacing draft)

---

## 3. Infrastructure & frontend stack

### Hosting & deploy

- **Cloudflare Pages**, auto-deploys on push to `main`
- Static SPA output — no SSR, no server runtime
- GitHub repo write access = the only "auth" for editing

### Frontend stack


| Layer              | Choice                                               | Why                                                      |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| Framework          | SvelteKit, `adapter-static`                          | SPA, no SSR overhead                                     |
| UI components      | shadcn-svelte v1.3.0                                 | Runes-native Svelte 5; Durf DS ships a shadcn token path |
| Styling            | Tailwind CSS + Durf preset                          | shadcn-svelte convention; Durf tokens re-skin shadcn     |
| Icons              | Lucide + Durf brand marks (ibex)                     | Durf DS icon library; 2px stroke, `currentColor`         |
| Type               | Geist (UI/body), NAL Hand (display, sparingly)       | Durf DS type system                                      |
| i18n               | Lightweight NL/EN dictionary (see §6)                | UI chrome only; data stays as authored                   |
| Map                | Leaflet                                              | Mature, free, swappable tile layers                      |
| Drawing            | leaflet-geoman-free v2.19.2 (MIT)                    | Off-the-shelf primitives for point/line/polygon          |
| Data               | File-based GeoJSON (`static/data/obstacles.geojson`) | No backend; monthly edit cadence                         |
| Cache              | Service worker, stale-while-revalidate               | Works on patchy 4G on the plot                           |
| Client persistence | localStorage (**hard requirement**)                  | Settings + builder drafts; app refuses to run without it |
| Validation         | JSON Schema via `ajv`                                | One schema, used in CI + runtime + import                |


### App shell (UX)

- Map fills the viewport
- **Hamburger button**, top-left, 44px square, white card on map
  - Closed → `☰`
  - Menu open → `✕`
  - One level deep (e.g., Settings) → `←`
- **Floating island panel** drops below the button when open
- **Tap outside** the panel always closes back to map
- Inside the panel, `←` (or the morphed button) goes one level up

### Map rendering

- **Obstacle** → a Bok-blauw dot marker; name shown as a hover/tap tooltip
- **Combi** → a rounded fenced blob sized to its polygon, showing the member **count**; name on tooltip
- **Landmark** → an **always-visible white pill** (Lucide icon + name), no tap needed to read it
- **Selection** highlights the active feature with a single emphasis style — **`lift`** (raise + shadow + slight scale). MVP ships `lift` only.

### Detail panel (selection)

Tapping a feature opens a **bottom sheet**: drag handle, name + kind/geometry label, close button, notes, and (for combis) the member list. Draggable/tappable to expand to full height; a "Toon alles / Show all" fade appears when content overflows. Tapping the map or dragging the sheet down dismisses it.

### Menu contents

- **Mode** section: Map (active) / Design / *Test (deferred)*
- Separator
- **Search…** (pseudo-mode, hidden in Test)
- **Settings ›**
  - Tile layer picker: **Kaart (Voyager)** / **Satelliet (Esri)**
  - Language: **Nederlands / English** (see §6)
  - Map data: file version date + feature count (e.g., "Aangemaakt 22-06-2026 · 34 objecten")

### Tile providers

Two layers, user-switchable in Settings, auto-failover between them on tile load failure:

| Key   | Label (NL/EN)        | URL                                                                                     | Attribution              |
| ----- | -------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| `map` | Kaart / Map (default) | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`                  | `© OpenStreetMap © CARTO` |
| `sat` | Satelliet / Satellite | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | `© Esri`                  |

- Default = **CARTO Voyager**. Plain OSM is **dropped**.
- Selected layer persists to localStorage.

### Design source

Figma file `Durf-shadcn` (`sBQk1LidU8RnncmHaUs2hF`) holds both the shadcn kit and the design pages — single library + design surface. Code-to-design parity via shadcn-svelte component keys.

---

## 4. Failure modes & error handling

Architectural side-effect of "no backend, no auth": many traditional failure modes don't exist. Remaining ones, with handling:

### Load / parse failures (single UX for both)

- `obstacles.geojson` fails to fetch OR parses as malformed → **blocking dialog** with the error message + two buttons: **Retry** and **Import another file…**
- There is no "last good cache" to fall back to — service worker only helps when the repo file *did* load successfully on a prior visit. New visitor + broken file = dialog is the only path forward.

### Tile providers

- On tile load failure → **auto-failover** to the alternative provider (Voyager ↔ Esri)
- If both fail → non-blocking dialog: "Map tiles unavailable." Closing it leaves app usable without basemap (drawings/markers still render on blank canvas).

### localStorage unavailable (private browsing, quota, etc.)

localStorage is a **hard requirement** — modern browser only, no edge/legacy support.

- **Loud blocking dialog**: "This app needs a browser with localStorage enabled."
- App does not run past this point; no in-memory fallback.

### Import corrupt file

- Validate against schema **before** replacing draft state
- Inline parse error; original draft untouched

### Builder draft lifecycle

- **Live auto-save** to localStorage on every atomic edit, *only when current state validates clean*
- Healthy state → small **"Draft saved"** indicator
- Malformed state → **toast** surfaces immediately ("Draft has a problem"); tap to open dialog with details (progressive disclosure)
- Menu hamburger gets a **red dot in the corner** while draft is in malformed state — visible from anywhere in the app
- **Discard draft** → in the menu, the draft-state row reveals a discard button on hover; click reverts to the live version from the repo
- **Validate continuously** between edits, not just at export time

### Three principles

1. **Validate continuously**, not at gates — catch problems between atomic edits, surface immediately
2. **Errors are loud and actionable** — blocking dialogs with retry/import for load failures; toasts with progressive disclosure for draft problems
3. **Persistent status in chrome** — red dot on menu button = global "something needs your attention"

### Out of scope

- Concurrent edit conflicts (monthly cadence + tiny editor team)
- Offline edit + sync
- Auth failures (no auth)

---

## 5. Testing strategy (MVP)

### What we keep

- **JSON Schema** as single source of truth — `obstacles.schema.json` in repo
- **CI schema validation** of `static/data/obstacles.geojson` on every PR (blocks merge if invalid)
- **Runtime validation** in builder (continuous, per Section 4) using the same schema via `ajv`
- **Type checking** (`svelte-check`) and **lint** (`eslint` + `prettier --check`) in CI
- **Build verification** in CI — `vite build` must succeed
- **Manual smoke test** before merging to `main` — load page, draw a shape in builder, export

### Deferred (post-MVP)

- Unit tests (Vitest)
- Component tests (@testing-library/svelte)
- E2E (Playwright)
- Visual regression / Storybook
- Cross-browser matrix beyond modern Chrome/Safari

### CI pipeline (MVP)

1. `svelte-check`
2. `eslint` + `prettier --check`
3. **Schema validate** `obstacles.geojson`
4. `vite build`

Fail any → block merge. On merge to `main` → Cloudflare Pages auto-deploys.

### Rationale

Solo / small editor team + monthly edit cadence + battle-tested deps (Leaflet, shadcn-svelte) means test infra would slow MVP more than it protects it. Schema validation alone catches the highest-impact failure (broken data file). Tests are an obvious post-MVP investment if the project grows.

---

## 6. Internationalization (i18n)

The app ships **bilingual: Dutch (default) and English**. Dutch is Durf's primary voice (informal *jij/je*, warm, community-first — per the Durf DS content guidelines); English is a first-class secondary.

### Scope

- **UI chrome only** is translated: menu, settings, search placeholder, editor labels, toolbar tooltips, dialogs, toasts, draft-status pills, empty states.
- **Obstacle data is never translated.** Names, notes, member names, and landmark names render exactly as authored in the GeoJSON. Editors write in whatever language the content lives in.

### Behavior

- **Language detection:** on first load, detect from the browser (`navigator.language`). `nl*` → Dutch; anything else → English. Default fallback = **Dutch**.
- **Manual override:** a Nederlands / English toggle in Settings. Choice persists to localStorage (`durf:lang`) and wins over detection on subsequent loads.
- Switching language re-renders chrome live; no reload.

### Implementation

- A lightweight flat dictionary keyed by string id, one object per locale (`nl`, `en`) — no heavyweight i18n framework for MVP.
- Every user-facing chrome string goes through the lookup; no hardcoded display copy.
- Icon-picker and kind labels are chrome (translated); the underlying `kind` / `icon` values stored in data are language-neutral identifiers.

---

## Appendix: Open questions / deferred decisions

- Test mode design (data shape for runs, UI for question types, scoring)
- Combi member custom positioning UI (post-MVP polish)
- Custom landmark icons — uploaded images and using the Durf ibex app-icon mark (post-MVP; MVP is Lucide-only)
- Audit log surfacing in-app (`git log -- static/data/obstacles.geojson` is the current answer)
- Concurrent-edit story if editor team grows
- Code Connect mapping between Figma components and code components
- Additional UI languages beyond NL/EN (dictionary structure supports it; not populated for MVP)

