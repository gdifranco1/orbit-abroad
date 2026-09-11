# Orbit Abroad

A launch-preparation package for a free, local-first private beta serving international students and expats in the United States.

**Authorized GitHub Pages target:** <https://gdifranco1.github.io/orbit-abroad/>

## Included

- `index.html` — customer landing page
- `app.html` — working Orbit Abroad application
- `privacy.html` — plain-language privacy notice and beta limitations
- `manifest.webmanifest` and `service-worker.js` — installable/offline PWA support
- `CUSTOMER-LAUNCH-KIT.md` — recruiting, interview, safety, and validation guide
- `DEPLOYMENT.md` — exact Giulio-account GitHub Pages publication steps
- `preview.html` and `app-preview.html` — server-free Hermes previews (generated during validation)
- `validate.py` — local launch-package validator

## Run locally

```bash
cd /home/caragon/giulio-workspace/orbit-abroad
python3 -m http.server 8010 --bind 127.0.0.1
```

Open <http://127.0.0.1:8010>. PWA installation and service workers require localhost or HTTPS; they do not run from a direct `file://` preview.

## Test

```bash
node --test core.test.js smart-inbox.test.js
python3 validate.py
```

## Privacy model

- Pasted source text is analyzed in the browser.
- Only confirmed task fields are stored in browser local storage.
- There are no user accounts, analytics, advertising pixels, or cloud task database.
- Users can export/import backups and delete all local Orbit data.
- Exported backups are unencrypted and must be protected by the user.

## Publication boundary

The files are prepared for static HTTPS hosting, but they have not been published or deployed. Publishing requires Cameron’s approval under the workspace rules. Before a real public launch, have the privacy notice and beta terms reviewed for the final operator, jurisdiction, hosting setup, and domain.

Cameron approved preparing this folder for public publication under Giulio's
`gdifranco1/orbit-abroad` repository. No remote has been added and no code has
been pushed. Follow `DEPLOYMENT.md` while authenticated only as `gdifranco1`.
