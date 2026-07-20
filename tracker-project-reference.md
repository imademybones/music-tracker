# Music Tracker — project reference

Quick lookup for IDs and endpoints used by the app. Update this whenever a
table/field is added, renamed, or the Worker is redeployed elsewhere.

## Airtable

Base: **Music Tracker** — `appnE86WFyrqsel7S`

### Releases — `tblIqRLQ6FznjfljN`
Primary (only) table. Fields (name → id): Artist `fld5qPO7GsWoEF7z0`, Title
`fld4DRlwVfZVFG6tg`, Genre `fldIjas2X3u96vfNN`, Release Date
`fldjlYvx1TRjor3ur`, Format `fldMCU8yaVF7ZWMDJ`, Rating `fldol6UDZfXXXIXrL`,
Notes `fld8tP07c7BvdpuqL`, Listened `fldR0FgAZ9Gaf3cKn`, Revisits
`fldn9BTEIKgC6V3Xt`, Added At `fldA91vuzlNH5gHtr`, Updated At
`fldmvultlBcTvQNiY`, Spotify Added `fldEw3jGepj6jiGXG`, Spotify URL
`fldLQsl4QiCM5Ui23`, Cover Override `fldlDBJmeWEtA0z2d` (Attachment, added v10).

## Cloudflare Worker

Deployed at `https://api.foundfrequency.com` (custom domain added 2026-07-20;
previously `https://music-tracker.stephen-nolan85.workers.dev`, still reachable
as the underlying workers.dev hostname), file `music-tracker-worker-v2.js`,
pasted directly into the Cloudflare dashboard — not part of this repo/deploy.

Env vars: `AIRTABLE_TOKEN` (encrypted), `BASE_ID`, `TABLE_NAME` (`Releases`),
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (encrypted),
`COVER_OVERRIDE_FIELD_ID` (encrypted, added v10 — the `fld…` id above).

Routes:
- bare `WORKER_URL` → Airtable CRUD on `Releases` (via `env.TABLE_NAME`)
- `WORKER_URL/spotify/*` → Spotify Web API search proxy (Client Credentials,
  app-only)
- `WORKER_URL/upload-attachment` → proxies Airtable's content-upload API
  (`POST https://content.airtable.com/v0/{baseId}/{recordId}/{fieldId}/uploadAttachment`)
  for the manual artwork file-upload path (added v10)

CORS is restricted to `Access-Control-Allow-Origin: https://foundfrequency.com`
(changed 2026-07-20 from `https://imademybones.github.io` — see "Custom domain
move" below). This Origin check is spoofable outside a browser — see
Cloudflare Access below for the real access-control layer.

## Cloudflare Access (go-live gate)

**Status: done and verified end-to-end, 2026-07-19.** Worker-only scope —
the static page on GitHub Pages can't be gated by Access at all (Access only
intercepts traffic through domains Cloudflare's edge actually proxies;
`imademybones.github.io` never touches Cloudflare, so it wasn't even
selectable as an Application domain). The page shell stays publicly
loadable; the Worker — the part that actually touches Airtable — is the one
gated. Turned out **not** to be the zero-code-change layer originally
scoped: it needed client fetch changes, a Worker CORS header, and a specific
Access setting, all recorded below since none of this is obvious from the
Cloudflare UI alone.

Setup:

1. Zero Trust → Access → Applications → team name `falling-disk-d589`.
2. Self-hosted application "music-tracker", Destination: Subdomain
   `api`, Domain `foundfrequency.com`, no path (covers the whole Worker —
   `/spotify`, `/upload-attachment`, everything). Originally Subdomain
   `music-tracker`, Domain `stephen-nolan85.workers.dev` — moved 2026-07-20,
   see "Custom domain move" below.
3. Policy "My email": Allow, Include → Emails → `stephen.nolan85@gmail.com`.
4. Identity provider: only "Sign in with Cloudflare" is enabled by default
   (not "One-time PIN" as originally assumed) — fine for solo use since
   that's already Stephen's account, but anyone else added to the policy
   would need their own Cloudflare account too. Add "One-time PIN" under
   **Settings → Authentication** first if sharing beyond that.
5. **Application → Additional settings → Advanced settings → CORS settings →
   "Bypass options requests to origin"** — enabled. Required because
   preflight (`OPTIONS`) requests never carry cookies, so Access can't
   authenticate them; without this, Access intercepts preflight and returns
   a response with no `Access-Control-Allow-Origin` header, which the
   browser treats as a failed preflight, blocking the real request before
   it's even sent. Safe here because the Worker already answers `OPTIONS`
   unconditionally with full CORS headers before its own Origin check (see
   `corsHeaders()` in the Worker source) — this setting just lets that
   handler actually get reached.
6. Worker CORS headers — added `'Access-Control-Allow-Credentials': 'true'`
   to `corsHeaders()` in the Worker (pasted via dashboard Quick Edit).
   Required because index.html now sends `credentials: 'include'`; without
   this header the browser discards the cookie regardless.
7. Client fetch changes — `index.html` v16 (commit `b568b8a`): all four
   Worker-bound `fetch()` calls (`airtableRequest`, artwork upload, Spotify
   search, Spotify artist lookup) send `credentials: 'include'`, so the
   browser attaches the `CF_Authorization` cookie after login. The iTunes
   cover-art fetch is untouched — it isn't behind the Worker/Access.

**Caveats worth remembering:**

- A direct browser visit to `https://api.foundfrequency.com` will *always*
  show "Forbidden" even once logged in — that's expected, it's the Worker's
  own `Origin` check rejecting a raw navigation (no `Origin` header on a
  top-level GET), not an Access problem. (The old
  `music-tracker.stephen-nolan85.workers.dev` hostname still reaches the same
  Worker but is no longer gated by Access at all, since the Access
  application's Destination moved to `api.foundfrequency.com` — don't rely on
  it being protected.)
- The Access session cookie is scoped normally — it does **not** persist
  across incognito vs. regular windows, or across separate incognito
  sessions. Login and app testing need to happen in the same window/profile,
  or every request looks like a fresh unauthenticated one (this cost a fair
  bit of confused debugging before the actual root cause — an expired/never-
  shared session, not a config bug — was spotted).
- Verified working (pre-migration): loaded
  `https://imademybones.github.io/music-tracker/` logged-in-in-the-same-window
  and the real collection (74 releases) loaded correctly through the gate.
  Needs re-verification post custom-domain-move (see below).

### Custom domain move (2026-07-20)

Front end and Worker were originally on unrelated registrable domains
(`imademybones.github.io` and `stephen-nolan85.workers.dev`). Because the
Access session cookie (`CF_Authorization`) is set on the Worker's domain,
every Worker fetch from the front end was a **cross-site** credentialed
request from the browser's point of view — third-party cookie blocking
(Safari's cross-site tracking prevention, Chrome's third-party cookie
blocking, ad-blocker/privacy extensions, and some corporate browser
policies) silently drops the cookie on that request. The result looks like a
normal network failure client-side (no `Cookie` header sent, Access replies
403 with no CORS headers since the request never reached the Worker's own
`corsHeaders()` logic, browser reports a CORS error) — easy to mistake for
"the app/backend is down."

Fix: bought `foundfrequency.com` and put both sides on subdomains of it —
front end at the apex (`foundfrequency.com`, via GitHub Pages custom domain +
`CNAME` file in this repo) and Worker at `api.foundfrequency.com` (via
Workers & Pages → Custom Domains). Same registrable domain means the cookie
is now same-site, not third-party, so it's sent regardless of cross-site
cookie blocking. Changes required: DNS A records for the apex → GitHub
Pages IPs (initially DNS-only/grey-cloud so GitHub could issue its TLS
cert), Worker custom domain `api.foundfrequency.com`, Access application
Destination updated to `api` / `foundfrequency.com`, Worker's
`Access-Control-Allow-Origin` updated to `https://foundfrequency.com`, and
`WORKER_URL` in `index.html` updated to match.

## Deploy

`index.html` is deployed via GitHub Pages from this repo
(`imademybones/music-tracker`), served at the custom domain
`foundfrequency.com` (see `CNAME` file at repo root, added 2026-07-20). The
Worker script is deployed separately by pasting into the Cloudflare
dashboard — it is never generated from or checked into this repo.

## Changelog

Per-version feature notes live as `vN:` comments in `index.html` itself (see
CLAUDE.md) — this section only tracks changes that touch infra outside the
repo (Airtable schema, Worker routes/env vars).

- **v10** — Release-week Friday box now holds the current release week
  (Friday through the following Thursday) instead of jumping forward the
  moment Friday ends; relabeled "Out This Friday" → "New releases: Friday
  &lt;date&gt;". Manual artwork override: pencil icon on the hero and detail-modal
  cover art, "🖼 Artwork" item in the card overflow menu, file upload or URL
  paste, "Remove override" to revert to the iTunes auto-lookup. Required a new
  `Cover Override` attachment field in Airtable and a new Worker route
  (`/upload-attachment`) + `COVER_OVERRIDE_FIELD_ID` env var, both added above.
