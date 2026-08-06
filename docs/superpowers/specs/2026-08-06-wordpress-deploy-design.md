# Deploy to buitensportdurf.nl (WordPress subfolder) — Design

Date: 2026-08-06

## Goal

Serve the built app at `https://www.buitensportdurf.nl/hindernisbaan/` as static files in a subfolder of the existing WordPress site, leaving WordPress untouched. No WP page embed for now; the club links to it later.

## Decisions

- **URL/base path**: `/hindernisbaan` (renamed from the earlier `/hinderniskaart` draft).
- **Transport**: DirectAdmin file-manager API over HTTPS (`DEPLOY_METHOD=da-api`), authenticated with a scoped, revocable DirectAdmin login key stored only in `.env.deploy.local`. Chosen over:
  - *SSH/rsync* — Antagonist firewalls port 22 behind per-IP whitelisting; breaks when the local IP changes (confirmed: port 22 unreachable).
  - *FTPES* — works but requires the full account password on disk. Kept as fallback.
- **Mechanism**: zip `build/` → upload via `CMD_FILE_MANAGER` → extract server-side into `/domains/buitensportdurf.nl/public_html/hindernisbaan` → delete zip.
- **App changes**: none beyond the existing `BASE_PATH` support (`svelte.config.js` `paths.base`, `$app/paths` in `loader.ts`/`Menu.svelte`). Tests stay base-path-agnostic.

## Components

- `npm run build:wp` — builds with `BASE_PATH=/hindernisbaan`.
- `npm run deploy:wp` → `scripts/deploy-wordpress.sh` — loads `.env.deploy.local`, builds, uploads via the selected method (`da-api` default; `ftp`/`ssh` fallbacks retained).
- `deploy.env.example` — documented template; secrets never committed.
- `docs/wordpress-deploy.md` — operator guide incl. post-deploy checks and optional iframe snippet.

## Error handling

Learned during implementation: DirectAdmin file-manager POSTs require a session (login key must have the Allow Login/HTM flag; `POST /api/login` first), and successful POSTs often return a bogus HTTP 500. The script therefore ignores POST statuses and verifies each step through directory listings (zip present after upload, `index.html` present after extract), failing loudly if verification misses. Extraction overwrites but does not prune deleted files — acceptable because asset filenames are hashed; occasional manual clean via the DA file manager. An `.htaccess` shipped via `static/` provides the Apache SPA fallback for deep links.

## Verification

Live checks after deploy: app shell at `/hindernisbaan/`, SPA fallback at `/hindernisbaan/design`, GeoJSON at `/hindernisbaan/data/obstacles.geojson`, and WordPress still serving normally at `/`.
