# Foundation & Map Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SvelteKit static SPA that boots to a full-screen Leaflet basemap with the two Durf tile layers, a working hamburger menu + settings (tile picker, language toggle, data info), bilingual chrome (NL default / EN), and the localStorage hard-requirement guard.

**Architecture:** SvelteKit with `adapter-static` in SPA mode (`ssr = false`, `prerender = true`) — no backend, deployed to Cloudflare Pages. Pure-logic modules (i18n, storage guard, tile config/failover) are unit-tested with Vitest; Svelte components mount Leaflet and render chrome overlays styled with the Durf design-system tokens (the shadcn-svelte theme contract). This plan produces the shell; obstacle data and rendering land in Plan 2.

**Tech Stack:** Svelte 5 (runes), SvelteKit 2, `@sveltejs/adapter-static` 3, Vite 5, TypeScript 5, Tailwind CSS 3.4, Leaflet 1.9.4, Vitest 2 + jsdom, Durf design system tokens (Lucide icons, Geist type, Bok blauw).

## Global Constraints

- **SPA only:** `ssr = false`, `prerender = true`; `adapter-static` with SPA fallback. No SSR, no server runtime, no backend.
- **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`) — not the Svelte 4 store/reactive-label style.
- **localStorage is a hard requirement.** If unavailable, show a blocking dialog and do not run the app.
- **Tile layers (exactly two):** `map` = CARTO Voyager `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png` attribution `© OpenStreetMap © CARTO` (default); `sat` = Esri `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` attribution `© Esri`. Failover pair = `map ↔ sat`. No plain OSM.
- **i18n:** UI chrome only. Default Dutch; browser-detect `nl*` → `nl`, else `en`. Manual override persisted to localStorage key `durf:lang`. Obstacle data is never translated. No i18n framework — a flat dictionary.
- **Brand:** Bok blauw `#00A5E3` (`hsl(197 100% 44%)`), ink `#373737`, card radius `1rem`. Icons = Lucide + Durf ibex marks. UI/body type = Geist.
- **localStorage key namespace:** `durf:` prefix (`durf:lang`, `durf:tile`).
- **Map center for MVP:** `[52.0270, 4.3650]`, zoom 16 (Durf plot, Delft) — placeholder until data drives bounds in Plan 2.

---

## File Structure

```
package.json, svelte.config.js, vite.config.ts, tsconfig.json,
  tailwind.config.ts, postcss.config.js, .prettierrc, eslint.config.js
src/app.html                     — SPA host page
src/app.css                      — Tailwind layers + imports Durf tokens
src/lib/durf-ds/tokens/*.css     — Durf design tokens (pulled from Claude Design)
src/lib/i18n/dict.ts             — nl/en string dictionary
src/lib/i18n/index.ts            — locale detection, persistence, t()
src/lib/i18n/i18n.test.ts
src/lib/storage/local.ts         — localStorage availability guard + typed get/set
src/lib/storage/local.test.ts
src/lib/map/tiles.ts             — TILE_LAYERS config + failover logic (pure)
src/lib/map/tiles.test.ts
src/lib/map/MapCanvas.svelte     — Leaflet mount + tile switching
src/lib/components/AppShell.svelte  — hamburger + overlay orchestration
src/lib/components/Menu.svelte      — root menu + settings sub-level
src/lib/components/LsBlockDialog.svelte — localStorage-missing blocking dialog
src/lib/state/app.svelte.ts      — shared UI state (menu level, tile, lang) via runes
src/routes/+layout.ts            — prerender=true, ssr=false
src/routes/+layout.svelte        — imports app.css
src/routes/+page.svelte          — mounts AppShell + MapCanvas
```

---

## Task 1: Project scaffold (SvelteKit static SPA + Vitest)

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `postcss.config.js`, `src/app.html`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- Create: `.gitignore` (append), `vitest-setup.ts`

**Interfaces:**
- Produces: a buildable SvelteKit app; `npm run dev`, `npm run build`, `npm test` all work. Route `/` renders a placeholder.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "hindernisbaan",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.6",
    "@sveltejs/kit": "^2.8.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@testing-library/svelte": "^5.2.4",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^25.0.0",
    "svelte": "^5.1.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "leaflet": "^1.9.4"
  }
}
```

Also: `npm install --save-dev @types/leaflet@^1.9.12`.

- [ ] **Step 2: Create config files**

`svelte.config.js`:
```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    alias: { $lib: 'src/lib' }
  }
};
```

`vite.config.ts`:
```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
```

`tsconfig.json`:
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`vitest-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Create `src/app.html`**

```html
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
    %sveltekit.head%
  </head>
  <body style="margin:0">
    <div style="display:contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 4: Create route files**

`src/routes/+layout.ts`:
```ts
export const prerender = true;
export const ssr = false;
```

`src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

`src/routes/+page.svelte`:
```svelte
<script lang="ts">
</script>

<main>hindernisbaan — shell boots</main>
```

(`src/app.css` is created in Task 2; add a minimal placeholder `/* app.css */` now so the import resolves.)

- [ ] **Step 5: Run build + test wiring to verify scaffold**

Run: `npm install && npm run build && npm test`
Expected: `npm run build` completes writing to `build/` with an `index.html` fallback. `npm test` exits 0 (no tests yet → "No test files found" is acceptable; if Vitest errors on zero tests, that's fixed in Task 3).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit static SPA with Vitest"
```

---

## Task 2: Durf design tokens + Tailwind

**Files:**
- Create: `src/lib/durf-ds/tokens/colors.css`, `src/lib/durf-ds/tokens/shadcn.css`, `src/lib/durf-ds/tokens/spacing.css`, `src/lib/durf-ds/tokens/typography.css`
- Create: `tailwind.config.ts`
- Modify: `src/app.css`

**Interfaces:**
- Produces: CSS custom properties `--bok-500` (`#00a5e3`), `--ink-700`, `--text-body`, `--border-subtle`, `--radius`, etc., available app-wide; Tailwind utilities `bg-primary`, `text-primary-foreground`, `rounded-lg` mapped to Durf tokens; Geist font family.

- [ ] **Step 1: Pull the Durf token CSS from Claude Design**

Fetch these files from Claude Design project `ece08963-45b6-45b2-9b20-dfd18d69c47b` (via the `claude_design` MCP `get_file`, or ask the operator to export them) and save verbatim to `src/lib/durf-ds/tokens/`:
- `_ds/durf-design-system-b453e204-9c3f-4e9e-8962-38a07910c695/tokens/colors.css` → `colors.css`
- `_ds/durf-design-system-b453e204-9c3f-4e9e-8962-38a07910c695/tokens/shadcn.css` → `shadcn.css`
- `_ds/durf-design-system-b453e204-9c3f-4e9e-8962-38a07910c695/tokens/spacing.css` → `spacing.css`
- `_ds/durf-design-system-b453e204-9c3f-4e9e-8962-38a07910c695/tokens/typography.css` → `typography.css`

The two that matter most for this task (verify these values are present after export): `colors.css` defines the `--bok-*`, `--ink-*`, `--gray-*`, semantic (`--error #c62828`, `--success #357638`, `--warning #e08a00`) scales and aliases (`--brand`, `--text-body`, `--border-subtle`, `--bg-muted`). `shadcn.css` defines the portable shadcn theme: `--primary: 197 100% 44%` (Bok blauw), `--background`, `--foreground`, `--muted`, `--border`, `--ring`, `--radius: 1rem`, plus a `.dark` block.

- [ ] **Step 2: Create `tailwind.config.ts` mapping tokens → utilities**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)'
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
```

Install Tailwind toolchain: `npm install --save-dev tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0`.

- [ ] **Step 3: Write `src/app.css`**

```css
@import './lib/durf-ds/tokens/colors.css';
@import './lib/durf-ds/tokens/shadcn.css';
@import './lib/durf-ds/tokens/spacing.css';
@import './lib/durf-ds/tokens/typography.css';
@import '@fontsource/geist-sans/400.css';
@import '@fontsource/geist-sans/500.css';
@import '@fontsource/geist-sans/600.css';
@import '@fontsource/geist-sans/700.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root { font-family: 'Geist', system-ui, sans-serif; }
html, body { margin: 0; height: 100%; }
```

Install Geist: `npm install @fontsource/geist-sans`.

- [ ] **Step 4: Verify brand color renders**

Edit `src/routes/+page.svelte` body to `<main class="bg-primary text-primary-foreground p-4">Bok blauw</main>`.
Run: `npm run dev`, open the page.
Expected: a Bok-blauw (`#00A5E3`) block with white text in Geist. Revert the placeholder after confirming.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate Durf design tokens and Tailwind"
```

---

## Task 3: i18n module (dictionary, detection, persistence)

**Files:**
- Create: `src/lib/i18n/dict.ts`, `src/lib/i18n/index.ts`, `src/lib/i18n/i18n.test.ts`
- Depends on: `src/lib/storage/local.ts` for persistence — but to avoid ordering coupling, this task reads/writes `localStorage` through a small injected accessor and Task 4 supplies the shared guard. For now `index.ts` uses `try/catch` around `localStorage` directly.

**Interfaces:**
- Produces:
  - `type Locale = 'nl' | 'en'`
  - `detectLocale(navLang: string | undefined): Locale` — `nl*` → `'nl'`, else `'en'`
  - `resolveInitialLocale(stored: string | null, navLang: string | undefined): Locale` — stored wins if valid, else detect
  - `t(locale: Locale, key: TKey): string` where `TKey = keyof typeof dict.nl`
  - `dict` — `{ nl: Record<string,string>, en: Record<string,string> }`

- [ ] **Step 1: Write the failing test**

`src/lib/i18n/i18n.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectLocale, resolveInitialLocale, t } from './index';
import { dict } from './dict';

describe('detectLocale', () => {
  it('maps nl* to nl', () => {
    expect(detectLocale('nl')).toBe('nl');
    expect(detectLocale('nl-NL')).toBe('nl');
  });
  it('maps anything else to en', () => {
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('de')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
});

describe('resolveInitialLocale', () => {
  it('prefers a valid stored locale', () => {
    expect(resolveInitialLocale('en', 'nl-NL')).toBe('en');
    expect(resolveInitialLocale('nl', 'en-US')).toBe('nl');
  });
  it('falls back to detection when stored is missing or invalid', () => {
    expect(resolveInitialLocale(null, 'nl-NL')).toBe('nl');
    expect(resolveInitialLocale('fr', 'en-US')).toBe('en');
  });
});

describe('t', () => {
  it('returns the string for the locale', () => {
    expect(t('nl', 'menu.search')).toBe(dict.nl['menu.search']);
    expect(t('en', 'menu.search')).toBe(dict.en['menu.search']);
  });
  it('every nl key has an en counterpart', () => {
    for (const k of Object.keys(dict.nl)) {
      expect(dict.en[k], `missing en for ${k}`).toBeTypeOf('string');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n`
Expected: FAIL — cannot resolve `./index` / `./dict`.

- [ ] **Step 3: Write `src/lib/i18n/dict.ts`**

```ts
export const dict = {
  nl: {
    'app.title': 'Hindernis kaart',
    'app.subtitle': 'Buitensport Durf',
    'menu.search': 'Zoeken…',
    'menu.design': 'Ontwerp',
    'menu.test': 'Test',
    'menu.test.soon': 'Binnenkort',
    'menu.settings': 'Instellingen',
    'settings.title': 'Instellingen',
    'settings.tiles': 'Kaartlaag',
    'settings.tiles.map': 'Kaart',
    'settings.tiles.map.sub': 'wegen',
    'settings.tiles.sat': 'Satelliet',
    'settings.tiles.sat.sub': 'Esri',
    'settings.language': 'Taal',
    'settings.mapdata': 'Kaartgegevens',
    'settings.mapdata.created': 'Aangemaakt',
    'settings.mapdata.count': 'objecten',
    'map.loading': 'Kaart laden…',
    'ls.title': 'localStorage vereist',
    'ls.body':
      'Deze app heeft een browser met localStorage nodig om instellingen en concepten op te slaan. Schakel privémodus uit of gebruik een moderne browser.'
  },
  en: {
    'app.title': 'Obstacle map',
    'app.subtitle': 'Buitensport Durf',
    'menu.search': 'Search…',
    'menu.design': 'Design',
    'menu.test': 'Test',
    'menu.test.soon': 'Soon',
    'menu.settings': 'Settings',
    'settings.title': 'Settings',
    'settings.tiles': 'Map layer',
    'settings.tiles.map': 'Map',
    'settings.tiles.map.sub': 'streets',
    'settings.tiles.sat': 'Satellite',
    'settings.tiles.sat.sub': 'Esri',
    'settings.language': 'Language',
    'settings.mapdata': 'Map data',
    'settings.mapdata.created': 'Created',
    'settings.mapdata.count': 'features',
    'map.loading': 'Loading map…',
    'ls.title': 'localStorage required',
    'ls.body':
      'This app needs a browser with localStorage to save settings and drafts. Turn off private mode or use a modern browser.'
  }
} as const;

export type TKey = keyof typeof dict.nl;
```

- [ ] **Step 4: Write `src/lib/i18n/index.ts`**

```ts
import { dict, type TKey } from './dict';

export type Locale = 'nl' | 'en';
export const LOCALES: Locale[] = ['nl', 'en'];
export const LANG_KEY = 'durf:lang';

export function detectLocale(navLang: string | undefined): Locale {
  return navLang && navLang.toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

function isLocale(v: string | null): v is Locale {
  return v === 'nl' || v === 'en';
}

export function resolveInitialLocale(
  stored: string | null,
  navLang: string | undefined
): Locale {
  return isLocale(stored) ? stored : detectLocale(navLang);
}

export function t(locale: Locale, key: TKey): string {
  return dict[locale][key];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- i18n`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add bilingual i18n dictionary and locale resolution"
```

---

## Task 4: localStorage guard + blocking dialog

**Files:**
- Create: `src/lib/storage/local.ts`, `src/lib/storage/local.test.ts`, `src/lib/components/LsBlockDialog.svelte`

**Interfaces:**
- Consumes: `t`, `Locale` from `$lib/i18n`.
- Produces:
  - `isLocalStorageAvailable(): boolean` — feature-detects by writing/removing `durf:__probe__`
  - `readKey(key: string): string | null`, `writeKey(key: string, value: string): void` — safe wrappers (swallow errors)
  - `LsBlockDialog.svelte` — full-screen ink dialog shown when storage is missing; prop `locale: Locale`.

- [ ] **Step 1: Write the failing test**

`src/lib/storage/local.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLocalStorageAvailable, readKey, writeKey } from './local';

afterEach(() => vi.unstubAllGlobals());

describe('isLocalStorageAvailable', () => {
  it('true when localStorage works', () => {
    expect(isLocalStorageAvailable()).toBe(true);
  });
  it('false when setItem throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new Error('denied'); },
      removeItem: () => {},
      getItem: () => null
    });
    expect(isLocalStorageAvailable()).toBe(false);
  });
});

describe('readKey/writeKey', () => {
  it('round-trips a value', () => {
    writeKey('durf:test', 'hi');
    expect(readKey('durf:test')).toBe('hi');
  });
  it('readKey returns null on throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => {},
      removeItem: () => {}
    });
    expect(readKey('durf:test')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- local`
Expected: FAIL — cannot resolve `./local`.

- [ ] **Step 3: Write `src/lib/storage/local.ts`**

```ts
const PROBE = 'durf:__probe__';

export function isLocalStorageAvailable(): boolean {
  try {
    localStorage.setItem(PROBE, '1');
    localStorage.removeItem(PROBE);
    return true;
  } catch {
    return false;
  }
}

export function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* best effort */
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- local`
Expected: PASS.

- [ ] **Step 5: Write `src/lib/components/LsBlockDialog.svelte`**

```svelte
<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  let { locale }: { locale: Locale } = $props();
</script>

<div style="position:fixed;inset:0;z-index:1600;background:var(--ink-700);display:flex;align-items:center;justify-content:center;padding:20px">
  <div style="width:min(92vw,380px);text-align:center;color:#fff">
    <div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
    </div>
    <div style="font:700 18px var(--font-sans);margin-bottom:8px">{t(locale, 'ls.title')}</div>
    <div style="font:500 14px/1.6 var(--font-sans);color:#d6d6d6">{t(locale, 'ls.body')}</div>
  </div>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add localStorage guard and blocking dialog"
```

---

## Task 5: Tile config + failover logic

**Files:**
- Create: `src/lib/map/tiles.ts`, `src/lib/map/tiles.test.ts`

**Interfaces:**
- Produces:
  - `type TileKey = 'map' | 'sat'`
  - `interface TileLayerDef { key: TileKey; url: string; attribution: string; maxZoom: number; subdomains?: string }`
  - `TILE_LAYERS: Record<TileKey, TileLayerDef>`
  - `DEFAULT_TILE: TileKey` (= `'map'`)
  - `otherTile(key: TileKey): TileKey` — returns the failover partner
  - `resolveInitialTile(stored: string | null): TileKey` — stored wins if valid, else `DEFAULT_TILE`
  - `TILE_ERROR_THRESHOLD: number` (= `10`)

- [ ] **Step 1: Write the failing test**

`src/lib/map/tiles.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TILE_LAYERS, DEFAULT_TILE, otherTile, resolveInitialTile } from './tiles';

describe('TILE_LAYERS', () => {
  it('map is CARTO Voyager with OSM+CARTO attribution', () => {
    expect(TILE_LAYERS.map.url).toContain('basemaps.cartocdn.com/rastertiles/voyager');
    expect(TILE_LAYERS.map.attribution).toBe('© OpenStreetMap © CARTO');
  });
  it('sat is Esri World Imagery', () => {
    expect(TILE_LAYERS.sat.url).toContain('server.arcgisonline.com/ArcGIS/rest/services/World_Imagery');
    expect(TILE_LAYERS.sat.attribution).toBe('© Esri');
  });
});

describe('failover + defaults', () => {
  it('default is map', () => { expect(DEFAULT_TILE).toBe('map'); });
  it('otherTile swaps', () => {
    expect(otherTile('map')).toBe('sat');
    expect(otherTile('sat')).toBe('map');
  });
  it('resolveInitialTile honours a valid stored key, else default', () => {
    expect(resolveInitialTile('sat')).toBe('sat');
    expect(resolveInitialTile(null)).toBe('map');
    expect(resolveInitialTile('bogus')).toBe('map');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tiles`
Expected: FAIL — cannot resolve `./tiles`.

- [ ] **Step 3: Write `src/lib/map/tiles.ts`**

```ts
export type TileKey = 'map' | 'sat';

export interface TileLayerDef {
  key: TileKey;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
}

export const TILE_LAYERS: Record<TileKey, TileLayerDef> = {
  map: {
    key: 'map',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 20,
    subdomains: 'abcd'
  },
  sat: {
    key: 'sat',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19
  }
};

export const DEFAULT_TILE: TileKey = 'map';
export const TILE_ERROR_THRESHOLD = 10;

export function otherTile(key: TileKey): TileKey {
  return key === 'map' ? 'sat' : 'map';
}

function isTileKey(v: string | null): v is TileKey {
  return v === 'map' || v === 'sat';
}

export function resolveInitialTile(stored: string | null): TileKey {
  return isTileKey(stored) ? stored : DEFAULT_TILE;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tiles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add tile-layer config and failover logic"
```

---

## Task 6: Leaflet map canvas with tile switching

**Files:**
- Create: `src/lib/map/MapCanvas.svelte`
- Modify: `src/app.css` (add Leaflet CSS import + container background)

**Interfaces:**
- Consumes: `TILE_LAYERS`, `otherTile`, `TILE_ERROR_THRESHOLD`, `type TileKey` from `$lib/map/tiles`.
- Produces: `MapCanvas.svelte` with props `{ tile: TileKey; onFailover?: (next: TileKey) => void; onBothTilesDown?: () => void }`. Mounts Leaflet on a full-screen div, applies the active tile layer, swaps layers when `tile` changes (via `$effect`), and on repeated tile errors fails over once (calling `onFailover`), then signals `onBothTilesDown` if the partner also fails.

- [ ] **Step 1: Add Leaflet CSS to `src/app.css`**

Add near the top (after token imports):
```css
@import 'leaflet/dist/leaflet.css';
```
And a rule:
```css
.leaflet-container { background: #dfe8d8; font-family: 'Geist', sans-serif; }
```

- [ ] **Step 2: Write `src/lib/map/MapCanvas.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import { TILE_LAYERS, otherTile, TILE_ERROR_THRESHOLD, type TileKey } from './tiles';

  let {
    tile = 'map',
    onReady,
    onFailover,
    onBothTilesDown
  }: {
    tile?: TileKey;
    onReady?: () => void;
    onFailover?: (next: TileKey) => void;
    onBothTilesDown?: () => void;
  } = $props();

  const CENTER: [number, number] = [52.027, 4.365];
  let el: HTMLDivElement;
  let map: L.Map | undefined;
  let layers: Partial<Record<TileKey, L.TileLayer>> = {};
  let active: TileKey | undefined;
  let failedOnce = false;

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
    onReady?.();
    return () => map?.remove();
  });

  $effect(() => {
    if (map && tile !== active) applyTile(tile);
  });
</script>

<div bind:this={el} style="position:absolute;inset:0;z-index:0"></div>
```

- [ ] **Step 3: Manually verify the map renders and switches**

Temporarily wire `src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import MapCanvas from '$lib/map/MapCanvas.svelte';
  let tile = $state<'map' | 'sat'>('map');
</script>
<MapCanvas {tile} />
<button style="position:absolute;top:8px;left:8px;z-index:10" onclick={() => (tile = tile === 'map' ? 'sat' : 'map')}>swap</button>
```
Run: `npm run dev`. Expected: CARTO Voyager tiles over Delft; clicking "swap" switches to Esri satellite and back; zoom control bottom-right; attribution shows. Revert the temporary button after confirming (page is finalized in Task 7).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Leaflet map canvas with tile switching and failover"
```

---

## Task 7: App shell — hamburger menu, settings, wiring

**Files:**
- Create: `src/lib/state/app.svelte.ts`, `src/lib/components/AppShell.svelte`, `src/lib/components/Menu.svelte`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `MapCanvas`, `LsBlockDialog`, i18n (`t`, `resolveInitialLocale`, `LANG_KEY`, `LOCALES`, `Locale`), storage (`isLocalStorageAvailable`, `readKey`, `writeKey`), tiles (`resolveInitialTile`, `TileKey`).
- Produces: `createAppState()` returning a runes-based reactive object `{ locale, tile, menuOpen, menuLevel, setLocale, setTile, toggleMenu, closeMenu, gotoSettings }`; `AppShell.svelte` orchestrating hamburger + menu overlay + map; a finalized `/` route.

- [ ] **Step 1: Write shared state `src/lib/state/app.svelte.ts`**

```ts
import { resolveInitialLocale, LANG_KEY, type Locale } from '$lib/i18n';
import { resolveInitialTile } from '$lib/map/tiles';
import type { TileKey } from '$lib/map/tiles';
import { readKey, writeKey } from '$lib/storage/local';

export type MenuLevel = 'root' | 'settings';

export function createAppState() {
  let locale = $state<Locale>(
    resolveInitialLocale(readKey(LANG_KEY), typeof navigator !== 'undefined' ? navigator.language : undefined)
  );
  let tile = $state<TileKey>(resolveInitialTile(readKey('durf:tile')));
  let menuOpen = $state(false);
  let menuLevel = $state<MenuLevel>('root');

  return {
    get locale() { return locale; },
    get tile() { return tile; },
    get menuOpen() { return menuOpen; },
    get menuLevel() { return menuLevel; },
    setLocale(l: Locale) { locale = l; writeKey(LANG_KEY, l); },
    setTile(k: TileKey) { tile = k; writeKey('durf:tile', k); menuOpen = false; },
    failoverTile(k: TileKey) { tile = k; },
    toggleMenu() {
      if (!menuOpen) { menuOpen = true; menuLevel = 'root'; }
      else if (menuLevel === 'settings') { menuLevel = 'root'; }
      else { menuOpen = false; }
    },
    closeMenu() { menuOpen = false; menuLevel = 'root'; },
    gotoSettings() { menuLevel = 'settings'; }
  };
}

export type AppState = ReturnType<typeof createAppState>;
```

- [ ] **Step 2: Write `src/lib/components/Menu.svelte`**

```svelte
<script lang="ts">
  import { t, LOCALES, type Locale } from '$lib/i18n';
  import { TILE_LAYERS, type TileKey } from '$lib/map/tiles';
  import type { AppState } from '$lib/state/app.svelte';
  let { app }: { app: AppState } = $props();

  const rowBase =
    'display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;background:transparent;border:none;border-radius:10px;cursor:pointer;font:600 14px var(--font-sans);color:#232323;text-align:left';
</script>

<div onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1"
  style="position:absolute;top:64px;left:12px;z-index:1200;width:min(86vw,300px);max-height:78vh;overflow:auto;background:#fff;border:1px solid var(--border-subtle);border-radius:16px;box-shadow:var(--shadow-md);padding:10px">
  {#if app.menuLevel === 'root'}
    <div style="display:flex;align-items:center;gap:10px;padding:2px 8px 12px">
      <div>
        <div style="font:700 14.5px var(--font-sans);color:#232323">{t(app.locale, 'app.title')}</div>
        <div style="font:500 11px var(--font-sans);color:var(--text-muted)">{t(app.locale, 'app.subtitle')} · v2026.juni</div>
      </div>
    </div>
    <button style={rowBase} onclick={() => app.gotoSettings()}>
      <span style="flex:1">{t(app.locale, 'menu.settings')}</span>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg>
    </button>
  {:else}
    <div style="font:700 15px var(--font-sans);color:#232323;padding:2px 8px 12px">{t(app.locale, 'settings.title')}</div>
    <div style="font:700 10px var(--font-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:4px 12px">{t(app.locale, 'settings.tiles')}</div>
    {#each ['map', 'sat'] as key (key)}
      <button style={rowBase + (app.tile === key ? ';background:var(--brand-subtle)' : '')} onclick={() => app.setTile(key as TileKey)}>
        <span style="flex:1">{t(app.locale, key === 'map' ? 'settings.tiles.map' : 'settings.tiles.sat')}
          <span style="font-weight:500;color:var(--text-muted);font-size:12px">· {t(app.locale, key === 'map' ? 'settings.tiles.map.sub' : 'settings.tiles.sat.sub')}</span>
        </span>
      </button>
    {/each}
    <div style="height:1px;background:var(--border-subtle);margin:8px 6px"></div>
    <div style="font:700 10px var(--font-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:4px 12px">{t(app.locale, 'settings.language')}</div>
    <div style="display:flex;gap:8px;padding:4px 12px 8px">
      {#each LOCALES as l (l)}
        <button onclick={() => app.setLocale(l)}
          style="flex:1;padding:8px;border-radius:8px;border:1.5px solid {app.locale === l ? 'var(--bok-500)' : 'var(--border)'};background:{app.locale === l ? 'var(--brand-subtle)' : '#fff'};font:600 13px var(--font-sans);cursor:pointer;text-transform:uppercase">{l}</button>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 3: Write `src/lib/components/AppShell.svelte`**

```svelte
<script lang="ts">
  import MapCanvas from '$lib/map/MapCanvas.svelte';
  import Menu from './Menu.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { t } from '$lib/i18n';

  const app = createAppState();
</script>

<div style="position:fixed;inset:0;overflow:hidden">
  <MapCanvas tile={app.tile} onFailover={(n) => app.failoverTile(n)} />

  <button aria-label={t(app.locale, 'menu.settings')} onclick={() => app.toggleMenu()}
    style="position:absolute;top:12px;left:12px;width:44px;height:44px;z-index:1250;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--border-subtle);border-radius:12px;box-shadow:var(--shadow-md);cursor:pointer;color:#232323">
    {#if app.menuOpen && app.menuLevel === 'settings'}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
    {:else if app.menuOpen}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
    {:else}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"></path></svg>
    {/if}
  </button>

  {#if app.menuOpen}
    <div onclick={() => app.closeMenu()} role="presentation"
      style="position:absolute;inset:0;z-index:1150;background:rgba(0,0,0,.04)"></div>
    <Menu {app} />
  {/if}
</div>
```

- [ ] **Step 4: Finalize `src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import LsBlockDialog from '$lib/components/LsBlockDialog.svelte';
  import { isLocalStorageAvailable, readKey } from '$lib/storage/local';
  import { resolveInitialLocale, LANG_KEY } from '$lib/i18n';

  let storageOk = $state(true);
  const locale = resolveInitialLocale(
    typeof localStorage !== 'undefined' ? readKey(LANG_KEY) : null,
    typeof navigator !== 'undefined' ? navigator.language : undefined
  );

  onMount(() => { storageOk = isLocalStorageAvailable(); });
</script>

{#if !storageOk}
  <LsBlockDialog {locale} />
{:else}
  <AppShell />
{/if}
```

- [ ] **Step 5: Verify the full shell**

Run: `npm run check && npm run build && npm run dev`.
Expected: `svelte-check` reports 0 errors; build succeeds. In the browser: full-screen Voyager map; hamburger (top-left) opens a menu titled "Hindernis kaart"; Settings › shows the tile picker (Kaart/Satelliet) and a NL/EN language toggle; switching tiles updates the basemap and persists across reload; switching language re-labels the menu live and persists; the hamburger morphs ☰ → ✕ → ← across levels; tapping the scrim closes the menu.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: app shell with hamburger menu, settings, and i18n wiring"
```

---

## Self-Review

**Spec coverage (this plan's slice):**
- SPA / adapter-static / no backend → Task 1 (Global Constraints, `+layout.ts`). ✓
- Durf design system (Bok blauw, Geist, tokens, shadcn contract) → Task 2. ✓
- i18n NL default/EN, browser-detect, persist, chrome-only → Tasks 3, 7. ✓
- localStorage hard requirement + blocking dialog → Task 4, Task 7 Step 4. ✓
- Two tile layers, real URLs/attribution, default Voyager, failover → Tasks 5, 6. ✓
- App shell: hamburger 44px, ☰/✕/← morph, floating panel, tap-outside close, Settings sub-level with tile picker + data info → Task 7. ✓ (feature-count/created-date data row is a placeholder here; populated in Plan 2 when data loads.)
- **Deferred to later plans (intentional, not gaps):** GeoJSON schema + load + markers (Plan 2), detail panel (Plan 3), search (Plan 4), design/editor + export + draft lifecycle (Plan 5), service worker + tile-down dialog + draft red-dot (Plan 6). The `LsBlockDialog` and `onBothTilesDown` hook are built here; the tile-down dialog UI is wired in Plan 6.

**Placeholder scan:** No "TBD"/"add error handling"-style placeholders. The settings "Map data" row is explicitly deferred to Plan 2 (documented), not a silent gap.

**Type consistency:** `TileKey` (`'map'|'sat'`), `Locale` (`'nl'|'en'`), `t(locale, key)`, `otherTile`, `resolveInitialTile`, `resolveInitialLocale`, `readKey`/`writeKey`/`isLocalStorageAvailable`, `createAppState` accessor names (`setTile`, `failoverTile`, `gotoSettings`, `toggleMenu`, `closeMenu`) are used consistently across Tasks 3–7.
