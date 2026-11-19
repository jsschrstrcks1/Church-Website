# Lakeview Fellowship Church — self-hosted website

Depends on the `syndication-engine` template; this repo is the production home of the
site we synthesize from it.

## What this is now (verified 2026-11-19)

- **Public site** (`public/`): plain HTML/CSS/JS, rebranded to Lakeview Fellowship
  Church (Hudson FL 34667; 9208 Bolton Ave; (727) 856-4100; "Taking strangers, making
  family."). Bilingual EN/ES, events calendar, live-watch section. Verified to serve and
  render locally (HTTP 200 on all assets; EN/ES toggle works in a real browser).
- **Deploy** (`.github/workflows/deploy.yml`): pushes to `main` deploy the static
  `public/` to Cloudflare Pages on the free tier via GitHub Actions. No subscription,
  no Firebase.

## Placeholders to replace before public launch (each marked EDIT in the source)

| What | File(s) |
|---|---|
| Real church logo | `public/images/logo.png` (current file is the template's mark) |
| Real hero photo | `public/images/hero-church.jpg` |
| YouTube channel ID (starts `UC...`) | `public/js/main.js`, `public/index.html` |
| Facebook page URL | `public/js/main.js`, `public/index.html` |
| Giving link (PayPal.Me / Tithe.ly / church page) | `public/index.html` |

## Cloudflare + GitHub setup (one time)

1. Cloudflare account: create a **Pages** project named `lakeview-fellowship-church`.
   The first GitHub push creates it; leave "production branch" = `main`.
2. GitHub repo secret `CLOUDFLARE_API_TOKEN` — a Cloudflare API token scoped to
   `Cloudflare Pages:Edit` (+ `Account:Account Settings:Read`).
3. GitHub repo secret `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account id.

## Local preview

```sh
cd public && python3 -m http.server 8123
```

## Cutover (LAST step — do not do this until the new site is confirmed live)

1. Confirm the Pages deployment serves the rebranded site at
   `<project>.pages.dev`.
2. In Cloudflare DNS for `lakeviewfellowshipchurch.com`, add:
   - `A` (apex) → Pages (Cloudflare gives the anycast IP(s))
   - `www` → CNAME to the Pages domain
3. At the GoDaddy registrar, change the nameservers from `*.finalweb.net` to
   Cloudflare's, then cancel the FinalWeb/paid plan only after DNS is verified.

## Status

- [x] Public static site rebranded + verified render
- [x] GitHub Action deploy scaffold
- [ ] Cloudflare Pages project + DNS
- [ ] Backend phase: members areas / newsletter / live studio re-wired from Firebase
      to Cloudflare Workers + D1 (currently the public page is fully static; the
      React members app in `app/` still points at Firebase — see next phase)
