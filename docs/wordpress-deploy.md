# WordPress Deploy

The app deploys as static files into a subdirectory of the existing WordPress site at buitensportdurf.nl, without touching WordPress itself. Production builds target `/hindernisbaan` instead of `/`.

- Live URL: `https://www.buitensportdurf.nl/hindernisbaan/`
- Server path: `/domains/buitensportdurf.nl/public_html/hindernisbaan`
- Host: Antagonist (DirectAdmin, `s172.webhostingserver.nl`, account `deb12352`)

## Deploy method

Primary method is the **DirectAdmin API over HTTPS** using a scoped login key: the script zips `build/`, uploads it through the DirectAdmin file manager API on port 2222, extracts it server-side, and removes the zip.

Why not the alternatives:

- **SSH/rsync**: Antagonist firewalls port 22 until SSH is enabled *and* your current IP is whitelisted in DirectAdmin; deploys break whenever your IP changes.
- **FTPES**: works, but requires storing the full account password locally.

The login key is created in DirectAdmin under **Advanced Features → Login Keys** (`https://buitensportdurf.nl:2222/evo/login-keys`), restricted to file manager commands (`CMD_FILE_MANAGER`). It can be revoked at any time without affecting the account password.

## Setup

```bash
cp deploy.env.example .env.deploy.local
# then fill in DEPLOY_DA_LOGIN_KEY
```

Secrets stay in `.env.deploy.local` (gitignored). Never commit passwords or login keys.

## Deploy

```bash
npm run deploy:wp
```

What it does:

1. Builds with `BASE_PATH=/hindernisbaan` (`npm run build:wp`)
2. Zips `build/` and uploads it via the DirectAdmin API
3. Extracts into `DEPLOY_PATH` and deletes the zip

Note: extraction overwrites files but does not remove files deleted from the build. Hashed asset filenames make this harmless; for an occasional clean slate, delete the folder contents in the DirectAdmin file manager and redeploy.

## Fallbacks

`DEPLOY_METHOD=ftp` (FTPES via `lftp`, needs `DEPLOY_PASSWORD`) and `DEPLOY_METHOD=ssh` (rsync, needs SSH enabled + IP whitelist in DirectAdmin) remain available; see the commented blocks in `deploy.env.example`.

```bash
brew install lftp   # only needed for the ftp fallback
```

## WordPress embed (optional, later)

```html
<div style="width:100%;min-height:80vh;">
  <iframe
    src="https://www.buitensportdurf.nl/hindernisbaan/"
    title="Hindernisbaan"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
    style="width:100%;height:80vh;border:0;"
  ></iframe>
</div>
```

## Post-deploy checks

- `https://www.buitensportdurf.nl/hindernisbaan/` loads
- `https://www.buitensportdurf.nl/hindernisbaan/design` loads or falls back to the SPA shell
- `https://www.buitensportdurf.nl/hindernisbaan/data/obstacles.geojson` returns the GeoJSON
- framing headers do not block the iframe (`X-Frame-Options` / CSP `frame-ancestors`)
