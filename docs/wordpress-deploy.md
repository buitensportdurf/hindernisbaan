# WordPress Deploy

The app deploys as static files into a subdirectory of the existing WordPress site at buitensportdurf.nl, without touching WordPress itself. Production builds target `/hindernisbaan` instead of `/`.

- Live URL: `https://www.buitensportdurf.nl/hindernisbaan/`
- Server path: `/domains/buitensportdurf.nl/public_html/hindernisbaan` (relative to the account home)
- Host: Antagonist (DirectAdmin, `s172.webhostingserver.nl`, account `deb123524` — note the trailing `4`; `deb12352` is wrong)

## Deploy

```bash
npm run deploy:wp
```

Builds with `BASE_PATH=/hindernisbaan` (`npm run build:wp`), then rsyncs `build/` over SSH with `--delete`, so removed files are pruned. Config lives in `.env.deploy.local` (gitignored, from `deploy.env.example`); the SSH identity comes from the `buitensportdurf-deploy` alias in `~/.ssh/config` pointing at `~/.ssh/deploy-buitensportdurf.nl`.

## SSH access on Antagonist

Antagonist firewalls port 22 by default. Access is granted per key **and per client IP** in DirectAdmin: **Extra Features → SSH menu** (`https://buitensportdurf.nl:2222/evo/plugin?src=%2FCMD_PLUGINS%2Fssh`). The current grant:

- Key: `hindernisbaan-deploy` (ed25519, MD5 fingerprint `14:16:0f:2c:27:da:e2:f2:b4:25:c5:8b:95:ca:e9:5b`)
- IP: `87.209.210.59`, expiry 1 year → **2027-08-06**

**If deploys stop connecting** ("no route to host"): your IP changed or the grant expired. Open the SSH menu page, fill in your current IP ("Gebruik huidig IP-adres"), pick "1 jaar", select the existing key under "Voeg toe aan", and add. No new keypair needed.

An alternative that needs no IP grants exists (DirectAdmin file-manager API with a login key); it was built, proven, and then removed for simplicity — see `docs/superpowers/specs/2026-08-06-wordpress-deploy-design.md` and git history (`d7c65d2`) if it's ever needed again. Quirks to remember if reviving it: POSTs need a session via `/api/login` (key must have Allow Login), successful POSTs may return bogus HTTP 500s, and repeated auth failures trigger a temporary lockout.

## SPA fallback

`static/.htaccess` ships with every build and makes Apache serve the SvelteKit fallback page for unknown paths, so deep links like `/design` work.

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
- `https://www.buitensportdurf.nl/hindernisbaan/design` serves the SPA shell
- `https://www.buitensportdurf.nl/hindernisbaan/data/obstacles.geojson` returns the GeoJSON
- WordPress still serves normally at `https://www.buitensportdurf.nl/`
- framing headers do not block the iframe (`X-Frame-Options` / CSP `frame-ancestors`)
