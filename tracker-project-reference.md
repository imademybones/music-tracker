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

Deployed at `https://music-tracker.stephen-nolan85.workers.dev`
(file `music-tracker-worker-v2.js`), pasted directly into the Cloudflare
dashboard — not part of this repo/deploy.

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

CORS is restricted to `Access-Control-Allow-Origin: https://imademybones.github.io`.
This Origin check is spoofable outside a browser — see Cloudflare Access below
for the real access-control layer.

## Cloudflare Access (go-live gate)

**Status: in progress, 2026-07-19.** Worker-only scope chosen — the static
page on GitHub Pages can't be gated by Access (Access only intercepts traffic
through domains Cloudflare's edge actually proxies; `imademybones.github.io`
never touches Cloudflare, so it wasn't even selectable as an Application
domain). The page shell stays publicly loadable; the Worker — the part that
actually touches Airtable — is the one gated. Turned out **not** to be a
zero-code-change layer as originally scoped; see below.

Setup so far:

1. Zero Trust → Access → Applications → team name `falling-disk-d589`.
2. Self-hosted application "music-tracker", Destination: Subdomain
   `music-tracker`, Domain `stephen-nolan85.workers.dev`, no path (covers the
   whole Worker — `/spotify`, `/upload-attachment`, everything).
3. Policy "My email": Allow, Include → Emails → `stephen.nolan85@gmail.com`.
4. Identity provider: only "Sign in with Cloudflare" is enabled by default
   (not "One-time PIN" as originally assumed) — fine for solo use since
   that's already Stephen's account, but anyone else added to the policy
   would need their own Cloudflare account too. Add "One-time PIN" under
   **Settings → Authentication** first if sharing beyond that.
5. Verified: a direct browser visit to
   `https://music-tracker.stephen-nolan85.workers.dev` now shows the
   Cloudflare Access login page before anything else.

**Still needed before this actually works end-to-end:**

- **Worker CORS headers** — add `'Access-Control-Allow-Credentials': 'true'`
  alongside the existing `Access-Control-Allow-Origin:
  https://imademybones.github.io` on every response (including the `OPTIONS`
  preflight response). Required because the client now sends
  `credentials: 'include'` (see below) — without this header, the browser
  discards the cross-origin cookie regardless.
- **Client fetch changes** — done in `index.html` v16 (commit `b568b8a`):
  all four Worker-bound `fetch()` calls (`airtableRequest`, artwork upload,
  Spotify search, Spotify artist lookup) now send `credentials: 'include'`,
  so the browser attaches the `CF_Authorization` cookie Access sets after
  login. The iTunes cover-art fetch is untouched — it isn't behind the
  Worker/Access.
- **Not yet verified: CORS preflight vs. Access.** `airtableRequest` sends
  `Content-Type: application/json`, which triggers a browser preflight
  (`OPTIONS`) before most requests. Preflight requests never carry cookies,
  so if Access gates *all* methods on the Worker, the preflight itself could
  get redirected to the login page instead of answered by the Worker,
  breaking the real request before it's even sent. If this happens after the
  CORS header fix above, the likely solution is an Access policy scoped to
  `OPTIONS` on this application with a **Bypass** action, so preflight
  reaches the Worker directly while every other method still requires login.
- End-to-end test once both pieces above are in place: load the live app at
  `https://imademybones.github.io/music-tracker/` (already logged into
  Access from the direct-Worker-visit test above) and confirm releases
  actually load, rather than "could not load your collection."

This sits in front of the Worker origin at the network edge — no Worker
*route* changes needed, but see the CORS/credentials caveats above. Update
this section once the remaining pieces are confirmed working end-to-end.

## Deploy

`index.html` is deployed via GitHub Pages from this repo
(`imademybones/music-tracker`). The Worker script is deployed separately by
pasting into the Cloudflare dashboard — it is never generated from or checked
into this repo.

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
