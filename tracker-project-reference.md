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
