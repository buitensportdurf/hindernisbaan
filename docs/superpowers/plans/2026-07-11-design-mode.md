# Design Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/design`, the authoring view where editors draw obstacles/combis/landmarks on the map, edit their properties in a side panel, and export the result as `obstacles.geojson` — with continuous validation, a localStorage draft that survives reloads, and loud-but-recoverable error handling, per spec §1–§4.

**Architecture:** `/design` is a new SvelteKit route that reuses the existing `AppShell` shell (map + hamburger menu chrome) via a new `mode` prop, but composes its own design-only pieces (draw toolbar, feature editor Sheet, draft status) as snippets passed in from `src/routes/design/+page.svelte` — this keeps `leaflet-geoman-free`, the full Lucide catalog, and the Popover/Command/Sheet primitives out of the public Map bundle entirely (SvelteKit code-splits per route file). A new `draft` state module holds the working `FeatureCollection`, autosaves it to `localStorage` on every valid edit, and re-validates continuously with the same `ajv` schema the loader already uses. Drawing is powered by `leaflet-geoman-free`'s imperative API (`enableDraw`/`enableGlobalEditMode`/`enableGlobalRemovalMode`) driven by a custom shadcn-svelte toolbar — geoman's own default on-map toolbar is never enabled (it's opt-in via `addControls()`, which this plan simply never calls). New shadcn-svelte primitives (Sheet, Popover, Command, ToggleGroup, AlertDialog, Label, Input, Textarea) are vendored as local source files under `src/lib/components/ui/`, hand-written against the bits-ui v2.18.1 APIs actually installed in this repo (verified against `node_modules/bits-ui` — no CLI/registry fetch involved, so there's nothing that can drift from an unreachable network at execution time).

**Tech Stack:** `@geoman-io/leaflet-geoman-free@2.19.2` (new dependency, drawing), `svelte-sonner@^1.1.1` (new dependency, toast), `bits-ui@2.18.1` (already installed, powers Sheet/Popover/Command/ToggleGroup/AlertDialog), `@lucide/svelte@1.23.0` (already installed — icon picker uses its `icons` namespace export, not per-file dynamic imports), `ajv@8` (already installed, reused for continuous validation).

## Global Constraints

- **SPA only, no backend, no auth** — same as the rest of the app. Write access = GitHub repo write access (spec §1).
- **Svelte 5 runes only** — `$state`, `$derived`, `$props`, `$effect`, `$bindable`. No Svelte 4 stores.
- **`pnpm`** — use `pnpm add` / `pnpm install`, not `npm`.
- **Feature IDs are UUIDs** (`crypto.randomUUID()`), matching the existing schema pattern and the live `obstacles.geojson` — **not** the `DURF-NNN` format described in spec §2, which is stale relative to the shipped schema/data and is corrected as part of Task 1.
- **Combi geometry = Rectangle draw tool.** Per the data-layer plan's existing constraint, combis are drawn with geoman's `Rectangle` shape (still emits a `Polygon` GeoJSON geometry — no schema impact). Obstacle polygons use the `Polygon` shape. This is how the editor distinguishes "draw a combi fence" from "draw an obstacle polygon" — there is no separate combi-specific draw tool.
- **Kind is chosen after drawing, in the editor Sheet** — not at draw time. A freshly-drawn Marker defaults to `kind: 'obstacle'`; the editor's kind selector is constrained by geometry: `Point` → obstacle/landmark, `LineString` → obstacle only, `Polygon`(rectangle) → obstacle/combi.
- **Continuous validation, not gated** — every atomic edit (name change, kind change, new member row, drawing a shape, deleting a shape) re-validates the whole draft `FeatureCollection` against `obstacles.schema.json` via the same `ajv` instance the loader uses. A transiently-invalid state (e.g. `kind: landmark` before an icon is picked) is expected and surfaced via the toast/red-dot mechanism, not blocked.
- **Draft persistence key:** `durf:draft` in `localStorage`, raw JSON-stringified `FeatureCollection`. Only written when the draft currently validates clean (spec §4).
- **No Vitest for Svelte components** (deferred per spec §5, existing project convention — no `.svelte` files have test files in this repo). Pure-logic modules (ids, validation, icon name conversion, draft-mutation helpers) get Vitest tests, following `loader.test.ts` / `tiles.test.ts` / `i18n.test.ts` precedent.
- **Bundle isolation:** nothing that only Design mode needs (`@geoman-io/leaflet-geoman-free`, the Sheet/Popover/Command/ToggleGroup/AlertDialog primitives, the full Lucide `icons` namespace) may be imported from `AppShell.svelte`, `Menu.svelte`, or any module reachable from `src/routes/+page.svelte`. They're only imported from `src/routes/design/+page.svelte` and its own child components, so SvelteKit's per-route code-splitting keeps the public Map bundle exactly as small as it is today.
- **shadcn-svelte primitives are hand-vendored, not CLI-fetched.** This repo's `components.json` points at a custom registry (`https://tw3.shadcn-svelte.com/registry/nova`) that isn't reachable the same way twice reliably; every new primitive in this plan is instead written directly against the bits-ui v2.18.1 API surface already installed in `node_modules/bits-ui`, following the exact conventions of the existing `button`/`card`/`separator` components (`cn()` class merging, `tailwind-variants` for variant props, `Snippet` children, `data-slot` attributes). No task in this plan depends on network access to execute.
- **Bok blauw** = `#00A5E3` (primary). Radius = `1rem` (`--radius`). Geist for UI text.
- **Landmark icon storage format:** kebab-case Lucide slug (e.g. `"arrow-left"`, `"users"`) — matches the icon's canonical name on lucide.dev and the import-path convention already used elsewhere in this codebase (`@lucide/svelte/icons/map`). Never store the PascalCase Svelte-component export name in data.

---

## File Structure

```
Create:
src/routes/design/+page.svelte                        — Design mode route: fetches live data, wires draft store, composes AppShell with design snippets

src/lib/components/ui/label/label.svelte               — bits-ui Label.Root wrapper
src/lib/components/ui/label/index.ts
src/lib/components/ui/input/input.svelte                — plain styled <input>
src/lib/components/ui/input/index.ts
src/lib/components/ui/textarea/textarea.svelte           — plain styled <textarea>
src/lib/components/ui/textarea/index.ts

src/lib/components/ui/sheet/sheet-overlay.svelte
src/lib/components/ui/sheet/sheet-content.svelte
src/lib/components/ui/sheet/sheet-header.svelte
src/lib/components/ui/sheet/sheet-footer.svelte
src/lib/components/ui/sheet/sheet-title.svelte
src/lib/components/ui/sheet/sheet-description.svelte
src/lib/components/ui/sheet/sheet-close.svelte
src/lib/components/ui/sheet/index.ts

src/lib/components/ui/alert-dialog/alert-dialog-overlay.svelte
src/lib/components/ui/alert-dialog/alert-dialog-content.svelte
src/lib/components/ui/alert-dialog/alert-dialog-header.svelte
src/lib/components/ui/alert-dialog/alert-dialog-footer.svelte
src/lib/components/ui/alert-dialog/alert-dialog-title.svelte
src/lib/components/ui/alert-dialog/alert-dialog-description.svelte
src/lib/components/ui/alert-dialog/alert-dialog-action.svelte
src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte
src/lib/components/ui/alert-dialog/index.ts

src/lib/components/ui/toggle-group/toggle-group-variants.ts
src/lib/components/ui/toggle-group/toggle-group.svelte
src/lib/components/ui/toggle-group/toggle-group-item.svelte
src/lib/components/ui/toggle-group/index.ts

src/lib/components/ui/popover/popover-content.svelte
src/lib/components/ui/popover/index.ts

src/lib/components/ui/command/command.svelte
src/lib/components/ui/command/command-input.svelte
src/lib/components/ui/command/command-list.svelte
src/lib/components/ui/command/command-empty.svelte
src/lib/components/ui/command/command-group.svelte
src/lib/components/ui/command/command-item.svelte
src/lib/components/ui/command/index.ts

src/lib/data/ids.ts                                     — generateId()
src/lib/data/ids.test.ts

src/lib/durf-ds/icons.ts                                — pascalToKebab/kebabToPascal/ALL_ICON_NAMES over @lucide/svelte's `icons` namespace
src/lib/durf-ds/icons.test.ts

src/lib/design/draftMutations.ts                        — pure functions: addFeature, updateFeature, removeFeature, addMember, updateMember, removeMember
src/lib/design/draftMutations.test.ts
src/lib/state/draft.svelte.ts                           — $state wrapper around draftMutations + persistence + continuous validation

src/lib/design/IconPicker.svelte                        — Popover + Command searchable icon picker
src/lib/design/drawTool.ts                              — DrawTool type, shared by DrawToolbar and GeomanController
src/lib/design/DrawToolbar.svelte                        — ToggleGroup draw-tool selector (point/line/polygon/rectangle/edit/delete)
src/lib/design/GeomanController.svelte                    — mounts leaflet-geoman on the map, wires pm:create/pm:edit/pm:remove to the draft store
src/lib/design/FeatureEditorSheet.svelte                  — Sheet: name/kind/notes/icon/members form for the selected draft feature
src/lib/design/DiscardDraftDialog.svelte                  — AlertDialog confirming draft discard
src/lib/design/DraftStatus.svelte                         — "Draft saved" / malformed-toast-trigger row for the Menu
src/lib/design/DraftExportDialog.svelte                   — download/import dialog for the draft (parallel to MapDataDialog)

Modify:
package.json                                            — add @geoman-io/leaflet-geoman-free, svelte-sonner
src/app.css                                             — import leaflet-geoman.css
src/lib/i18n/dict.ts                                     — add menu.mode.*, design.*, mapdata-parallel draft.* keys (nl + en)
src/lib/components/AppShell.svelte                       — accept `mode` prop + optional snippets (toolbar, editorPanel, statusExtra); mount <Toaster/>
src/lib/components/Menu.svelte                           — add Mode section (Map/Design/Test-disabled); accept + render `statusExtra` snippet
src/lib/data/loader.ts                                   — export `validateCollection()` (refactor the private assertValid into a reusable, exported check)
src/lib/data/types.ts                                    — no change (already matches spec's feature shapes)
src/lib/map/ObstacleLayer.svelte                          — tag each created layer with `.feature` for pm:edit/pm:remove lookup
src/lib/map/CombiLayer.svelte                             — same
src/lib/map/LandmarkLayer.svelte                          — same
docs/superpowers/specs/2026-06-25-hindernisbaan-design.md — fix §2 ID format text (DURF-NNN → UUID) to match shipped schema/data
```

---

## Task 1: Spec correction, dependencies, route scaffold, Mode menu section

**Files:**
- Modify: `docs/superpowers/specs/2026-06-25-hindernisbaan-design.md`
- Modify: `package.json`
- Modify: `src/app.css`
- Modify: `src/lib/i18n/dict.ts`
- Modify: `src/lib/components/AppShell.svelte`
- Modify: `src/lib/components/Menu.svelte`
- Create: `src/routes/design/+page.svelte`

**Interfaces:**
- Produces: `AppShell` accepts `mode: 'map' | 'design' = 'map'` prop plus optional Snippet props `toolbar?: Snippet`, `editorPanel?: Snippet`, `menuStatusExtra?: Snippet`. `Menu` accepts `mode` and `statusExtra?: Snippet` props.

- [ ] **Step 1: Fix the spec's stale ID-format text**

In `docs/superpowers/specs/2026-06-25-hindernisbaan-design.md`, find this paragraph in §2 (Data model → IDs):

```
Every feature carries a stable `id`, generated once at draw time and preserved across renames so git diffs stay meaningful. Format: sequential, human-readable `DURF-001`, `DURF-002`, … The id is a **purely internal / data-layer concern — it is never surfaced in the UI** (detail panel and search show name, kind, and geometry only). Never render raw ids to end users.
```

Replace the format sentence with:

```
Every feature carries a stable `id`, generated once at draw time and preserved across renames so git diffs stay meaningful. Format: **UUID v4** (`crypto.randomUUID()`), matching the JSON Schema's `id` pattern. The id is a **purely internal / data-layer concern — it is never surfaced in the UI** (detail panel and search show name, kind, and geometry only). Never render raw ids to end users.
```

- [ ] **Step 2: Add new dependencies**

Run:
```bash
pnpm add @geoman-io/leaflet-geoman-free@2.19.2 svelte-sonner@^1.1.1
```

Expected: `package.json` `dependencies` gains both entries; `pnpm-lock.yaml` updates.

- [ ] **Step 3: Import geoman's CSS**

In `src/app.css`, find the existing `@import 'leaflet/dist/leaflet.css';`-style import block near the top (or the first `@import` line) and add directly after it:

```css
@import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
```

- [ ] **Step 4: Add i18n keys for the Mode section and Design chrome**

In `src/lib/i18n/dict.ts`, the `nl` object already has `'menu.design': 'Ontwerp'` and `'menu.test': 'Test'` / `'menu.test.soon': 'Binnenkort'` (unused today). Add these new keys to **both** `nl` and `en` objects, right after `'menu.settings'`/`'settings.title'` (nl shown; mirror in en per the table below):

```ts
    // nl, insert after 'menu.settings': 'Instellingen',
    'menu.mode': 'Weergave',
    'menu.mode.map': 'Kaart',
    'menu.mode.design': 'Ontwerp',
    'menu.mode.test': 'Test',
    'menu.mode.test.soon': 'Binnenkort',
```

```ts
    // en, insert after 'menu.settings': 'Settings',
    'menu.mode': 'View',
    'menu.mode.map': 'Map',
    'menu.mode.design': 'Design',
    'menu.mode.test': 'Test',
    'menu.mode.test.soon': 'Soon',
```

Also remove the now-superseded standalone `'menu.design'` / `'menu.test'` / `'menu.test.soon'` keys from both locales (they're replaced by the `menu.mode.*` namespaced versions above) — search each locale object for `'menu.design'`, `'menu.test'`, `'menu.test.soon'` and delete those three lines from each.

- [ ] **Step 5: Add the Mode section to `Menu.svelte`**

In `src/lib/components/Menu.svelte`, add imports near the existing icon imports:

```ts
  import MapIcon from '@lucide/svelte/icons/map';
```

(This import already exists for the tile picker — reuse it.) Add a new import:

```ts
  import PenLineIcon from '@lucide/svelte/icons/pen-line';
```

Add a `mode` and `statusExtra` prop to the component's `$props()`:

```ts
  let {
    app,
    onImport,
    mode = 'map',
    statusExtra
  }: {
    app: AppState;
    onImport: (text: string) => void;
    mode?: 'map' | 'design';
    statusExtra?: Snippet;
  } = $props();
```

Add `import type { Snippet } from 'svelte';` to the existing import block if not already present.

In the root-level menu body (the `{#if app.menuLevel === 'root'}` branch, currently just the Settings button), add a Mode section **above** the Settings button and a separator below it:

```svelte
        {#if app.menuLevel === 'root'}
          <section class="flex flex-col gap-1.5">
            <p class={sectionLabel}>
              <PenLineIcon class="size-3" />
              {t(app.locale, 'menu.mode')}
            </p>
            <div class="flex flex-col gap-1">
              <Button
                variant="ghost"
                class={cn(menuButton, mode === 'map' && 'bg-secondary text-secondary-foreground')}
                href="/"
              >
                <MapIcon class={menuIcon} />
                <span class="flex-1 text-left">{t(app.locale, 'menu.mode.map')}</span>
              </Button>
              <Button
                variant="ghost"
                class={cn(menuButton, mode === 'design' && 'bg-secondary text-secondary-foreground')}
                href="/design"
              >
                <PenLineIcon class={menuIcon} />
                <span class="flex-1 text-left">{t(app.locale, 'menu.mode.design')}</span>
              </Button>
              <Button variant="ghost" class={cn(menuButton, 'opacity-50')} disabled>
                <span class="flex-1 text-left">
                  {t(app.locale, 'menu.mode.test')}
                  <span class="font-medium text-muted-foreground"> · {t(app.locale, 'menu.mode.test.soon')}</span>
                </span>
              </Button>
            </div>
          </section>

          <Separator />

          <Button variant="ghost" class={menuButton} onclick={() => app.gotoSettings()}>
```

(This replaces the plain `<Button ...>Settings</Button>` line — keep the rest of that button as-is, just wrap the new section + `<Separator />` above it. Import `Separator` from `$lib/components/ui/separator` if not already imported — check the existing import block first, it likely isn't imported in `Menu.svelte` yet.)

At the very bottom of the panel body (after the `{#if app.menuLevel === 'root'}...{:else}...{/if}` block, still inside `<div class="flex flex-col gap-5 px-3 pb-4 pt-1">`), render the passed-in extra status snippet so design mode can inject its draft row without `Menu.svelte` needing to know about drafts:

```svelte
          {@render statusExtra?.()}
```

**Note:** the `Button` component doesn't currently support an `href` prop (it's always a native `<button>`, see `button.svelte`). Since Task 1 needs real client-side navigation links for the Mode section, add `href` support to `Button` first:

In `src/lib/components/ui/button/button.svelte`, change:

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import { buttonVariants, type ButtonSize, type ButtonVariant } from './button-variants';

  type Props = (HTMLButtonAttributes | HTMLAnchorAttributes) & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    href?: string;
    children?: Snippet;
  };

  let {
    class: className,
    variant = 'default',
    size = 'default',
    type = 'button',
    href,
    children,
    ...restProps
  }: Props = $props();
</script>

{#if href}
  <a {href} class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
    {@render children?.()}
  </a>
{:else}
  <button {type} class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
    {@render children?.()}
  </button>
{/if}
```

Add `import type { HTMLAnchorAttributes } from 'svelte/elements';` to the existing `svelte/elements` import line.

- [ ] **Step 6: Pass `mode` through from `AppShell.svelte`, and let route files inject map layers**

`AppShell.svelte` owns `<MapCanvas>` internally — route files never see it directly — so any layers a route wants rendered on the map (Design mode's draft-driven layers, added in Task 16) have to go in through a snippet prop, the same way the toolbar/editor panel do. Add `mode`, `hasDraftProblem`, and four snippet props (`toolbar`, `editorPanel`, `menuStatusExtra`, `mapLayers`) now, and make the existing map-mode layers conditional on `mode === 'map'` so Design mode's own layers (rendered via `mapLayers`, wired up in Task 16) are the only thing drawn when editing:

```ts
  let {
    mode = 'map',
    hasDraftProblem = false,
    toolbar,
    editorPanel,
    menuStatusExtra,
    mapLayers
  }: {
    mode?: 'map' | 'design';
    hasDraftProblem?: boolean;
    toolbar?: Snippet;
    editorPanel?: Snippet;
    menuStatusExtra?: Snippet;
    mapLayers?: Snippet;
  } = $props();
```

Add `import type { Snippet } from 'svelte';` if not already present. Update the `<Menu {app} onImport={handleImport} />` line to:

```svelte
  <Menu {app} onImport={handleImport} {mode} statusExtra={menuStatusExtra} />
```

(`hasDraftProblem` is accepted by `AppShell` now but not yet forwarded to `Menu` — `Menu` only gains that prop in Task 15, which also adds the forwarding. Forwarding it before then would fail `svelte-check`.)

Change the `<MapCanvas>` block from:

```svelte
  <MapCanvas
    tile={app.tile}
    fitFeatures={app.loadState === 'loaded' ? app.features : null}
    onFailover={(n) => app.failoverTile(n)}
    onBothTilesDown={() => (tilesDown = true)}
    onDeselect={() => app.selectFeature(null)}
  >
    <ObstacleLayer
      features={app.obstacles}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <CombiLayer
      features={app.combis}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <LandmarkLayer
      features={app.landmarks}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
  </MapCanvas>
```

to:

```svelte
  <MapCanvas
    tile={app.tile}
    fitFeatures={app.loadState === 'loaded' ? app.features : null}
    onFailover={(n) => app.failoverTile(n)}
    onBothTilesDown={() => (tilesDown = true)}
    onDeselect={() => app.selectFeature(null)}
  >
    {#if mode === 'map'}
      <ObstacleLayer
        features={app.obstacles}
        selectedId={app.selectedId}
        onSelect={(id) => app.selectFeature(id)}
      />
      <CombiLayer
        features={app.combis}
        selectedId={app.selectedId}
        onSelect={(id) => app.selectFeature(id)}
      />
      <LandmarkLayer
        features={app.landmarks}
        selectedId={app.selectedId}
        onSelect={(id) => app.selectFeature(id)}
      />
    {/if}
    {@render mapLayers?.()}
  </MapCanvas>
```

Render the toolbar and editor panel snippets right after the `<Menu>` line, still inside the root `<div class="fixed inset-0 ...">`:

```svelte
  {@render toolbar?.()}
  {@render editorPanel?.()}
```

- [ ] **Step 7: Create the `/design` route scaffold**

Create `src/routes/design/+page.svelte`. For this step, wire it minimally (no toolbar/editor yet — those land in later tasks) so the route is navigable and testable end-to-end right away:

```svelte
<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
</script>

<AppShell mode="design" />
```

- [ ] **Step 8: Manual verification**

Run `pnpm dev`, open the app, click the hamburger menu. Confirm:
- A "Weergave / View" section appears above Settings with Kaart/Ontwerp (Map/Design) rows and a disabled Test row.
- Clicking "Ontwerp" navigates to `/design` and the Design row is now highlighted; clicking "Kaart" navigates back to `/` with Map highlighted.
- The map, tile picker, and existing Settings/map-data rows still work identically on both routes.

Run `pnpm check` — must pass with no new type errors.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/specs/2026-06-25-hindernisbaan-design.md package.json pnpm-lock.yaml src/app.css src/lib/i18n/dict.ts src/lib/components/AppShell.svelte src/lib/components/Menu.svelte src/lib/components/ui/button/button.svelte src/routes/design/+page.svelte
git commit -m "feat: scaffold /design route with Mode menu section"
```

---

## Task 2: Plain form primitives — Label, Input, Textarea

**Files:**
- Create: `src/lib/components/ui/label/label.svelte`
- Create: `src/lib/components/ui/label/index.ts`
- Create: `src/lib/components/ui/input/input.svelte`
- Create: `src/lib/components/ui/input/index.ts`
- Create: `src/lib/components/ui/textarea/textarea.svelte`
- Create: `src/lib/components/ui/textarea/index.ts`

**Interfaces:**
- Produces: `Label` (wraps bits-ui `Label.Root`, `for` + `class` + children), `Input` (native `<input>`, `class` + `value` bindable via `HTMLInputAttributes`), `Textarea` (native `<textarea>`).

- [ ] **Step 1: Create `label.svelte`**

Verified against `node_modules/bits-ui/dist/bits/label/exports.d.ts` (`Label.Root` only, `LabelRootProps`).

```svelte
<script lang="ts">
  import { Label as LabelPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    children,
    ...restProps
  }: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
  data-slot="label"
  class={cn('text-sm font-medium leading-none text-foreground', className)}
  {...restProps}
>
  {@render children?.()}
</LabelPrimitive.Root>
```

```ts
// index.ts
import Root from './label.svelte';
export { Root, Root as Label };
```

- [ ] **Step 2: Create `input.svelte`**

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    class: className,
    value = $bindable(),
    type = 'text',
    ...restProps
  }: HTMLInputAttributes = $props();
</script>

<input
  {type}
  data-slot="input"
  bind:value
  class={cn(
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...restProps}
/>
```

```ts
// index.ts
import Root from './input.svelte';
export { Root, Root as Input };
```

- [ ] **Step 3: Create `textarea.svelte`**

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  let {
    class: className,
    value = $bindable(),
    rows = 3,
    ...restProps
  }: HTMLTextareaAttributes = $props();
</script>

<textarea
  data-slot="textarea"
  bind:value
  {rows}
  class={cn(
    'flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...restProps}
></textarea>
```

```ts
// index.ts
import Root from './textarea.svelte';
export { Root, Root as Textarea };
```

- [ ] **Step 4: Verify**

Run `pnpm check` — new files must type-check clean (nothing imports them yet, so this only catches syntax/type errors in isolation).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/label src/lib/components/ui/input src/lib/components/ui/textarea
git commit -m "feat: add shadcn-svelte Label, Input, Textarea primitives"
```

---

## Task 3: Sheet primitive

Built on bits-ui's `Dialog` (verified: `Dialog.Root/Portal/Overlay/Content/Title/Description/Close` in `node_modules/bits-ui/dist/bits/dialog/exports.d.ts`; `Root` exposes `open = $bindable(false)`; `Content` renders a plain focus-trapped div and expects to sit inside `Dialog.Portal` next to `Dialog.Overlay`, per the installed source). No `Trigger` needed — this app opens the Sheet programmatically when a feature is selected.

**Files:**
- Create: `src/lib/components/ui/sheet/sheet-overlay.svelte`
- Create: `src/lib/components/ui/sheet/sheet-content.svelte`
- Create: `src/lib/components/ui/sheet/sheet-header.svelte`
- Create: `src/lib/components/ui/sheet/sheet-footer.svelte`
- Create: `src/lib/components/ui/sheet/sheet-title.svelte`
- Create: `src/lib/components/ui/sheet/sheet-description.svelte`
- Create: `src/lib/components/ui/sheet/sheet-close.svelte`
- Create: `src/lib/components/ui/sheet/index.ts`

**Interfaces:**
- Produces: `Sheet.Root` (= `Dialog.Root`, use `bind:open`), `Sheet.Portal` (= `Dialog.Portal`), `Sheet.Overlay`, `Sheet.Content` (fixed right-side panel, `side` prop defaults `'right'`), `Sheet.Header`, `Sheet.Footer`, `Sheet.Title`, `Sheet.Description`, `Sheet.Close`.

- [ ] **Step 1: Create `sheet-overlay.svelte`**

```svelte
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
  data-slot="sheet-overlay"
  class={cn(
    'fixed inset-0 z-[1600] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    className
  )}
  {...restProps}
/>
```

- [ ] **Step 2: Create `sheet-content.svelte`**

```svelte
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import SheetOverlay from './sheet-overlay.svelte';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    class: className,
    children,
    side = 'right',
    ...restProps
  }: DialogPrimitive.ContentProps & { side?: 'right' | 'bottom' } = $props();

  const sideClasses = {
    right:
      'inset-y-0 right-0 h-full w-[min(92vw,420px)] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
    bottom:
      'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
  } as const;
</script>

<DialogPrimitive.Portal>
  <SheetOverlay />
  <DialogPrimitive.Content
    data-slot="sheet-content"
    class={cn(
      'fixed z-[1650] flex flex-col gap-4 bg-background p-5 shadow-xl outline-none',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300',
      sideClasses[side],
      className
    )}
    {...restProps}
  >
    {@render children?.()}
    <DialogPrimitive.Close
      class="absolute right-4 top-4 rounded-md text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <XIcon class="size-4" />
      <span class="sr-only">Close</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
```

- [ ] **Step 3: Create `sheet-header.svelte`, `sheet-footer.svelte`**

```svelte
<!-- sheet-header.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  let {
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div data-slot="sheet-header" class={cn('flex flex-col gap-1 pr-8', className)} {...restProps}>
  {@render children?.()}
</div>
```

```svelte
<!-- sheet-footer.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  let {
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div
  data-slot="sheet-footer"
  class={cn('mt-auto flex flex-col gap-2 border-t pt-4', className)}
  {...restProps}
>
  {@render children?.()}
</div>
```

- [ ] **Step 4: Create `sheet-title.svelte`, `sheet-description.svelte`, `sheet-close.svelte`**

```svelte
<!-- sheet-title.svelte -->
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title
  data-slot="sheet-title"
  class={cn('text-base font-semibold text-foreground', className)}
  {...restProps}
/>
```

```svelte
<!-- sheet-description.svelte -->
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
  data-slot="sheet-description"
  class={cn('text-sm text-muted-foreground', className)}
  {...restProps}
/>
```

```svelte
<!-- sheet-close.svelte -->
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';

  let { children, ...restProps }: DialogPrimitive.CloseProps = $props();
</script>

<DialogPrimitive.Close {...restProps}>
  {@render children?.()}
</DialogPrimitive.Close>
```

- [ ] **Step 5: Create `index.ts`**

```ts
import { Dialog as SheetPrimitive } from 'bits-ui';
import Overlay from './sheet-overlay.svelte';
import Content from './sheet-content.svelte';
import Header from './sheet-header.svelte';
import Footer from './sheet-footer.svelte';
import Title from './sheet-title.svelte';
import Description from './sheet-description.svelte';
import Close from './sheet-close.svelte';

const Root = SheetPrimitive.Root;
const Portal = SheetPrimitive.Portal;

export {
  Root,
  Portal,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
  Close,
  //
  Root as Sheet,
  Content as SheetContent,
  Header as SheetHeader,
  Footer as SheetFooter,
  Title as SheetTitle,
  Description as SheetDescription,
  Close as SheetClose
};
```

- [ ] **Step 6: Verify**

`pnpm check` passes (unused-but-valid files).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/ui/sheet
git commit -m "feat: add shadcn-svelte Sheet primitive"
```

---

## Task 4: AlertDialog primitive

Verified against `node_modules/bits-ui/dist/bits/alert-dialog/exports.d.ts`: `AlertDialog.Root/Content/Action/Cancel` are its own; `Overlay`/`Trigger`/`Description`/`Title` are re-exports of `Dialog`'s. `Action`/`Cancel` render plain `<button>`s (verified in installed source), so they're styled with `buttonVariants` directly.

**Files:**
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-overlay.svelte`
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-content.svelte`
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-header.svelte`
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-footer.svelte`
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-title.svelte`
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-description.svelte`
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-action.svelte`
- Create: `src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte`
- Create: `src/lib/components/ui/alert-dialog/index.ts`

**Interfaces:**
- Consumes: `buttonVariants` from `$lib/components/ui/button/button-variants`.
- Produces: `AlertDialog.Root` (`bind:open`), `.Content`, `.Header`, `.Footer`, `.Title`, `.Description`, `.Action` (default button variant), `.Cancel` (outline variant).

- [ ] **Step 1: Create `alert-dialog-overlay.svelte`**

```svelte
<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: AlertDialogPrimitive.OverlayProps = $props();
</script>

<AlertDialogPrimitive.Overlay
  data-slot="alert-dialog-overlay"
  class={cn(
    'fixed inset-0 z-[1800] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    className
  )}
  {...restProps}
/>
```

- [ ] **Step 2: Create `alert-dialog-content.svelte`**

```svelte
<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import AlertDialogOverlay from './alert-dialog-overlay.svelte';

  let { class: className, children, ...restProps }: AlertDialogPrimitive.ContentProps = $props();
</script>

<AlertDialogPrimitive.Portal>
  <AlertDialogOverlay />
  <AlertDialogPrimitive.Content
    data-slot="alert-dialog-content"
    class={cn(
      'fixed left-1/2 top-1/2 z-[1850] flex w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-background p-6 shadow-xl outline-none',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </AlertDialogPrimitive.Content>
</AlertDialogPrimitive.Portal>
```

- [ ] **Step 3: Create `alert-dialog-header.svelte`, `alert-dialog-footer.svelte`**

```svelte
<!-- alert-dialog-header.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  let {
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div data-slot="alert-dialog-header" class={cn('flex flex-col gap-1.5', className)} {...restProps}>
  {@render children?.()}
</div>
```

```svelte
<!-- alert-dialog-footer.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  let {
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div
  data-slot="alert-dialog-footer"
  class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
  {...restProps}
>
  {@render children?.()}
</div>
```

- [ ] **Step 4: Create `alert-dialog-title.svelte`, `alert-dialog-description.svelte`**

```svelte
<!-- alert-dialog-title.svelte -->
<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: AlertDialogPrimitive.TitleProps = $props();
</script>

<AlertDialogPrimitive.Title
  data-slot="alert-dialog-title"
  class={cn('text-base font-semibold text-foreground', className)}
  {...restProps}
/>
```

```svelte
<!-- alert-dialog-description.svelte -->
<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: AlertDialogPrimitive.DescriptionProps = $props();
</script>

<AlertDialogPrimitive.Description
  data-slot="alert-dialog-description"
  class={cn('text-sm text-muted-foreground', className)}
  {...restProps}
/>
```

- [ ] **Step 5: Create `alert-dialog-action.svelte`, `alert-dialog-cancel.svelte`**

```svelte
<!-- alert-dialog-action.svelte -->
<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import { buttonVariants } from '$lib/components/ui/button/button-variants';

  let { class: className, children, ...restProps }: AlertDialogPrimitive.ActionProps = $props();
</script>

<AlertDialogPrimitive.Action
  class={cn(buttonVariants({ variant: 'destructive' }), className)}
  {...restProps}
>
  {@render children?.()}
</AlertDialogPrimitive.Action>
```

```svelte
<!-- alert-dialog-cancel.svelte -->
<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import { buttonVariants } from '$lib/components/ui/button/button-variants';

  let { class: className, children, ...restProps }: AlertDialogPrimitive.CancelProps = $props();
</script>

<AlertDialogPrimitive.Cancel
  class={cn(buttonVariants({ variant: 'outline' }), className)}
  {...restProps}
>
  {@render children?.()}
</AlertDialogPrimitive.Cancel>
```

(`Action` defaults to the `destructive` button variant since this plan's only use of AlertDialog — discarding a draft — is a destructive confirmation. This is a deliberate simplification vs. shadcn-svelte's upstream default of `variant: 'default'` for Action; call it out if a future non-destructive use appears.)

- [ ] **Step 6: Create `index.ts`**

```ts
import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
import Content from './alert-dialog-content.svelte';
import Header from './alert-dialog-header.svelte';
import Footer from './alert-dialog-footer.svelte';
import Title from './alert-dialog-title.svelte';
import Description from './alert-dialog-description.svelte';
import Action from './alert-dialog-action.svelte';
import Cancel from './alert-dialog-cancel.svelte';

const Root = AlertDialogPrimitive.Root;

export {
  Root,
  Content,
  Header,
  Footer,
  Title,
  Description,
  Action,
  Cancel,
  //
  Root as AlertDialog,
  Content as AlertDialogContent,
  Header as AlertDialogHeader,
  Footer as AlertDialogFooter,
  Title as AlertDialogTitle,
  Description as AlertDialogDescription,
  Action as AlertDialogAction,
  Cancel as AlertDialogCancel
};
```

- [ ] **Step 7: Verify & commit**

`pnpm check` passes.

```bash
git add src/lib/components/ui/alert-dialog
git commit -m "feat: add shadcn-svelte AlertDialog primitive"
```

---

## Task 5: ToggleGroup primitive

Verified against `node_modules/bits-ui/dist/bits/toggle-group/types.d.ts`: single-select needs `type="single"` + `value`/`onValueChange` (string); `Item` renders a plain `<button>` and exposes `pressed` via its children snippet prop for style hooks, but we drive styling off `data-state` (set by bits-ui, same `getDataOpenClosed`-style convention) instead of consuming the snippet prop, to keep the component usable with plain `{@render}` text children.

**Files:**
- Create: `src/lib/components/ui/toggle-group/toggle-group-variants.ts`
- Create: `src/lib/components/ui/toggle-group/toggle-group.svelte`
- Create: `src/lib/components/ui/toggle-group/toggle-group-item.svelte`
- Create: `src/lib/components/ui/toggle-group/index.ts`

- [ ] **Step 1: Create `toggle-group-variants.ts`**

```ts
import { type VariantProps, tv } from 'tailwind-variants';

export const toggleGroupItemVariants = tv({
  base: 'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'
});

export type ToggleGroupItemVariant = VariantProps<typeof toggleGroupItemVariants>;
```

- [ ] **Step 2: Create `toggle-group.svelte`**

```svelte
<script lang="ts">
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    value = $bindable(''),
    children,
    ...restProps
  }: ToggleGroupPrimitive.RootProps = $props();
</script>

<ToggleGroupPrimitive.Root
  bind:value
  type="single"
  data-slot="toggle-group"
  class={cn('inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1', className)}
  {...restProps}
>
  {@render children?.()}
</ToggleGroupPrimitive.Root>
```

- [ ] **Step 3: Create `toggle-group-item.svelte`**

```svelte
<script lang="ts">
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import { toggleGroupItemVariants } from './toggle-group-variants';

  let { class: className, children, ...restProps }: ToggleGroupPrimitive.ItemProps = $props();
</script>

<ToggleGroupPrimitive.Item
  data-slot="toggle-group-item"
  class={cn(toggleGroupItemVariants(), className)}
  {...restProps}
>
  {@render children?.()}
</ToggleGroupPrimitive.Item>
```

- [ ] **Step 4: Create `index.ts`**

```ts
import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
import Root from './toggle-group.svelte';
import Item from './toggle-group-item.svelte';

export {
  Root,
  Item,
  //
  Root as ToggleGroup,
  Item as ToggleGroupItem
};

export type RootProps = ToggleGroupPrimitive.RootProps;
```

- [ ] **Step 5: Verify & commit**

`pnpm check` passes.

```bash
git add src/lib/components/ui/toggle-group
git commit -m "feat: add shadcn-svelte ToggleGroup primitive"
```

---

## Task 6: Popover + Command primitives (icon picker infrastructure)

Verified against `node_modules/bits-ui/dist/bits/popover/*` and `.../command/*`: `Popover.Content` needs a `Popover.Portal` wrapper (same convention as Dialog); `Command.Root` has `value = $bindable('')`; `Command.List` is a plain wrapper div (no separate Viewport required for a non-virtualized list); `Command.Item` takes `value`/`onSelect`/`keywords` and renders its own `<div>`.

**Files:**
- Create: `src/lib/components/ui/popover/popover-content.svelte`
- Create: `src/lib/components/ui/popover/index.ts`
- Create: `src/lib/components/ui/command/command.svelte`
- Create: `src/lib/components/ui/command/command-input.svelte`
- Create: `src/lib/components/ui/command/command-list.svelte`
- Create: `src/lib/components/ui/command/command-empty.svelte`
- Create: `src/lib/components/ui/command/command-group.svelte`
- Create: `src/lib/components/ui/command/command-item.svelte`
- Create: `src/lib/components/ui/command/index.ts`

- [ ] **Step 1: Create `popover-content.svelte`**

```svelte
<script lang="ts">
  import { Popover as PopoverPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    children,
    sideOffset = 6,
    align = 'start',
    ...restProps
  }: PopoverPrimitive.ContentProps = $props();
</script>

<PopoverPrimitive.Portal>
  <PopoverPrimitive.Content
    data-slot="popover-content"
    {sideOffset}
    {align}
    class={cn(
      'z-[1700] w-72 rounded-lg border bg-popover p-0 text-popover-foreground shadow-md outline-none',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </PopoverPrimitive.Content>
</PopoverPrimitive.Portal>
```

- [ ] **Step 2: Create `popover/index.ts`**

```ts
import { Popover as PopoverPrimitive } from 'bits-ui';
import Content from './popover-content.svelte';

const Root = PopoverPrimitive.Root;
const Trigger = PopoverPrimitive.Trigger;

export {
  Root,
  Trigger,
  Content,
  //
  Root as Popover,
  Trigger as PopoverTrigger,
  Content as PopoverContent
};
```

- [ ] **Step 3: Create `command.svelte`**

```svelte
<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    value = $bindable(''),
    children,
    ...restProps
  }: CommandPrimitive.RootProps = $props();
</script>

<CommandPrimitive.Root
  bind:value
  data-slot="command"
  class={cn('flex h-full w-full flex-col overflow-hidden', className)}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.Root>
```

- [ ] **Step 4: Create `command-input.svelte`**

```svelte
<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import SearchIcon from '@lucide/svelte/icons/search';

  let {
    class: className,
    value = $bindable(''),
    ...restProps
  }: CommandPrimitive.InputProps = $props();
</script>

<div class="flex items-center gap-2 border-b px-3">
  <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
  <CommandPrimitive.Input
    bind:value
    data-slot="command-input"
    class={cn(
      'flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50',
      className
    )}
    {...restProps}
  />
</div>
```

- [ ] **Step 5: Create `command-list.svelte`, `command-empty.svelte`, `command-group.svelte`**

```svelte
<!-- command-list.svelte -->
<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: CommandPrimitive.ListProps = $props();
</script>

<CommandPrimitive.List
  data-slot="command-list"
  class={cn('max-h-72 overflow-y-auto overflow-x-hidden p-1', className)}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.List>
```

```svelte
<!-- command-empty.svelte -->
<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: CommandPrimitive.EmptyProps = $props();
</script>

<CommandPrimitive.Empty
  data-slot="command-empty"
  class={cn('py-6 text-center text-sm text-muted-foreground', className)}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.Empty>
```

```svelte
<!-- command-group.svelte -->
<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    value = '',
    children,
    ...restProps
  }: CommandPrimitive.GroupProps = $props();
</script>

<CommandPrimitive.Group {value} data-slot="command-group" class={cn('py-1', className)} {...restProps}>
  <CommandPrimitive.GroupItems class={cn('grid grid-cols-4 gap-1 px-1', className)}>
    {@render children?.()}
  </CommandPrimitive.GroupItems>
</CommandPrimitive.Group>
```

(Icon results render as a 4-column grid of glyph+label tiles rather than a single-column list — reads much faster over ~1900 candidates than a vertical list. `command-group.svelte` bakes the grid into `GroupItems`; the plan only ever uses one group, so pushing the grid class here rather than into `CommandItem` keeps that one call site simple.)

- [ ] **Step 6: Create `command-item.svelte`**

```svelte
<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: CommandPrimitive.ItemProps = $props();
</script>

<CommandPrimitive.Item
  data-slot="command-item"
  class={cn(
    'flex cursor-pointer flex-col items-center gap-1 rounded-md p-2 text-center text-[11px] text-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
    className
  )}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.Item>
```

- [ ] **Step 7: Create `command/index.ts`**

```ts
import Root from './command.svelte';
import Input from './command-input.svelte';
import List from './command-list.svelte';
import Empty from './command-empty.svelte';
import Group from './command-group.svelte';
import Item from './command-item.svelte';

export {
  Root,
  Input,
  List,
  Empty,
  Group,
  Item,
  //
  Root as Command,
  Input as CommandInput,
  List as CommandList,
  Empty as CommandEmpty,
  Group as CommandGroup,
  Item as CommandItem
};
```

- [ ] **Step 8: Verify & commit**

`pnpm check` passes.

```bash
git add src/lib/components/ui/popover src/lib/components/ui/command
git commit -m "feat: add shadcn-svelte Popover and Command primitives"
```

---

## Task 7: Toast wiring (svelte-sonner)

**Files:**
- Modify: `src/lib/components/AppShell.svelte`
- Modify: `src/lib/i18n/dict.ts`

**Interfaces:**
- Produces: a mounted `<Toaster />` in `AppShell` so any module can call `toast.error(...)` / `toast.success(...)` from `svelte-sonner` and have it render. Later tasks (draft validation, discard) call `toast.error`/`toast.success` directly — no wrapper module needed for MVP scope.

- [ ] **Step 1: Mount `<Toaster />`**

In `src/lib/components/AppShell.svelte`, add:

```ts
  import { Toaster } from 'svelte-sonner';
```

Render it once, near the top of the root `<div class="fixed inset-0 ...">` (position doesn't matter, it portals itself):

```svelte
  <Toaster position="bottom-center" richColors closeButton />
```

- [ ] **Step 2: Add generic toast copy keys**

In `src/lib/i18n/dict.ts`, add to both locales (near the `draft.*` keys added in Task 12 — for now just add these two, used by Task 12/13):

```ts
    // nl
    'draft.toast.invalid': 'Concept heeft een probleem',
    'draft.toast.discarded': 'Concept verwijderd',
```

```ts
    // en
    'draft.toast.invalid': 'Draft has a problem',
    'draft.toast.discarded': 'Draft discarded',
```

- [ ] **Step 3: Manual verification**

`pnpm dev`, open the browser console on any route, run `import('svelte-sonner').then(m => m.toast('test'))` — confirm a toast appears bottom-center. (This is a scratch check, not a permanent test hook.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/AppShell.svelte src/lib/i18n/dict.ts
git commit -m "feat: wire up svelte-sonner toaster"
```

---

## Task 8: ID generation utility

**Files:**
- Create: `src/lib/data/ids.ts`
- Create: `src/lib/data/ids.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/ids.test.ts
import { describe, expect, it } from 'vitest';
import { generateId } from './ids';

describe('generateId', () => {
  it('returns a string matching the schema UUID pattern', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns a different id on each call', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm vitest run src/lib/data/ids.test.ts`
Expected: FAIL — `Cannot find module './ids'`.

- [ ] **Step 3: Implement**

```ts
// src/lib/data/ids.ts
export function generateId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm vitest run src/lib/data/ids.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/ids.ts src/lib/data/ids.test.ts
git commit -m "feat: add generateId() for new draft features"
```

---

## Task 9: Export `validateCollection` from the loader

The loader already compiles the schema and validates internally (`assertValid`) but keeps it private. The draft store needs the same validation on every edit, so it's exported as a reusable, non-throwing check rather than duplicating the `ajv` setup.

**Files:**
- Modify: `src/lib/data/loader.ts`
- Modify: `src/lib/data/loader.test.ts`

**Interfaces:**
- Produces: `validateCollection(data: unknown): { valid: true } | { valid: false; errors: string }`

- [ ] **Step 1: Add a failing test**

Add to `src/lib/data/loader.test.ts` (append near the existing tests, following its existing `describe`/`it` style — read the file first to match its import style exactly):

```ts
describe('validateCollection', () => {
  it('returns valid: true for a well-formed collection', () => {
    const result = validateCollection({
      type: 'FeatureCollection',
      club: 'Test',
      version: '2026-01-01',
      features: []
    });
    expect(result.valid).toBe(true);
  });

  it('returns valid: false with an error message for a malformed collection', () => {
    const result = validateCollection({ type: 'FeatureCollection' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
```

Add `validateCollection` to the existing `import { ... } from './loader';` line at the top of the test file.

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm vitest run src/lib/data/loader.test.ts`
Expected: FAIL — `validateCollection is not a function` (or a TS error if `pnpm check` is run instead).

- [ ] **Step 3: Implement in `loader.ts`**

Replace the existing `assertValid` function and its usages with an exported, reusable check. The full modified section (`assertValid` through `fetchFeatures`/`parseFeatures`) becomes:

```ts
export type ValidationResult = { valid: true } | { valid: false; errors: string };

export function validateCollection(data: unknown): ValidationResult {
  if (validate(data)) return { valid: true };
  return { valid: false, errors: ajv.errorsText(validate.errors) };
}

function assertValid(data: unknown): asserts data is FeatureCollection {
  const result = validateCollection(data);
  if (!result.valid) {
    throw new LoadError(`Invalid map data: ${result.errors}`);
  }
}
```

(Everything else in `loader.ts` — `fetchFeatures`, `parseFeatures`, the `ajv`/`validate` setup, `LoadError`, `OBSTACLES_URL` — is unchanged; `assertValid` still exists and is still called the same way, just implemented in terms of the new exported function.)

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm vitest run src/lib/data/loader.test.ts`
Expected: PASS (all existing tests + 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/loader.ts src/lib/data/loader.test.ts
git commit -m "refactor: export validateCollection from the loader for draft-store reuse"
```

---

## Task 10: Icon name utilities

**Files:**
- Create: `src/lib/durf-ds/icons.ts`
- Create: `src/lib/durf-ds/icons.test.ts`

**Interfaces:**
- Produces: `pascalToKebab(name: string): string`, `kebabToPascal(name: string): string`, `ALL_ICON_NAMES: string[]` (kebab-case, derived from `@lucide/svelte`'s `icons` namespace — no hand-maintained list, no build step, always in sync with the installed package version), `getIconComponent(kebabName: string): Component | undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/durf-ds/icons.test.ts
import { describe, expect, it } from 'vitest';
import { pascalToKebab, kebabToPascal, ALL_ICON_NAMES, getIconComponent } from './icons';

describe('pascalToKebab', () => {
  it('converts simple PascalCase names', () => {
    expect(pascalToKebab('Users')).toBe('users');
    expect(pascalToKebab('ArrowLeft')).toBe('arrow-left');
  });

  it('handles names with leading capital runs correctly', () => {
    expect(pascalToKebab('AArrowDown')).toBe('a-arrow-down');
    expect(pascalToKebab('ALargeSmall')).toBe('a-large-small');
  });
});

describe('kebabToPascal', () => {
  it('is the inverse of pascalToKebab for known icons', () => {
    expect(kebabToPascal('arrow-left')).toBe('ArrowLeft');
    expect(kebabToPascal('users')).toBe('Users');
    expect(kebabToPascal('a-arrow-down')).toBe('AArrowDown');
  });
});

describe('ALL_ICON_NAMES', () => {
  it('is a large, sorted, deduplicated list of kebab-case names', () => {
    expect(ALL_ICON_NAMES.length).toBeGreaterThan(1000);
    expect(ALL_ICON_NAMES).toContain('users');
    expect(ALL_ICON_NAMES).toContain('arrow-left');
    expect(new Set(ALL_ICON_NAMES).size).toBe(ALL_ICON_NAMES.length);
    expect([...ALL_ICON_NAMES].sort()).toEqual(ALL_ICON_NAMES);
  });
});

describe('getIconComponent', () => {
  it('resolves a real component for a known kebab name', () => {
    expect(getIconComponent('users')).toBeTruthy();
  });

  it('returns undefined for an unknown name', () => {
    expect(getIconComponent('not-a-real-icon-xyz')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm vitest run src/lib/durf-ds/icons.test.ts`
Expected: FAIL — `Cannot find module './icons'`.

- [ ] **Step 3: Implement**

```ts
// src/lib/durf-ds/icons.ts
import { icons } from '@lucide/svelte';
import type { Component } from 'svelte';

export function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

const KEBAB_TO_PASCAL = new Map<string, string>(
  Object.keys(icons).map((pascal) => [pascalToKebab(pascal), pascal])
);

export function kebabToPascal(name: string): string | undefined {
  return KEBAB_TO_PASCAL.get(name);
}

export const ALL_ICON_NAMES: string[] = [...KEBAB_TO_PASCAL.keys()].sort();

export function getIconComponent(kebabName: string): Component | undefined {
  const pascal = kebabToPascal(kebabName);
  if (!pascal) return undefined;
  return (icons as Record<string, Component>)[pascal];
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm vitest run src/lib/durf-ds/icons.test.ts`
Expected: PASS (7 tests). If `AArrowDown`/`ALargeSmall` round-tripping fails, adjust the second regex in `pascalToKebab` — verify by running `node -e "console.log(require('./src/lib/durf-ds/icons.ts'))"`-style manual checks isn't available for `.ts` directly, so rely on the Vitest run's actual pass/fail as ground truth here rather than hand-simulating the regex.

- [ ] **Step 5: Commit**

```bash
git add src/lib/durf-ds/icons.ts src/lib/durf-ds/icons.test.ts
git commit -m "feat: add Lucide icon name lookup utilities for the icon picker"
```

---

## Task 11: IconPicker component

**Files:**
- Create: `src/lib/design/IconPicker.svelte`

**Interfaces:**
- Consumes: `ALL_ICON_NAMES`, `getIconComponent` from `$lib/durf-ds/icons`; `Popover`/`PopoverTrigger`/`PopoverContent` from `$lib/components/ui/popover`; `Command`/`CommandInput`/`CommandList`/`CommandEmpty`/`CommandGroup`/`CommandItem` from `$lib/components/ui/command`; `Button` from `$lib/components/ui/button`.
- Produces: a component with props `{ value: string | undefined; onSelect: (kebabName: string) => void }` rendering a trigger button (shows the current icon + name, or a placeholder) that opens a searchable grid popover.

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
  import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '$lib/components/ui/command';
  import { Button } from '$lib/components/ui/button';
  import { ALL_ICON_NAMES, getIconComponent } from '$lib/durf-ds/icons';
  import { t, type Locale } from '$lib/i18n';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';

  let {
    value,
    onSelect,
    locale
  }: {
    value: string | undefined;
    onSelect: (kebabName: string) => void;
    locale: Locale;
  } = $props();

  let open = $state(false);
  const SelectedIcon = $derived(value ? getIconComponent(value) : undefined);
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button variant="outline" class="w-full justify-between" {...props}>
        <span class="flex items-center gap-2">
          {#if SelectedIcon}
            <SelectedIcon class="size-4" />
            <span>{value}</span>
          {:else}
            <span class="text-muted-foreground">{t(locale, 'design.icon.placeholder')}</span>
          {/if}
        </span>
        <ChevronsUpDownIcon class="size-4 text-muted-foreground" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-80 p-0">
    <Command>
      <CommandInput placeholder={t(locale, 'design.icon.search')} />
      <CommandList>
        <CommandEmpty>{t(locale, 'design.icon.empty')}</CommandEmpty>
        <CommandGroup>
          {#each ALL_ICON_NAMES as name (name)}
            {@const Icon = getIconComponent(name)}
            <CommandItem
              value={name}
              onSelect={() => {
                onSelect(name);
                open = false;
              }}
            >
              {#if Icon}
                <Icon class="size-5" />
              {/if}
              <span class="truncate">{name}</span>
            </CommandItem>
          {/each}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

- [ ] **Step 2: Add its i18n keys**

Add to both locales in `src/lib/i18n/dict.ts`:

```ts
    // nl
    'design.icon.placeholder': 'Kies een icoon…',
    'design.icon.search': 'Zoek icoon…',
    'design.icon.empty': 'Geen iconen gevonden',
```

```ts
    // en
    'design.icon.placeholder': 'Choose an icon…',
    'design.icon.search': 'Search icons…',
    'design.icon.empty': 'No icons found',
```

- [ ] **Step 3: Verify**

`pnpm check` passes. This component isn't mounted anywhere yet (Task 14 wires it into the editor Sheet) — type-checking in isolation is the only available check at this point.

- [ ] **Step 4: Commit**

```bash
git add src/lib/design/IconPicker.svelte src/lib/i18n/dict.ts
git commit -m "feat: add searchable Lucide icon picker for landmark features"
```

---

## Task 12: Draft mutations (pure) + draft state store

**Files:**
- Create: `src/lib/design/draftMutations.ts`
- Create: `src/lib/design/draftMutations.test.ts`
- Create: `src/lib/state/draft.svelte.ts`

**Interfaces:**
- Produces (pure, from `draftMutations.ts`):
  - `addFeature(features: MapFeature[], feature: MapFeature): MapFeature[]`
  - `updateFeature(features: MapFeature[], id: string, patch: Partial<MapFeature['properties']>): MapFeature[]`
  - `setKind(features: MapFeature[], id: string, kind: 'obstacle' | 'combi' | 'landmark'): MapFeature[]` — rebuilds `properties` from scratch on a kind switch (keeps `name`/`notes`, drops kind-specific keys that no longer apply, adds empty `members`/`icon` scaffolding for the new kind). A shallow `updateFeature({ kind })` merge is NOT usable for kind switches: it would leave stale keys behind (`combi→obstacle` keeps `members`, `landmark→obstacle` keeps `icon`), and with `additionalProperties: false` in the schema that's a permanently-invalid draft the UI can't repair.
  - `removeFeature(features: MapFeature[], id: string): MapFeature[]`
  - `addMember(features: MapFeature[], comboId: string): MapFeature[]` (appends `{ name: '' }`)
  - `updateMember(features: MapFeature[], comboId: string, index: number, patch: Partial<Member>): MapFeature[]`
  - `removeMember(features: MapFeature[], comboId: string, index: number): MapFeature[]`
- Produces (stateful, from `draft.svelte.ts`): `createDraftState()` returning an object with `features`, `obstacles`, `combis`, `landmarks`, `club`, `version`, `isValid`, `validationErrors`, `hasStoredDraft`, methods `loadOrInit(live: FeatureCollection)`, `addFeature`, `updateFeature`, `setKind(id, kind)`, `updateGeometry(id, geometry)`, `removeFeature`, `addMember`, `updateMember`, `removeMember`, `discard(live: FeatureCollection)`, `exportCollection(): FeatureCollection`. `obstacles`/`combis`/`landmarks` mirror `app.svelte.ts`'s existing kind-filtered getters exactly, so `design/+page.svelte` (Task 16) can drive `ObstacleLayer`/`CombiLayer`/`LandmarkLayer` from the draft the same way `AppShell` already drives them from live data.
- Consumes: `validateCollection` from `$lib/data/loader`; `readKey`/`writeKey` from `$lib/storage/local`; `generateId` from `$lib/data/ids`.

- [ ] **Step 1: Write the failing tests for `draftMutations.ts`**

```ts
// src/lib/design/draftMutations.test.ts
import { describe, expect, it } from 'vitest';
import {
  addFeature,
  updateFeature,
  setKind,
  removeFeature,
  addMember,
  updateMember,
  removeMember
} from './draftMutations';
import type { MapFeature, ObstacleFeature, CombiFeature } from '$lib/data/types';

const obstacle: ObstacleFeature = {
  type: 'Feature',
  id: 'obs-1',
  geometry: { type: 'Point', coordinates: [4.36, 52.02] },
  properties: { name: 'Klimrek', kind: 'obstacle' }
};

const combi: CombiFeature = {
  type: 'Feature',
  id: 'combi-1',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] },
  properties: { name: 'Parcours', kind: 'combi', members: [{ name: 'Balk 1' }] }
};

describe('addFeature', () => {
  it('appends the feature', () => {
    const result = addFeature([obstacle], combi);
    expect(result).toEqual([obstacle, combi]);
  });
});

describe('updateFeature', () => {
  it('shallow-merges the properties patch for the matching id', () => {
    const result = updateFeature([obstacle], 'obs-1', { name: 'Nieuw klimrek' });
    expect(result[0].properties.name).toBe('Nieuw klimrek');
    expect(result[0].properties.kind).toBe('obstacle');
  });

  it('leaves other features untouched', () => {
    const result = updateFeature([obstacle, combi], 'obs-1', { name: 'X' });
    expect(result[1]).toBe(combi);
  });
});

describe('removeFeature', () => {
  it('removes the feature with the matching id', () => {
    const result = removeFeature([obstacle, combi], 'obs-1');
    expect(result).toEqual([combi]);
  });
});

describe('setKind', () => {
  it('keeps name and notes when switching kind', () => {
    const noted: ObstacleFeature = {
      ...obstacle,
      properties: { name: 'Klimrek', kind: 'obstacle', notes: 'Hoog' }
    };
    const result = setKind([noted], 'obs-1', 'landmark');
    expect(result[0].properties).toEqual({ name: 'Klimrek', notes: 'Hoog', kind: 'landmark', icon: '' });
  });

  it('drops members when switching combi to obstacle', () => {
    const result = setKind([combi], 'combi-1', 'obstacle');
    expect(result[0].properties).toEqual({ name: 'Parcours', kind: 'obstacle' });
  });

  it('drops icon when switching landmark to obstacle', () => {
    const landmark: MapFeature = {
      type: 'Feature',
      id: 'lm-1',
      geometry: { type: 'Point', coordinates: [4.36, 52.02] },
      properties: { name: 'Verzamelplek', kind: 'landmark', icon: 'users' }
    };
    const result = setKind([landmark], 'lm-1', 'obstacle');
    expect(result[0].properties).toEqual({ name: 'Verzamelplek', kind: 'obstacle' });
  });

  it('adds an empty members array when switching to combi', () => {
    const poly: ObstacleFeature = {
      ...obstacle,
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] }
    };
    const result = setKind([poly], 'obs-1', 'combi');
    expect(result[0].properties).toEqual({ name: 'Klimrek', kind: 'combi', members: [] });
  });

  it('keeps existing members when re-selecting combi on a combi', () => {
    const result = setKind([combi], 'combi-1', 'combi');
    expect(result[0].properties).toEqual({ name: 'Parcours', kind: 'combi', members: [{ name: 'Balk 1' }] });
  });
});

describe('addMember', () => {
  it('appends an empty-named member to the matching combi', () => {
    const result = addMember([combi], 'combi-1') as [CombiFeature];
    expect(result[0].properties.members).toEqual([{ name: 'Balk 1' }, { name: '' }]);
  });

  it('is a no-op on a non-combi feature', () => {
    const result = addMember([obstacle], 'obs-1');
    expect(result).toEqual([obstacle]);
  });
});

describe('updateMember', () => {
  it('patches the member at the given index', () => {
    const result = updateMember([combi], 'combi-1', 0, { notes: 'Hoog' }) as [CombiFeature];
    expect(result[0].properties.members[0]).toEqual({ name: 'Balk 1', notes: 'Hoog' });
  });
});

describe('removeMember', () => {
  it('removes the member at the given index', () => {
    const result = removeMember([combi], 'combi-1', 0) as [CombiFeature];
    expect(result[0].properties.members).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm vitest run src/lib/design/draftMutations.test.ts`
Expected: FAIL — `Cannot find module './draftMutations'`.

- [ ] **Step 3: Implement `draftMutations.ts`**

```ts
import type { MapFeature, Member } from '$lib/data/types';

export function addFeature(
  features: MapFeature[],
  feature: MapFeature
): MapFeature[] {
  return [...features, feature];
}

export function updateFeature(
  features: MapFeature[],
  id: string,
  patch: Record<string, unknown>
): MapFeature[] {
  return features.map((f) =>
    f.id === id ? ({ ...f, properties: { ...f.properties, ...patch } } as MapFeature) : f
  );
}

export function setKind(
  features: MapFeature[],
  id: string,
  kind: 'obstacle' | 'combi' | 'landmark'
): MapFeature[] {
  return features.map((f) => {
    if (f.id !== id) return f;
    const base: { name: string; notes?: string } = { name: f.properties.name };
    if (f.properties.notes !== undefined) base.notes = f.properties.notes;
    if (kind === 'combi') {
      const members = f.properties.kind === 'combi' ? f.properties.members : [];
      return { ...f, properties: { ...base, kind, members } } as MapFeature;
    }
    if (kind === 'landmark') {
      const icon = f.properties.kind === 'landmark' ? f.properties.icon : '';
      return { ...f, properties: { ...base, kind, icon } } as MapFeature;
    }
    return { ...f, properties: { ...base, kind } } as MapFeature;
  });
}

export function removeFeature(features: MapFeature[], id: string): MapFeature[] {
  return features.filter((f) => f.id !== id);
}

export function addMember(features: MapFeature[], comboId: string): MapFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    return {
      ...f,
      properties: { ...f.properties, members: [...f.properties.members, { name: '' }] }
    };
  });
}

export function updateMember(
  features: MapFeature[],
  comboId: string,
  index: number,
  patch: Partial<Member>
): MapFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    const members = f.properties.members.map((m, i) => (i === index ? { ...m, ...patch } : m));
    return { ...f, properties: { ...f.properties, members } };
  });
}

export function removeMember(
  features: MapFeature[],
  comboId: string,
  index: number
): MapFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    return {
      ...f,
      properties: { ...f.properties, members: f.properties.members.filter((_, i) => i !== index) }
    };
  });
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm vitest run src/lib/design/draftMutations.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Implement the stateful wrapper `draft.svelte.ts`**

No dedicated test file for this one — it's a thin `$state` wrapper around the pure functions above plus `localStorage`/`ajv` side effects, following this repo's existing convention that `.svelte.ts` state modules (`app.svelte.ts`, `tweaks.svelte.ts`) aren't unit tested; the logic worth testing already lives in `draftMutations.ts` and `loader.ts`.

```ts
// src/lib/state/draft.svelte.ts
import { validateCollection } from '$lib/data/loader';
import { readKey, writeKey } from '$lib/storage/local';
import * as mutations from '$lib/design/draftMutations';
import type {
  FeatureCollection,
  MapFeature,
  Member,
  ObstacleFeature,
  CombiFeature,
  LandmarkFeature
} from '$lib/data/types';

const DRAFT_KEY = 'durf:draft';

export function createDraftState() {
  let features = $state<MapFeature[]>([]);
  let club = $state('');
  let version = $state('');
  let isValid = $state(true);
  let validationErrors = $state<string | null>(null);
  let hasStoredDraft = $state(false);

  function collection(): FeatureCollection {
    return { type: 'FeatureCollection', club, version, features };
  }

  function revalidateAndPersist() {
    const result = validateCollection(collection());
    isValid = result.valid;
    validationErrors = result.valid ? null : result.errors;
    if (result.valid) {
      writeKey(DRAFT_KEY, JSON.stringify(collection()));
      hasStoredDraft = true;
    }
  }

  function apply(next: MapFeature[]) {
    features = next;
    revalidateAndPersist();
  }

  return {
    get features() { return features; },
    get club() { return club; },
    get version() { return version; },
    get isValid() { return isValid; },
    get validationErrors() { return validationErrors; },
    get hasStoredDraft() { return hasStoredDraft; },
    get obstacles(): ObstacleFeature[] {
      return features.filter((f): f is ObstacleFeature => f.properties.kind === 'obstacle');
    },
    get combis(): CombiFeature[] {
      return features.filter((f): f is CombiFeature => f.properties.kind === 'combi');
    },
    get landmarks(): LandmarkFeature[] {
      return features.filter((f): f is LandmarkFeature => f.properties.kind === 'landmark');
    },

    loadOrInit(live: FeatureCollection) {
      const stored = readKey(DRAFT_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as FeatureCollection;
          const result = validateCollection(parsed);
          club = parsed.club;
          version = parsed.version;
          features = parsed.features;
          isValid = result.valid;
          validationErrors = result.valid ? null : result.errors;
          hasStoredDraft = true;
          return;
        } catch {
          // fall through to live data if the stored draft is corrupt JSON
        }
      }
      club = live.club;
      version = live.version;
      features = live.features;
      isValid = true;
      validationErrors = null;
      hasStoredDraft = false;
    },

    addFeature(feature: MapFeature) { apply(mutations.addFeature(features, feature)); },
    updateFeature(id: string, patch: Record<string, unknown>) {
      apply(mutations.updateFeature(features, id, patch));
    },
    setKind(id: string, kind: 'obstacle' | 'combi' | 'landmark') {
      apply(mutations.setKind(features, id, kind));
    },
    removeFeature(id: string) { apply(mutations.removeFeature(features, id)); },
    updateGeometry(id: string, geometry: MapFeature['geometry']) {
      apply(features.map((f) => (f.id === id ? ({ ...f, geometry } as MapFeature) : f)));
    },
    addMember(comboId: string) { apply(mutations.addMember(features, comboId)); },
    updateMember(comboId: string, index: number, patch: Partial<Member>) {
      apply(mutations.updateMember(features, comboId, index, patch));
    },
    removeMember(comboId: string, index: number) {
      apply(mutations.removeMember(features, comboId, index));
    },

    discard(live: FeatureCollection) {
      club = live.club;
      version = live.version;
      features = live.features;
      isValid = true;
      validationErrors = null;
      writeKey(DRAFT_KEY, JSON.stringify(live));
      hasStoredDraft = false;
    },

    exportCollection(): FeatureCollection {
      const today = new Date().toISOString().slice(0, 10);
      return { type: 'FeatureCollection', club, version: today, features };
    }
  };
}

export type DraftState = ReturnType<typeof createDraftState>;
```

- [ ] **Step 6: Verify**

`pnpm check` passes. `pnpm vitest run` — full suite, including the new `draftMutations.test.ts`, still green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/design/draftMutations.ts src/lib/design/draftMutations.test.ts src/lib/state/draft.svelte.ts
git commit -m "feat: add draft mutation helpers and draft state store"
```

---

## Task 13: Draw toolbar + geoman wiring

**Files:**
- Create: `src/lib/design/drawTool.ts`
- Create: `src/lib/design/DrawToolbar.svelte`
- Create: `src/lib/design/GeomanController.svelte`
- Modify: `src/lib/map/ObstacleLayer.svelte`
- Modify: `src/lib/map/CombiLayer.svelte`
- Modify: `src/lib/map/LandmarkLayer.svelte`

**Interfaces:**
- Produces: `type DrawTool = 'point' | 'line' | 'polygon' | 'rectangle' | 'edit' | 'remove' | null` (its own module, not exported from a `.svelte` file — Svelte instance-script exports aren't guaranteed to surface as plain ES named exports the way a `.ts` module's are, so anything imported by more than one consumer lives in `.ts`). `DrawToolbar` — props `{ tool: DrawTool }` (bindable). `GeomanController` — props `{ tool: DrawTool; onCreate: (shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) => void; onEdit: (feature: MapFeature, layer: L.Layer) => void; onRemove: (feature: MapFeature) => void }`, reads the Leaflet map via the existing `getContext('map')` set up in `MapCanvas.svelte`.

- [ ] **Step 0: Create the shared `DrawTool` type**

```ts
// src/lib/design/drawTool.ts
export type DrawTool = 'point' | 'line' | 'polygon' | 'rectangle' | 'edit' | 'remove' | null;
```
- Consumes: `useMapLayer`-style `getContext('map')` pattern already established in `useMapLayer.svelte.ts`; `ToggleGroup`/`ToggleGroupItem` from Task 5; leaflet-geoman's `map.pm.enableDraw(shape, opts)` / `disableDraw()` / `enableGlobalEditMode()` / `disableGlobalEditMode()` / `enableGlobalRemovalMode()` / `disableGlobalRemovalMode()` and the `pm:create` / `pm:edit` / `pm:remove` events — all verified against the installed `@geoman-io/leaflet-geoman-free@2.19.2` type declarations.

- [ ] **Step 1: Tag rendered layers with `.feature` in the three existing layer components**

In `src/lib/map/ObstacleLayer.svelte`, the `attach` helper currently is:

```ts
    function attach(layer: L.Layer, id: string, name: string) {
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(id); });
      group.addLayer(layer);
      addSvgTitle(layer, name);
    }
```

Change its signature to take the whole feature (not just `id`/`name`) so it can stamp `.feature`, and tag the layer:

```ts
    function attach(layer: L.Layer, f: ObstacleFeature) {
      (layer as L.Layer & { feature?: ObstacleFeature }).feature = f;
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelect(f.id); });
      group.addLayer(layer);
      addSvgTitle(layer, f.properties.name);
    }
```

Update the three call sites (`attach(L.circleMarker(...), id, name)` etc.) to pass `f` instead of `id, name` — e.g. `attach(L.circleMarker([lat, lng], {...}), f)`. Do the same for the LineString and Polygon branches (the non-interactive decorative polylines don't need tagging, only the invisible interactive one that's passed to `attach`).

Apply the equivalent change in `src/lib/map/CombiLayer.svelte` and `src/lib/map/LandmarkLayer.svelte` — read each file first to match its exact current `attach`/creation code shape before editing (they follow the same pattern as `ObstacleLayer.svelte` but aren't identical).

- [ ] **Step 2: Create `DrawToolbar.svelte`**

```svelte
<script lang="ts">
  import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
  import { Card } from '$lib/components/ui/card';
  import { t, type Locale } from '$lib/i18n';
  import MapPinIcon from '@lucide/svelte/icons/map-pin';
  import SplineIcon from '@lucide/svelte/icons/spline';
  import HexagonIcon from '@lucide/svelte/icons/hexagon';
  import SquareIcon from '@lucide/svelte/icons/square';
  import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
  import EraserIcon from '@lucide/svelte/icons/eraser';
  import type { DrawTool } from './drawTool';

  let {
    tool = $bindable(null as DrawTool),
    locale
  }: {
    tool?: DrawTool;
    locale: Locale;
  } = $props();

  function toggle(value: string) {
    tool = (value || null) as DrawTool;
  }
</script>

<div class="pointer-events-none absolute bottom-6 left-1/2 z-[1200] -translate-x-1/2">
  <Card size="sm" class="pointer-events-auto p-1 shadow-lg">
    <ToggleGroup
      value={tool ?? ''}
      onValueChange={toggle}
      class="bg-transparent p-0"
    >
      <ToggleGroupItem value="point" aria-label={t(locale, 'design.tool.point')}>
        <MapPinIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="line" aria-label={t(locale, 'design.tool.line')}>
        <SplineIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="polygon" aria-label={t(locale, 'design.tool.polygon')}>
        <HexagonIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="rectangle" aria-label={t(locale, 'design.tool.rectangle')}>
        <SquareIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="edit" aria-label={t(locale, 'design.tool.edit')}>
        <MousePointer2Icon />
      </ToggleGroupItem>
      <ToggleGroupItem value="remove" aria-label={t(locale, 'design.tool.remove')}>
        <EraserIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  </Card>
</div>
```

Add i18n keys to both locales in `src/lib/i18n/dict.ts`:

```ts
    // nl
    'design.tool.point': 'Punt tekenen',
    'design.tool.line': 'Lijn tekenen',
    'design.tool.polygon': 'Vlak tekenen',
    'design.tool.rectangle': 'Combi-gebied tekenen',
    'design.tool.edit': 'Bewerken',
    'design.tool.remove': 'Verwijderen',
```

```ts
    // en
    'design.tool.point': 'Draw point',
    'design.tool.line': 'Draw line',
    'design.tool.polygon': 'Draw shape',
    'design.tool.rectangle': 'Draw combi area',
    'design.tool.edit': 'Edit',
    'design.tool.remove': 'Delete',
```

- [ ] **Step 3: Create `GeomanController.svelte`**

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import L from 'leaflet';
  import '@geoman-io/leaflet-geoman-free';
  import type { MapFeature } from '$lib/data/types';
  import type { DrawTool } from './drawTool';

  let {
    tool,
    onCreate,
    onEdit,
    onRemove
  }: {
    tool: DrawTool;
    onCreate: (shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) => void;
    onEdit: (feature: MapFeature, layer: L.Layer) => void;
    onRemove: (feature: MapFeature) => void;
  } = $props();

  const getMap = getContext<() => L.Map | undefined>('map');

  const SHAPE_BY_TOOL = {
    point: 'Marker',
    line: 'Line',
    polygon: 'Polygon',
    rectangle: 'Rectangle'
  } as const;

  $effect(() => {
    const map = getMap();
    if (!map) return;

    function handleCreate(e: { shape: string; layer: L.Layer }) {
      onCreate(e.shape as 'Marker' | 'Line' | 'Polygon' | 'Rectangle', e.layer);
      map!.pm.disableDraw();
    }
    function handleEdit(e: { layer: L.Layer }) {
      const feature = (e.layer as L.Layer & { feature?: MapFeature }).feature;
      if (feature) onEdit(feature, e.layer);
    }
    function handleRemove(e: { layer: L.Layer }) {
      const feature = (e.layer as L.Layer & { feature?: MapFeature }).feature;
      if (feature) onRemove(feature);
    }

    map.on('pm:create', handleCreate as L.LeafletEventHandlerFn);
    map.on('pm:edit', handleEdit as L.LeafletEventHandlerFn);
    map.on('pm:remove', handleRemove as L.LeafletEventHandlerFn);

    return () => {
      map.off('pm:create', handleCreate as L.LeafletEventHandlerFn);
      map.off('pm:edit', handleEdit as L.LeafletEventHandlerFn);
      map.off('pm:remove', handleRemove as L.LeafletEventHandlerFn);
    };
  });

  $effect(() => {
    const map = getMap();
    if (!map) return;

    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalRemovalMode();

    if (tool === 'edit') {
      map.pm.enableGlobalEditMode();
    } else if (tool === 'remove') {
      map.pm.enableGlobalRemovalMode();
    } else if (tool) {
      map.pm.enableDraw(SHAPE_BY_TOOL[tool]);
    }
  });
</script>
```

- [ ] **Step 4: Manual verification checklist (no automated test — Svelte components aren't unit-tested in this repo)**

Run `pnpm dev`, navigate to `/design`. This step depends on Task 16's wiring to actually render `DrawToolbar`/`GeomanController` on the page — if that task isn't done yet, verify in isolation by temporarily rendering both inside `src/routes/design/+page.svelte` (revert the temporary wiring before committing if Task 16 hasn't landed yet):
- Selecting "point" and clicking the map creates a marker; the toolbar tool auto-deselects afterward (confirms `disableDraw()` after create).
- Selecting "line"/"polygon"/"rectangle" draws the respective shape.
- Selecting "edit" makes existing shapes draggable/reshapeable; dragging a vertex fires `pm:edit`.
- Selecting "remove" and clicking a shape deletes it and fires `pm:remove`.
- No geoman default toolbar icons appear anywhere on the map (confirms `addControls()` is never called).

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/drawTool.ts src/lib/design/DrawToolbar.svelte src/lib/design/GeomanController.svelte src/lib/map/ObstacleLayer.svelte src/lib/map/CombiLayer.svelte src/lib/map/LandmarkLayer.svelte src/lib/i18n/dict.ts
git commit -m "feat: add custom draw toolbar wired to leaflet-geoman"
```

---

## Task 14: Feature editor Sheet

**Files:**
- Create: `src/lib/design/FeatureEditorSheet.svelte`

**Interfaces:**
- Consumes: `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetFooter` (Task 3), `ToggleGroup`/`ToggleGroupItem` (Task 5), `IconPicker` (Task 11), `Input`/`Textarea`/`Label` (Task 2), `Button`, `DraftState` (Task 12) methods `updateFeature`/`setKind`/`removeFeature`/`addMember`/`updateMember`/`removeMember`.
- Produces: props `{ feature: MapFeature | null; draft: DraftState; onRequestDelete: (id: string) => void; locale: Locale }`. Opens (`Sheet` `open`) whenever `feature` is non-null. `onRequestDelete` hands off to Task 15's `DiscardDraftDialog`-style confirm flow rather than deleting directly (kept as a callback so the AlertDialog can live in a shared place — see Task 15 wiring in Task 16).

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '$lib/components/ui/sheet';
  import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Button } from '$lib/components/ui/button';
  import IconPicker from './IconPicker.svelte';
  import { t, type Locale } from '$lib/i18n';
  import type { DraftState } from '$lib/state/draft.svelte';
  import type { MapFeature } from '$lib/data/types';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  let {
    feature,
    draft,
    onRequestDelete,
    locale
  }: {
    feature: MapFeature | null;
    draft: DraftState;
    onRequestDelete: (id: string) => void;
    locale: Locale;
  } = $props();

  const KINDS_BY_GEOMETRY = {
    Point: ['obstacle', 'landmark'],
    LineString: ['obstacle'],
    Polygon: ['obstacle', 'combi']
  } as const;

  const allowedKinds = $derived(feature ? KINDS_BY_GEOMETRY[feature.geometry.type] : []);
</script>

<Sheet open={feature !== null} onOpenChange={(v) => { if (!v && feature) onRequestDelete(''); }}>
  {#if feature}
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>{feature.properties.name || t(locale, 'design.editor.untitled')}</SheetTitle>
      </SheetHeader>

      <div class="flex flex-1 flex-col gap-4 overflow-y-auto">
        <div class="flex flex-col gap-1.5">
          <Label for="feature-name">{t(locale, 'design.editor.name')}</Label>
          <Input
            id="feature-name"
            value={feature.properties.name}
            oninput={(e) => draft.updateFeature(feature!.id, { name: (e.target as HTMLInputElement).value })}
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>{t(locale, 'design.editor.kind')}</Label>
          <ToggleGroup
            value={feature.properties.kind}
            onValueChange={(v) => v && draft.setKind(feature!.id, v as 'obstacle' | 'combi' | 'landmark')}
          >
            {#each ['obstacle', 'combi', 'landmark'] as const as k (k)}
              <ToggleGroupItem value={k} disabled={!allowedKinds.includes(k)}>
                {t(locale, `design.kind.${k}`)}
              </ToggleGroupItem>
            {/each}
          </ToggleGroup>
        </div>

        {#if feature.properties.kind === 'landmark'}
          <div class="flex flex-col gap-1.5">
            <Label>{t(locale, 'design.editor.icon')}</Label>
            <IconPicker
              value={feature.properties.icon}
              onSelect={(icon) => draft.updateFeature(feature!.id, { icon })}
              {locale}
            />
          </div>
        {/if}

        <div class="flex flex-col gap-1.5">
          <Label for="feature-notes">{t(locale, 'design.editor.notes')}</Label>
          <Textarea
            id="feature-notes"
            value={feature.properties.notes ?? ''}
            oninput={(e) => draft.updateFeature(feature!.id, { notes: (e.target as HTMLTextAreaElement).value })}
          />
        </div>

        {#if feature.properties.kind === 'combi'}
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <Label>{t(locale, 'design.editor.members')}</Label>
              <Button variant="outline" size="sm" onclick={() => draft.addMember(feature!.id)}>
                <PlusIcon class="size-3.5" />
                {t(locale, 'design.editor.members.add')}
              </Button>
            </div>
            {#each feature.properties.members as member, i (i)}
              <div class="flex items-start gap-2 rounded-md border p-2">
                <div class="flex flex-1 flex-col gap-1.5">
                  <Input
                    value={member.name}
                    placeholder={t(locale, 'design.editor.members.name')}
                    oninput={(e) => draft.updateMember(feature!.id, i, { name: (e.target as HTMLInputElement).value })}
                  />
                  <Input
                    value={member.notes ?? ''}
                    placeholder={t(locale, 'design.editor.members.notes')}
                    oninput={(e) => draft.updateMember(feature!.id, i, { notes: (e.target as HTMLInputElement).value })}
                  />
                </div>
                <Button variant="ghost" size="icon" onclick={() => draft.removeMember(feature!.id, i)}>
                  <Trash2Icon class="size-4" />
                </Button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <SheetFooter>
        <Button variant="destructive" onclick={() => onRequestDelete(feature!.id)}>
          <Trash2Icon class="size-4" />
          {t(locale, 'design.editor.delete')}
        </Button>
      </SheetFooter>
    </SheetContent>
  {/if}
</Sheet>
```

(The `Sheet`'s `onOpenChange` handler that dismisses via Escape/outside-click/close-button intentionally does *not* delete the feature — it just closes; `''` passed to `onRequestDelete` in that branch was a mistake in early drafts of this plan and must **not** ship. Instead, closing the Sheet without the explicit Delete button should simply clear the parent's `selectedId`. Fix before implementing: change the `onOpenChange` handler to accept an `onClose: () => void` prop instead of overloading `onRequestDelete`. Revised signature and root markup:)

```ts
  let {
    feature,
    draft,
    onRequestDelete,
    onClose,
    locale
  }: {
    feature: MapFeature | null;
    draft: DraftState;
    onRequestDelete: (id: string) => void;
    onClose: () => void;
    locale: Locale;
  } = $props();
```

```svelte
<Sheet open={feature !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
```

- [ ] **Step 2: Add i18n keys**

Add to both locales in `src/lib/i18n/dict.ts`:

```ts
    // nl
    'design.editor.untitled': 'Naamloos',
    'design.editor.name': 'Naam',
    'design.editor.kind': 'Type',
    'design.editor.icon': 'Icoon',
    'design.editor.notes': 'Notities',
    'design.editor.members': 'Onderdelen',
    'design.editor.members.add': 'Toevoegen',
    'design.editor.members.name': 'Naam',
    'design.editor.members.notes': 'Notitie (optioneel)',
    'design.editor.delete': 'Verwijderen',
    'design.kind.obstacle': 'Hindernis',
    'design.kind.combi': 'Combi',
    'design.kind.landmark': 'Herkenningspunt',
```

```ts
    // en
    'design.editor.untitled': 'Untitled',
    'design.editor.name': 'Name',
    'design.editor.kind': 'Kind',
    'design.editor.icon': 'Icon',
    'design.editor.notes': 'Notes',
    'design.editor.members': 'Members',
    'design.editor.members.add': 'Add',
    'design.editor.members.name': 'Name',
    'design.editor.members.notes': 'Note (optional)',
    'design.editor.delete': 'Delete',
    'design.kind.obstacle': 'Obstacle',
    'design.kind.combi': 'Combi',
    'design.kind.landmark': 'Landmark',
```

- [ ] **Step 3: Verify**

`pnpm check` passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/design/FeatureEditorSheet.svelte src/lib/i18n/dict.ts
git commit -m "feat: add feature editor Sheet for Design mode"
```

---

## Task 15: Draft status UI — indicator, red dot, discard, export

**Files:**
- Create: `src/lib/design/DiscardDraftDialog.svelte`
- Create: `src/lib/design/DraftStatus.svelte`
- Create: `src/lib/design/DraftExportDialog.svelte`
- Modify: `src/lib/components/AppShell.svelte` (hamburger red-dot — see Step 4)

**Interfaces:**
- Consumes: `AlertDialog`/`AlertDialogContent`/`AlertDialogHeader`/`AlertDialogTitle`/`AlertDialogDescription`/`AlertDialogFooter`/`AlertDialogAction`/`AlertDialogCancel` (Task 4); `DraftState` (Task 12); `toast` from `svelte-sonner`.
- Produces: `DraftStatus` — props `{ draft: DraftState; live: FeatureCollection }`, renders the "Draft saved"/"Draft has a problem" row plus a hover-reveal discard button; shows an `AlertDialog` confirm before calling `draft.discard(live)`. `DraftExportDialog` — parallel to `MapDataDialog`, downloads `draft.exportCollection()` and supports importing another file into the draft (validated the same way `MapDataDialog`'s import already is, reusing `parseFeatures`/`validateCollection`).

- [ ] **Step 1: Add remaining i18n keys**

Add to both locales in `src/lib/i18n/dict.ts`:

```ts
    // nl
    'draft.status.saved': 'Concept opgeslagen',
    'draft.status.invalid': 'Concept heeft een probleem',
    'draft.discard': 'Concept verwijderen',
    'draft.discard.title': 'Concept verwijderen?',
    'draft.discard.body': 'Dit verwijdert al je onopgeslagen wijzigingen en herstelt de laatst gepubliceerde kaart.',
    'draft.discard.confirm': 'Verwijderen',
    'draft.discard.cancel': 'Annuleren',
    'draft.export.download': 'Concept downloaden',
    'draft.export.import': 'Ander bestand laden…',
```

```ts
    // en
    'draft.status.saved': 'Draft saved',
    'draft.status.invalid': 'Draft has a problem',
    'draft.discard': 'Discard draft',
    'draft.discard.title': 'Discard draft?',
    'draft.discard.body': 'This clears all unsaved changes and restores the last published map.',
    'draft.discard.confirm': 'Discard',
    'draft.discard.cancel': 'Cancel',
    'draft.export.download': 'Download draft',
    'draft.export.import': 'Load another file…',
```

- [ ] **Step 2: Create `DiscardDraftDialog.svelte`**

```svelte
<script lang="ts">
  import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel
  } from '$lib/components/ui/alert-dialog';
  import { t, type Locale } from '$lib/i18n';

  let {
    open = $bindable(false),
    locale,
    onConfirm
  }: {
    open?: boolean;
    locale: Locale;
    onConfirm: () => void;
  } = $props();
</script>

<AlertDialog bind:open>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t(locale, 'draft.discard.title')}</AlertDialogTitle>
      <AlertDialogDescription>{t(locale, 'draft.discard.body')}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t(locale, 'draft.discard.cancel')}</AlertDialogCancel>
      <AlertDialogAction onclick={onConfirm}>{t(locale, 'draft.discard.confirm')}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 3: Create `DraftStatus.svelte`**

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import DiscardDraftDialog from './DiscardDraftDialog.svelte';
  import DraftExportDialog from './DraftExportDialog.svelte';
  import { t, type Locale } from '$lib/i18n';
  import type { DraftState } from '$lib/state/draft.svelte';
  import type { FeatureCollection } from '$lib/data/types';
  import { toast } from 'svelte-sonner';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';

  let {
    draft,
    live,
    locale
  }: {
    draft: DraftState;
    live: FeatureCollection;
    locale: Locale;
  } = $props();

  let discardOpen = $state(false);
  let exportOpen = $state(false);
  let hovering = $state(false);
  let lastInvalidToastAt = 0;

  $effect(() => {
    if (draft.isValid) return;
    const now = Date.now();
    if (now - lastInvalidToastAt < 2000) return;
    lastInvalidToastAt = now;
    toast.error(t(locale, 'draft.toast.invalid'));
  });
</script>

<div
  class="group/draft flex items-center justify-between gap-2 text-xs"
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
>
  <button
    type="button"
    class={draft.isValid ? 'text-muted-foreground' : 'font-medium text-destructive'}
    onclick={() => (exportOpen = true)}
  >
    {#if !draft.isValid}
      <CircleAlertIcon class="mr-1 inline size-3.5 align-text-bottom" />
    {/if}
    {draft.isValid ? t(locale, 'draft.status.saved') : t(locale, 'draft.status.invalid')}
  </button>

  {#if hovering}
    <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onclick={() => (discardOpen = true)}>
      {t(locale, 'draft.discard')}
    </Button>
  {/if}
</div>

<DiscardDraftDialog
  bind:open={discardOpen}
  {locale}
  onConfirm={() => {
    draft.discard(live);
    discardOpen = false;
    toast.success(t(locale, 'draft.toast.discarded'));
  }}
/>

{#if exportOpen}
  <DraftExportDialog {draft} {locale} onClose={() => (exportOpen = false)} />
{/if}
```

- [ ] **Step 4: Create `DraftExportDialog.svelte`**

This mirrors `src/lib/components/MapDataDialog.svelte` closely (same hand-rolled overlay pattern — that dialog predates this plan's Sheet/AlertDialog primitives and there's no reason to rewrite a working, already-reviewed pattern just for consistency; read `MapDataDialog.svelte` first to match its exact markup/portal helper), but downloads `draft.exportCollection()` and imports into the draft (`draft.loadOrInit`-style replace) instead of the live app state:

```svelte
<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import { parseFeatures, LoadError } from '$lib/data/loader';
  import type { DraftState } from '$lib/state/draft.svelte';
  import DatabaseIcon from '@lucide/svelte/icons/database';
  import XIcon from '@lucide/svelte/icons/x';
  import { toast } from 'svelte-sonner';

  let {
    draft,
    locale,
    onClose
  }: {
    draft: DraftState;
    locale: Locale;
    onClose: () => void;
  } = $props();

  let fileInput: HTMLInputElement;

  function handleDownload() {
    const data = draft.exportCollection();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
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
    try {
      const parsed = await parseFeatures(text);
      draft.discard(parsed);
    } catch (err) {
      toast.error(err instanceof LoadError ? err.message : 'Invalid file');
    }
    (e.target as HTMLInputElement).value = '';
    onClose();
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }
</script>

<div
  class="fixed inset-0 z-[1700] flex items-center justify-center bg-black/60 p-5"
  role="presentation"
  onclick={onClose}
  use:portal
>
  <div
    class="flex w-[min(92vw,380px)] flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <DatabaseIcon class="size-5 text-muted-foreground" />
        <p class="text-base font-semibold text-foreground">{t(locale, 'settings.mapdata')}</p>
      </div>
      <Button variant="ghost" size="icon" class="size-7 shrink-0" onclick={onClose}>
        <XIcon class="size-4" />
      </Button>
    </div>

    <div class="flex flex-col gap-2">
      <Button variant="outline" class="w-full" onclick={handleDownload}>
        {t(locale, 'draft.export.download')}
      </Button>
      <Button variant="outline" class="w-full" onclick={() => fileInput.click()}>
        {t(locale, 'draft.export.import')}
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

- [ ] **Step 5: Add the red dot to the hamburger button**

In `src/lib/components/AppShell.svelte`, the hamburger button needs to know whether the draft is malformed. Since `AppShell` doesn't own the draft state (the `/design` route does, per the bundle-isolation constraint), add an optional prop:

```ts
  let {
    mode = 'map',
    toolbar,
    editorPanel,
    menuStatusExtra,
    hasDraftProblem = false
  }: {
    mode?: 'map' | 'design';
    toolbar?: Snippet;
    editorPanel?: Snippet;
    menuStatusExtra?: Snippet;
    hasDraftProblem?: boolean;
  } = $props();
```

Forward it to `Menu`:

```svelte
  <Menu {app} onImport={handleImport} {mode} statusExtra={menuStatusExtra} {hasDraftProblem} />
```

In `src/lib/components/Menu.svelte`, accept `hasDraftProblem` and render the dot on the closed-state hamburger button (the `{:else}` branch at the bottom that renders the plain menu-icon button):

```ts
  let {
    app,
    onImport,
    mode = 'map',
    statusExtra,
    hasDraftProblem = false
  }: {
    app: AppState;
    onImport: (text: string) => void;
    mode?: 'map' | 'design';
    statusExtra?: Snippet;
    hasDraftProblem?: boolean;
  } = $props();
```

```svelte
  {:else}
    <div class="relative p-3">
      <Button
        variant="outline"
        size="icon"
        aria-label={t(app.locale, 'menu.settings')}
        onclick={() => app.toggleMenu()}
      >
        <MenuIcon />
      </Button>
      {#if hasDraftProblem}
        <span
          class="absolute right-2 top-2 size-2.5 rounded-full bg-destructive ring-2 ring-background"
          aria-hidden="true"
        ></span>
      {/if}
    </div>
  {/if}
```

- [ ] **Step 6: Verify**

`pnpm check` passes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/design/DiscardDraftDialog.svelte src/lib/design/DraftStatus.svelte src/lib/design/DraftExportDialog.svelte src/lib/components/AppShell.svelte src/lib/components/Menu.svelte src/lib/i18n/dict.ts
git commit -m "feat: add draft status, discard, and export UI"
```

---

## Task 16: Final assembly — wire everything into `/design`

**Files:**
- Modify: `src/routes/design/+page.svelte`

**Interfaces:**
- Consumes everything produced in Tasks 1–15.

- [ ] **Step 1: Replace the Task-1 scaffold with the full page**

`AppShell`'s `mode`/`hasDraftProblem`/`toolbar`/`editorPanel`/`menuStatusExtra`/`mapLayers` props were all added in Task 1 Step 6; `draft.svelte.ts`'s `updateGeometry`/`obstacles`/`combis`/`landmarks` were added in Task 12 Step 5. This step only needs to compose them:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import DrawToolbar from '$lib/design/DrawToolbar.svelte';
  import type { DrawTool } from '$lib/design/drawTool';
  import GeomanController from '$lib/design/GeomanController.svelte';
  import FeatureEditorSheet from '$lib/design/FeatureEditorSheet.svelte';
  import DraftStatus from '$lib/design/DraftStatus.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { createDraftState } from '$lib/state/draft.svelte';
  import { fetchFeatures, LoadError } from '$lib/data/loader';
  import { generateId } from '$lib/data/ids';
  import ObstacleLayer from '$lib/map/ObstacleLayer.svelte';
  import CombiLayer from '$lib/map/CombiLayer.svelte';
  import LandmarkLayer from '$lib/map/LandmarkLayer.svelte';
  import type { MapFeature, FeatureCollection } from '$lib/data/types';
  import type L from 'leaflet';

  const app = createAppState();
  const draft = createDraftState();

  let liveData = $state<FeatureCollection | null>(null);
  let tool = $state<DrawTool>(null);

  onMount(async () => {
    app.setLoadState('loading');
    try {
      const col = await fetchFeatures();
      liveData = col;
      app.setData(col);
      draft.loadOrInit(col);
    } catch (err) {
      app.setLoadError(err instanceof LoadError ? err.message : 'Onbekende fout / Unknown error');
    }
  });

  function roundCoords<T>(coordinates: T): T {
    return JSON.parse(
      JSON.stringify(coordinates),
      (_key, value) => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value)
    );
  }

  function handleCreate(shape: 'Marker' | 'Line' | 'Polygon' | 'Rectangle', layer: L.Layer) {
    const geojson = (layer as L.Marker | L.Polyline | L.Polygon).toGeoJSON();
    const coordinates = roundCoords(geojson.geometry.coordinates);
    const id = generateId();

    if (shape === 'Marker') {
      draft.addFeature({
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates },
        properties: { name: '', kind: 'obstacle' }
      });
    } else if (shape === 'Line') {
      draft.addFeature({
        type: 'Feature',
        id,
        geometry: { type: 'LineString', coordinates },
        properties: { name: '', kind: 'obstacle' }
      });
    } else if (shape === 'Polygon' || shape === 'Rectangle') {
      draft.addFeature({
        type: 'Feature',
        id,
        geometry: { type: 'Polygon', coordinates },
        properties:
          shape === 'Rectangle'
            ? { name: '', kind: 'combi', members: [] }
            : { name: '', kind: 'obstacle' }
      });
    }

    layer.remove(); // the *Layer components re-render this feature from draft state instead
    app.selectFeature(id);
  }

  function handleEdit(feature: MapFeature, layer: L.Layer) {
    const geojson = (layer as L.Marker | L.Polyline | L.Polygon).toGeoJSON();
    const coordinates = roundCoords(geojson.geometry.coordinates);
    draft.updateGeometry(feature.id, { ...feature.geometry, coordinates });
  }

  function handleRemove(feature: MapFeature) {
    draft.removeFeature(feature.id);
    if (app.selectedId === feature.id) app.selectFeature(null);
  }

  function handleDeleteSelected(id: string) {
    draft.removeFeature(id);
    app.selectFeature(null);
  }

  const selectedFeature = $derived(draft.features.find((f) => f.id === app.selectedId) ?? null);
</script>

<AppShell mode="design" hasDraftProblem={!draft.isValid}>
  {#snippet toolbar()}
    <DrawToolbar bind:tool locale={app.locale} />
    <GeomanController {tool} onCreate={handleCreate} onEdit={handleEdit} onRemove={handleRemove} />
  {/snippet}

  {#snippet editorPanel()}
    <FeatureEditorSheet
      feature={selectedFeature}
      {draft}
      onRequestDelete={handleDeleteSelected}
      onClose={() => app.selectFeature(null)}
      locale={app.locale}
    />
  {/snippet}

  {#snippet menuStatusExtra()}
    {#if liveData}
      <DraftStatus {draft} live={liveData} locale={app.locale} />
    {/if}
  {/snippet}

  {#snippet mapLayers()}
    <ObstacleLayer
      features={draft.obstacles}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <CombiLayer
      features={draft.combis}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
    <LandmarkLayer
      features={draft.landmarks}
      selectedId={app.selectedId}
      onSelect={(id) => app.selectFeature(id)}
    />
  {/snippet}
</AppShell>
```

(`mapLayers` renders *inside* `<AppShell>` as a passed-in snippet, not as a sibling — `MapCanvas` is internal to `AppShell` and only reachable through that snippet prop, which is exactly why Task 1 Step 6 added it.)

- [ ] **Step 2: Full manual smoke test**

Run `pnpm dev`, navigate to `/design`:
1. Map loads with the existing sample obstacles/combis/landmarks rendered.
2. Draw a point → editor Sheet opens with an empty name, kind defaults to obstacle; type a name → "Draft saved" status appears in the menu.
3. Switch kind to landmark → icon field appears; leave it unset → menu status flips to "Draft has a problem" and a toast fires; pick an icon via search → status returns to "Draft saved".
4. Draw a rectangle → kind defaults to obstacle (Polygon-allowed kinds); switch to combi → members section appears; add a member with a name → valid.
5. Select "edit" tool, drag a vertex of an existing shape → shape updates, still valid.
6. Select "remove" tool, click a shape → it disappears from the map and from search-equivalent state.
7. Reload the page → the draft (including the in-progress edits) is restored from `localStorage`.
8. Click "Concept verwijderen / Discard draft" → confirm dialog → draft reverts to the live `obstacles.geojson` content.
9. Click the draft status row → export dialog opens → "Concept downloaden" downloads a `.geojson` file with today's date in the version field and filename.
10. Navigate back to `/` (Map mode) → confirm the public map is completely unaffected (still shows live data, no draw toolbar, no console errors) and `pnpm build` output for the `/` route chunk doesn't reference `geoman` (spot-check: `grep -r geoman .svelte-kit/output/client/_app/immutable/nodes/` after `pnpm build` should only match the design route's chunk, not the root one).

Run `pnpm check` and `pnpm vitest run` — both fully green.

- [ ] **Step 3: Self-review against the spec**

Re-read spec §1–§4 and confirm every MVP requirement has a corresponding task above: Design mode route (Task 1), draw/edit/delete (Task 13), export GeoJSON (Task 15), continuous validation (Task 12), draft autosave/malformed toast/red-dot/discard (Tasks 12, 15), landmark icon picker (Tasks 10–11), combi members (Tasks 12, 14), i18n chrome strings (all tasks). No open gaps.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: assemble Design mode — drawing, editing, draft persistence, export"
```
