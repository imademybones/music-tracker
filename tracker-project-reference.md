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

Not yet set up. Puts a login gate (Google, GitHub, or email one-time-code) in
front of the whole zone — Pages and Worker both — entirely via dashboard
config, with **zero changes to `index.html` or the Worker code**. This is the
one access-control layer worth trusting; the CORS Origin check above is not.

Setup steps (do before sharing the live URL beyond solo use):

1. In the Cloudflare dashboard, go to **Zero Trust** → **Access** → **Applications**
   (first visit prompts you to pick a team name — any name is fine, it's just
   a URL slug for the login page).
2. **Add an application** → **Self-hosted**.
3. Application domain: the GitHub Pages domain, `imademybones.github.io`
   (path `/music-tracker/*` if you want to scope it to just this app rather
   than the whole Pages account).
4. Add a second self-hosted application for the Worker's domain,
   `music-tracker.stephen-nolan85.workers.dev`, so both the static site and
   the API proxy are gated — a login on the Pages site alone wouldn't stop
   someone hitting the Worker URL directly.
5. **Policies**: add an Allow policy with **Include** → **Emails** → your own
   email (and anyone else's you want to trust). This is the actual
   access-control list.
6. **Identity providers**: Google, GitHub, or "One-time PIN" (email code, no
   third-party login needed) — pick whichever is least friction for who
   you're sharing with.
7. Save. Visiting either domain now redirects to a Cloudflare-hosted login
   page first; only allowed identities get through to the app / Worker.

No code or CORS changes needed — this sits in front of both origins at the
network edge. Update this doc once it's actually configured (date + which
IdP chosen).

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
