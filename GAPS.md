# Known gaps / deferred content (Lakeview Fellowship Church)

Tracked so a later session resumes precisely. Verified against the live site 2026-11-20.

## 1. `/about` and `/history` pages — empty on the original (need real content from Ken)

- Both resolve live (HTTP 200) on lakeviewfellowshipchurch.com and exist in the site''s page list,
  but contain NO real content:
  - `/about` — title "About", page model holds only the section/widget shell, no prose.
  - `/history` — **lorem ipsum** placeholder text (the original''s own unfinished page).
- Decision pending (Ken): build them with real content (Ken to supply a paragraph about the
  church + the church''s history), or ship link-capable stubs. NOT built yet — do not fabricate
  doctrine or history. My recommended default: build both under the About Us nav once Ken supplies
  content; a visitor could otherwise land on a hole.

## 2. Backend phase — the core remaining build (was in progress as of this note)

- The public static site is complete and live on GitHub Pages (URL + all pages plus assets verified
  200). What is NOT done:
  - `app/` (React members area: auth, invites, events admin, newsletters, Live Studio) and
    `functions/` (15 Firebase Functions: acceptInvite, email, facebook, liveChat, liveStream,
    liveStudioVideo, newsletterEventNotifications, newsletterFormNotifications,
    newsletterPollTally, removeMember, siteConfig, translateNewsletter, youtube, + index) still
    point at **Firebase** (Auth, Firestore, Storage, Functions).
  - These must be re-wired to **Cloudflare Workers + D1** (members, events, newsletters, sessions,
    live-stream relay) so the members area works on our own free infra, per Ken''s ruling ("our
    version, hosted fully by us, no fees, Cloudflare + GitHub, drop Firebase").
- See this session''s measured notes in `references/lakeview-fellowship.md` (self-host-migration
  skill) for the full build state and remaining Cloudflare/DNS cutover steps.

## 3. Domain cutover (LAST step — not yet done)

- Cloudflare Pages project + DNS binding, then change GoDaddy nameservers off `*.finalweb.net` only
  after the backend + new site are confirmed live. Cloudflare workflow in
  `.github/workflows/deploy.yml` needs GitHub secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

**Soli Deo Gloria.**
