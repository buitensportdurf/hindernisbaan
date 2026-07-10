# Obstacle Map Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the menu's hardcoded fake app version and Settings' separate "map data" block with one reusable status row (club + version) that opens a details dialog with download/import actions, and add `club` to the obstacle GeoJSON's data model.

**Architecture:** `FeatureCollection` gains a required `club: string` field (schema + type + data file + app state). A new `MapDataStatus.svelte` component renders a compact clickable `{club} · v{version}` row and owns its own dialog-open state; it mounts a new `MapDataDialog.svelte` (club/created/count/source + Download map / Load another map buttons) when clicked. `MapDataStatus` is used in two places in `Menu.svelte`: replacing the root menu header's hardcoded version line, and replacing Settings' inline map-data block (whose section label is renamed to reuse the app's own title wording, "Obstacle map"/"Hindernis kaart"). The dialog's import action reuses `AppShell`'s existing `handleImport` function (already wired to `LoadFailDialog`), passed down through `Menu` as a new `onImport` prop, so a bad imported file surfaces via the existing blocking `LoadFailDialog` error path.

**Tech Stack:** Svelte 5 runes (`$state`, `$props`), existing `t(locale, key)` i18n helper, `@lucide/svelte` icons, hand-rolled modal overlay (matching `LoadFailDialog.svelte`'s existing pattern — no new Dialog primitive), AJV schema validation (already wired via `loader.ts`), Vitest for pure-logic tests.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-11-obstacle-map-status-design.md` — this plan implements it in full.
- **No Vitest for Svelte components** — only `.ts` logic modules (`loader.ts`, `dict.ts` via `i18n.test.ts`) get Vitest tests. Svelte component tasks are verified manually via `pnpm run dev` + `pnpm run check`.
- **Svelte 5 runes only** — `$state`, `$derived`, `$props`, `$effect`. No Svelte 4 stores.
- **pnpm** — use `pnpm add` / `pnpm install`, not `npm`.
- **Data path:** `static/data/obstacles.geojson` — served at `/data/obstacles.geojson` (exported as `OBSTACLES_URL` constant from `loader.ts` in this plan).
- **Schema path:** `src/lib/data/obstacles.schema.json`, JSON Schema Draft-07, `additionalProperties: false` throughout.
- **Compact row format:** `{club} · v{version}`, e.g. `Buitensport Durf · v2026-07-09`.
- **Download filename:** `obstacles-{version}.geojson`.
- **Button copy:** "Download map" / "Kaart downloaden" and "Load another map…" / "Andere kaart laden…" (exact wording, per user confirmation).
- **Settings section label:** reuses `app.title` wording per locale — NL "Hindernis kaart", EN "Obstacle map".
- **`durf:` localStorage namespace** — no new keys in this plan.
- Follow existing hand-rolled dialog pattern from `src/lib/components/LoadFailDialog.svelte` (fixed inset-0 backdrop + centered white rounded-2xl card, `onclick` stopPropagation on the inner card) rather than introducing a shadcn/bits-ui Dialog primitive.

---

## File Structure

```
src/lib/data/types.ts                — FeatureCollection gains `club: string`
src/lib/data/obstacles.schema.json   — `club` added to properties + required
src/lib/data/loader.ts               — exports OBSTACLES_URL constant, used as fetchFeatures default
static/data/obstacles.geojson        — gains "club": "Buitensport Durf"
src/lib/data/loader.test.ts          — fixture gains club; new "missing club" test
src/lib/state/app.svelte.ts          — new `dataClub` state + getter, set in setData()

src/lib/i18n/dict.ts                 — remove app.subtitle; rename settings.mapdata copy; add mapdata.club/source/download/import/close keys

src/lib/components/MapDataDialog.svelte  — new: details dialog (club/created/count/source + download/import buttons)
src/lib/components/MapDataStatus.svelte  — new: compact clickable row, owns dialog-open state, mounts MapDataDialog

src/lib/components/Menu.svelte       — header line + Settings block both replaced by <MapDataStatus>; new onImport prop
src/lib/components/AppShell.svelte   — passes existing handleImport to <Menu onImport={handleImport} />
```

---

## Task 1: Data model — `club` field + `OBSTACLES_URL` constant

**Files:**
- Modify: `src/lib/data/types.ts`
- Modify: `src/lib/data/obstacles.schema.json`
- Modify: `src/lib/data/loader.ts`
- Modify: `static/data/obstacles.geojson`
- Modify: `src/lib/data/loader.test.ts`
- Modify: `src/lib/state/app.svelte.ts`

**Interfaces:**
- Consumes: nothing new (existing `FeatureCollection`, `LoadError`, `createAppState`).
- Produces: `FeatureCollection.club: string`; `OBSTACLES_URL` exported string constant from `loader.ts`; `AppState.dataClub: string | null` getter, set alongside `dataVersion` in `setData()`.

- [ ] **Step 1: Add `club` to the `FeatureCollection` type**

In `src/lib/data/types.ts`, replace:

```ts
export interface FeatureCollection {
  type: 'FeatureCollection';
  version: string;
  features: HindernisFeature[];
}
```

with:

```ts
export interface FeatureCollection {
  type: 'FeatureCollection';
  club: string;
  version: string;
  features: HindernisFeature[];
}
```

- [ ] **Step 2: Add `club` to the JSON schema**

In `src/lib/data/obstacles.schema.json`, replace:

```json
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
```

with:

```json
  "required": ["type", "club", "version", "features"],
  "additionalProperties": false,
  "properties": {
    "type": { "type": "string", "const": "FeatureCollection" },
    "club": { "type": "string", "minLength": 1 },
    "version": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "features": {
      "type": "array",
      "items": { "$ref": "#/$defs/Feature" }
    }
  },
```

- [ ] **Step 3: Export `OBSTACLES_URL` from the loader and use it as the default**

In `src/lib/data/loader.ts`, replace:

```ts
export async function fetchFeatures(
  url = '/data/obstacles.geojson'
): Promise<FeatureCollection> {
```

with:

```ts
export const OBSTACLES_URL = '/data/obstacles.geojson';

export async function fetchFeatures(
  url = OBSTACLES_URL
): Promise<FeatureCollection> {
```

- [ ] **Step 4: Add `club` to the sample data file**

In `static/data/obstacles.geojson`, replace:

```json
{
  "type": "FeatureCollection",
  "version": "2026-07-09",
```

with:

```json
{
  "type": "FeatureCollection",
  "club": "Buitensport Durf",
  "version": "2026-07-09",
```

- [ ] **Step 5: Update the loader test fixture and add a missing-club test**

In `src/lib/data/loader.test.ts`, replace:

```ts
const validCollection = {
  type: 'FeatureCollection',
  version: '2026-07-09',
  features: [
```

with:

```ts
const validCollection = {
  type: 'FeatureCollection',
  club: 'Buitensport Durf',
  version: '2026-07-09',
  features: [
```

Then, replace:

```ts
  it('throws LoadError when version is missing', async () => {
    const { version: _v, ...bad } = validCollection;
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });
```

with:

```ts
  it('throws LoadError when version is missing', async () => {
    const { version: _v, ...bad } = validCollection;
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });

  it('throws LoadError when club is missing', async () => {
    const { club: _c, ...bad } = validCollection;
    await expect(parseFeatures(JSON.stringify(bad))).rejects.toBeInstanceOf(LoadError);
  });
```

- [ ] **Step 6: Run the loader tests**

Run: `pnpm test -- loader.test.ts`

Expected: all tests pass, including the new "throws LoadError when club is missing" test.

- [ ] **Step 7: Add `dataClub` to app state**

In `src/lib/state/app.svelte.ts`, replace:

```ts
  let features = $state<HindernisFeature[]>([]);
  let dataVersion = $state<string | null>(null);
```

with:

```ts
  let features = $state<HindernisFeature[]>([]);
  let dataVersion = $state<string | null>(null);
  let dataClub = $state<string | null>(null);
```

Then replace:

```ts
    get dataVersion() { return dataVersion; },
    get dataCount() { return features.length; },
```

with:

```ts
    get dataVersion() { return dataVersion; },
    get dataClub() { return dataClub; },
    get dataCount() { return features.length; },
```

Then replace:

```ts
    setData(col: FeatureCollection) {
      features = col.features;
      dataVersion = col.version;
      loadError = null;
      loadState = 'loaded';
    },
```

with:

```ts
    setData(col: FeatureCollection) {
      features = col.features;
      dataVersion = col.version;
      dataClub = col.club;
      loadError = null;
      loadState = 'loaded';
    },
```

- [ ] **Step 8: Type-check**

Run: `pnpm run check`

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/types.ts src/lib/data/obstacles.schema.json src/lib/data/loader.ts static/data/obstacles.geojson src/lib/data/loader.test.ts src/lib/state/app.svelte.ts
git commit -m "feat: add club field to obstacle map data model"
```

---

## Task 2: i18n — remove fake version string, rename Settings label, add dialog copy

**Files:**
- Modify: `src/lib/i18n/dict.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: i18n keys `mapdata.club`, `mapdata.source`, `mapdata.download`, `mapdata.import`, `mapdata.close` (both locales); `settings.mapdata` value changed to reuse `app.title` wording. (`app.subtitle` is removed in Task 5, alongside its last usage in `Menu.svelte` — removing it here would break `pnpm run check` until Task 5 lands, since `Menu.svelte` still references it.)

- [ ] **Step 1: Update the `nl` dictionary**

In `src/lib/i18n/dict.ts`, replace:

```ts
    'settings.language': 'Taal',
    'settings.mapdata': 'Kaartgegevens',
    'settings.mapdata.created': 'Aangemaakt',
    'settings.mapdata.count': 'objecten',
```

with:

```ts
    'settings.language': 'Taal',
    'settings.mapdata': 'Hindernis kaart',
    'settings.mapdata.created': 'Aangemaakt',
    'settings.mapdata.count': 'objecten',
    'mapdata.club': 'Club',
    'mapdata.source': 'Bron',
    'mapdata.download': 'Kaart downloaden',
    'mapdata.import': 'Andere kaart laden…',
    'mapdata.close': 'Sluiten',
```

- [ ] **Step 2: Update the `en` dictionary**

In `src/lib/i18n/dict.ts`, replace:

```ts
    'settings.language': 'Language',
    'settings.mapdata': 'Map data',
    'settings.mapdata.created': 'Created',
    'settings.mapdata.count': 'features',
```

with:

```ts
    'settings.language': 'Language',
    'settings.mapdata': 'Obstacle map',
    'settings.mapdata.created': 'Created',
    'settings.mapdata.count': 'features',
    'mapdata.club': 'Club',
    'mapdata.source': 'Source',
    'mapdata.download': 'Download map',
    'mapdata.import': 'Load another map…',
    'mapdata.close': 'Close',
```

- [ ] **Step 3: Run the i18n tests**

Run: `pnpm test -- i18n.test.ts`

Expected: all pass, including "every nl key has an en counterpart" — this confirms the two dictionaries stayed in sync.

- [ ] **Step 4: Type-check**

Run: `pnpm run check`

Expected: 0 errors. `app.subtitle` is untouched in this task (still present in both dictionaries, still used by `Menu.svelte`), so nothing breaks here — it's removed in Task 5 together with its last usage.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/dict.ts
git commit -m "feat: unify map data copy in i18n dictionary"
```

---

## Task 3: `MapDataDialog.svelte`

**Files:**
- Create: `src/lib/components/MapDataDialog.svelte`

**Interfaces:**
- Consumes: `t(locale, key)` from `$lib/i18n`; `FeatureCollection` type from `$lib/data/types`; `Button` from `$lib/components/ui/button`.
- Produces: `MapDataDialog` component with props `{ locale: Locale; data: FeatureCollection; sourceUrl: string; onImport: (text: string) => void; onClose: () => void }`. Renders club/created/count/source rows and Download map / Load another map buttons. Calls `onImport(text)` then `onClose()` when a file is picked; calls `onClose()` on backdrop click or the close button.

- [ ] **Step 1: Create the component**

Create `src/lib/components/MapDataDialog.svelte`:

```svelte
<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import type { FeatureCollection } from '$lib/data/types';
  import DatabaseIcon from '@lucide/svelte/icons/database';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    locale,
    data,
    sourceUrl,
    onImport,
    onClose
  }: {
    locale: Locale;
    data: FeatureCollection;
    sourceUrl: string;
    onImport: (text: string) => void;
    onClose: () => void;
  } = $props();

  let fileInput: HTMLInputElement;

  function handleDownload() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/geo+json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obstacles-${data.version}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    onImport(text);
    (e.target as HTMLInputElement).value = '';
    onClose();
  }
</script>

<div
  class="fixed inset-0 z-[1700] flex items-center justify-center bg-black/60 p-5"
  role="presentation"
  onclick={onClose}
>
  <div
    class="flex w-[min(92vw,380px)] flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mapdata-dialog-title"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <DatabaseIcon class="size-5 text-muted-foreground" />
        <p id="mapdata-dialog-title" class="text-base font-semibold text-foreground">
          {t(locale, 'settings.mapdata')}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="size-7 shrink-0"
        aria-label={t(locale, 'mapdata.close')}
        onclick={onClose}
      >
        <XIcon class="size-4" />
      </Button>
    </div>

    <dl class="flex flex-col gap-1.5 text-sm">
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'mapdata.club')}</dt>
        <dd class="font-medium text-foreground">{data.club}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'settings.mapdata.created')}</dt>
        <dd class="font-medium text-foreground">{data.version}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'settings.mapdata.count')}</dt>
        <dd class="font-medium text-foreground">{data.features.length}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'mapdata.source')}</dt>
        <dd class="truncate font-medium text-foreground">{sourceUrl}</dd>
      </div>
    </dl>

    <div class="flex flex-col gap-2">
      <Button variant="outline" class="w-full" onclick={handleDownload}>
        {t(locale, 'mapdata.download')}
      </Button>
      <Button variant="outline" class="w-full" onclick={() => fileInput.click()}>
        {t(locale, 'mapdata.import')}
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

- [ ] **Step 2: Type-check**

Run: `pnpm run check`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/MapDataDialog.svelte
git commit -m "feat: add MapDataDialog component"
```

---

## Task 4: `MapDataStatus.svelte`

**Files:**
- Create: `src/lib/components/MapDataStatus.svelte`

**Interfaces:**
- Consumes: `AppState` (`app.dataClub: string | null`, `app.dataVersion: string | null`, `app.features: HindernisFeature[]`, `app.locale: Locale`) from `$lib/state/app.svelte`; `OBSTACLES_URL` from `$lib/data/loader`; `MapDataDialog` from Task 3.
- Produces: `MapDataStatus` component with props `{ app: AppState; onImport: (text: string) => void }`. Renders nothing until `app.dataClub !== null && app.dataVersion !== null`. Renders a clickable `{club} · v{version}` row that opens `MapDataDialog` on click.

- [ ] **Step 1: Create the component**

Create `src/lib/components/MapDataStatus.svelte`:

```svelte
<script lang="ts">
  import type { AppState } from '$lib/state/app.svelte';
  import { OBSTACLES_URL } from '$lib/data/loader';
  import MapDataDialog from './MapDataDialog.svelte';
  import DatabaseIcon from '@lucide/svelte/icons/database';

  let {
    app,
    onImport
  }: {
    app: AppState;
    onImport: (text: string) => void;
  } = $props();

  let open = $state(false);
</script>

{#if app.dataClub !== null && app.dataVersion !== null}
  {@const club = app.dataClub}
  {@const version = app.dataVersion}
  <button
    type="button"
    class="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
    onclick={() => (open = true)}
  >
    <DatabaseIcon class="size-3 shrink-0" />
    <span class="truncate">{club} · v{version}</span>
  </button>

  {#if open}
    <MapDataDialog
      locale={app.locale}
      data={{
        type: 'FeatureCollection',
        club,
        version,
        features: app.features
      }}
      sourceUrl={OBSTACLES_URL}
      {onImport}
      onClose={() => (open = false)}
    />
  {/if}
{/if}
```

**Note:** `{@const}` snapshots `app.dataClub`/`app.dataVersion` as plain `string` locals — narrowing `app.dataClub !== null` in the `{#if}` doesn't persist through further getter calls (TS doesn't narrow accessor/getter reads across separate call sites), so passing `app.dataClub` directly into the `data={{ club: app.dataClub, ... }}` object literal would fail type-checking against `FeatureCollection.club: string`. The `{@const}` locals are ordinary variables and narrow correctly.

- [ ] **Step 2: Type-check**

Run: `pnpm run check`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/MapDataStatus.svelte
git commit -m "feat: add MapDataStatus component"
```

---

## Task 5: Wire `MapDataStatus` into the menu header and Settings

**Files:**
- Modify: `src/lib/components/Menu.svelte`
- Modify: `src/lib/components/AppShell.svelte`
- Modify: `src/lib/i18n/dict.ts`

**Interfaces:**
- Consumes: `MapDataStatus` from Task 4 (props `{ app, onImport }`).
- Produces: `Menu` component gains a new required prop `onImport: (text: string) => void`; `AppShell` passes its existing `handleImport` through; `app.subtitle` key removed from both dictionaries now that its only usage is gone.

- [ ] **Step 1: Add the `onImport` prop and `MapDataStatus` import to `Menu.svelte`; drop now-unused imports**

In `src/lib/components/Menu.svelte`, replace:

```svelte
  import { Card, CardDescription, CardTitle } from '$lib/components/ui/card';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import DatabaseIcon from '@lucide/svelte/icons/database';
import LanguagesIcon from '@lucide/svelte/icons/languages';
```

with:

```svelte
  import { Card, CardTitle } from '$lib/components/ui/card';
  import MapDataStatus from './MapDataStatus.svelte';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import DatabaseIcon from '@lucide/svelte/icons/database';
import LanguagesIcon from '@lucide/svelte/icons/languages';
```

(`CardDescription` is dropped — the version line it rendered is replaced by `MapDataStatus` in Step 2 below. `DatabaseIcon` stays imported: it's also used inside `MapDataStatus.svelte`/`MapDataDialog.svelte` as a separate import there, but `Menu.svelte` keeps its own copy for the Settings section label in Step 3, below — reusing `LayersIcon` there instead would visually collide with the "Kaart" tile-chooser section directly above it, which already owns that icon's meaning.)

Then replace:

```svelte
  let { app }: { app: AppState } = $props();
```

with:

```svelte
  let {
    app,
    onImport
  }: {
    app: AppState;
    onImport: (text: string) => void;
  } = $props();
```

- [ ] **Step 2: Replace the root menu header's version line**

In `src/lib/components/Menu.svelte`, replace:

```svelte
              {#if app.menuLevel === 'root'}
                <CardTitle class="text-lg font-semibold leading-tight tracking-tight">
                  {t(app.locale, 'app.title')}
                </CardTitle>
                <CardDescription class="text-xs leading-snug">
                  {t(app.locale, 'app.subtitle')} · v2026.juni
                </CardDescription>
              {:else}
```

with:

```svelte
              {#if app.menuLevel === 'root'}
                <CardTitle class="text-lg font-semibold leading-tight tracking-tight">
                  {t(app.locale, 'app.title')}
                </CardTitle>
                <MapDataStatus {app} {onImport} />
              {:else}
```

- [ ] **Step 3: Replace the Settings map-data block**

In `src/lib/components/Menu.svelte`, replace:

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

with:

```svelte
          <section class="flex flex-col gap-1.5">
            <p class={sectionLabel}>
              <DatabaseIcon class="size-3" />
              {t(app.locale, 'settings.mapdata')}
            </p>
            <MapDataStatus {app} {onImport} />
          </section>
```

`MapDataStatus` renders nothing until data has loaded, same as the block it replaces.

- [ ] **Step 4: Pass `handleImport` from `AppShell.svelte`**

In `src/lib/components/AppShell.svelte`, replace:

```svelte
  <Menu {app} />
```

with:

```svelte
  <Menu {app} onImport={handleImport} />
```

- [ ] **Step 5: Remove the now-unused `app.subtitle` key from both dictionaries**

In `src/lib/i18n/dict.ts`, replace:

```ts
  nl: {
    'app.title': 'Hindernis kaart',
    'app.subtitle': 'Buitensport Durf',
    'menu.search': 'Zoeken…',
```

with:

```ts
  nl: {
    'app.title': 'Hindernis kaart',
    'menu.search': 'Zoeken…',
```

Then replace:

```ts
  en: {
    'app.title': 'Obstacle map',
    'app.subtitle': 'Buitensport Durf',
    'menu.search': 'Search…',
```

with:

```ts
  en: {
    'app.title': 'Obstacle map',
    'menu.search': 'Search…',
```

- [ ] **Step 6: Type-check**

Run: `pnpm run check`

Expected: 0 errors — this confirms `app.subtitle` is no longer referenced anywhere (its last usage was removed in Step 2, the key itself in Step 5) and that dropping the `CardDescription` import in Step 1 didn't leave any other usage behind (`DatabaseIcon` is still used, in Step 3's section label).

- [ ] **Step 7: Manual verification**

Run: `pnpm run dev`, open the app in a browser.

1. Open the menu (hamburger icon, top left). Under "Hindernis kaart" the header should now show a clickable row: `Buitensport Durf · v2026-07-09` (no more "v2026.juni").
2. Click that row. A dialog opens showing Club: Buitensport Durf, Aangemaakt: 2026-07-09, objecten: (feature count), Bron: /data/obstacles.geojson, and two buttons "Kaart downloaden" / "Andere kaart laden…".
3. Click "Kaart downloaden" — a file named `obstacles-2026-07-09.geojson` downloads containing the current FeatureCollection JSON (club, version, features).
4. Close the dialog (X button or click the backdrop).
5. Go to Settings (gear icon). The section previously labelled "Kaartgegevens" now reads "Hindernis kaart" and shows the same clickable `Buitensport Durf · v2026-07-09` row; clicking it opens the same dialog.
6. Switch language to English (top of Settings). Header row still shows `Buitensport Durf · v2026-07-09` (club/version aren't translated); Settings section label now reads "Obstacle map"; dialog labels are in English ("Club", "Created", "features", "Source", "Download map", "Load another map…").
7. In the dialog, click "Load another map…" / "Andere kaart laden…" and pick a valid `.geojson` file (e.g. re-select `static/data/obstacles.geojson` from disk) — the dialog closes and the map/status row update to reflect the freshly loaded data. Repeat with an invalid file (e.g. a `.txt` file with `not json` inside) — the dialog closes and the existing blocking "Kaartgegevens niet beschikbaar"/"Map data unavailable" `LoadFailDialog` appears with Retry / Import options.

- [ ] **Step 8: Run the full test suite**

Run: `pnpm test && pnpm run check`

Expected: all tests pass, 0 type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/Menu.svelte src/lib/components/AppShell.svelte src/lib/i18n/dict.ts
git commit -m "feat: unify obstacle map status in menu header and settings"
```

---

## Self-Review Notes

- **Spec coverage:** club field (Task 1), reused status component in header + Settings (Tasks 4–5), click-to-open dialog with details (Task 3), Settings label renamed to "Obstacle map"/"Hindernis kaart" (Task 5 Step 3), download/import actions with confirmed button copy (Task 3). All spec sections have a corresponding task.
- **Type consistency:** `MapDataStatus` passes `data: FeatureCollection` (with non-null `club`/`version`, guarded by the `{#if}`) into `MapDataDialog`'s `data: FeatureCollection` prop — matches. `onImport: (text: string) => void` matches `AppShell.handleImport`'s call signature (an `async function` is a valid runtime value for a `() => void`-typed prop, same pattern already used for `LoadFailDialog`'s `onImport`). `AppState.dataClub` getter name matches usage in `MapDataStatus`.
- **No placeholders:** all steps show complete code; manual verification steps list concrete expected UI text in both locales.
