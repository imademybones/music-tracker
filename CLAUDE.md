# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal music release tracker: `index.html` (markup + inline JS module) plus `styles.css`, with pure helper logic factored out to `lib/pure.js`. No build step, no package manager, no framework. It's served as a static file (e.g. GitHub Pages) directly from `index.html`.

## Development

There is no build/lint tooling in this repo, but `lib/pure.js` has a `node:test` suite (`lib/pure.test.js`) covering date/status/Spotify-parsing helpers, run via `node --test lib/pure.test.js`. A GitHub Actions workflow (`.github/workflows/test.yml`) runs it on every push/PR to `main` — non-blocking (no branch protection), so it surfaces regressions as a status check rather than gating the deploy. To work on it:

- Open `index.html` directly in a browser, or serve it locally (`python3 -m http.server` from the repo root) and visit it — either works since there's no build step.
- Markup lives in `index.html`'s `<body>`, logic in its `<script type="module">` block, styles in `styles.css`, pure/testable logic in `lib/pure.js`.
- Verify changes by exercising the UI in a browser (add/edit/delete a release, search Spotify, toggle listened, check Stats tab) — there's no UI test automation, only the pure-function suite above.
- Deploy is a direct push to `main` (GitHub Pages redeploys automatically); there's no branch protection or staging environment. Rollback is an ordinary `git revert` (or GitHub's "Revert this commit" button) — Pages redeploys the reverted `index.html` within about a minute.

## Versioning convention

Past iterations were built as `music-tracker-vN.html` and only renamed to `index.html` once ready to go live (see git history: v2, v4, v5, v6, v7...). Several in-code comments still reference version numbers (e.g. `/* ---- v7: hybrid grid + detail modal ---- */`) marking when a feature was introduced — this is the project's changelog-in-comments style. Follow it: when adding a notable feature, tag the relevant CSS/JS blocks with a `vN:` comment rather than writing a separate changelog.

## Architecture

**No frontend framework.** State lives in a handful of module-level JS variables (`releases`, `formRating`, `editingId`, `openModalId`, `openOverflowId`, `coverCache`, etc.), and the UI is re-rendered by wholesale `innerHTML` replacement into a few slot elements (`#releaseList`, `#modalSlot`, `#heroSlot`, `#fridaySlot`, `#headerStats`, `#statsGrid`/`#statsExtra`). Any mutation to `releases` is followed by explicit calls to the relevant `render*()` functions — there's no reactivity, so if you add a new piece of state that affects the UI, remember to call the render functions yourself.

**Data persistence is remote, via a Cloudflare Worker proxy — not in this repo.** `index.html` talks to `WORKER_URL` (`const WORKER_URL` near the top of the script), which proxies:
- Airtable (the actual release database) — the Worker holds the Airtable token as a secret; the client never sees it.
- Spotify Web API search (`/spotify` path, Client Credentials flow, app-only) — used for autofill when adding a release.

The Worker's source (`music-tracker-worker.js`) is deployed separately and is not part of this repository. When making changes that require new Airtable fields or new Spotify endpoints, the Worker will need corresponding updates outside this repo.

Album cover art is fetched client-side directly from the iTunes Search API (`itunes.apple.com/search`), independent of the Worker, and cached in-memory in `coverCache` keyed by lowercase `"artist|||title"`.

**Data model.** A `release` object (see `recordToRelease`/`releaseToFields`) has: `id`, `artist`, `title`, `genre`, `year` (actually an ISO release date string, legacy name), `format`, `rating` (0–5), `notes`, `listened`, `revisits`, `addedAt`, `updatedAt`, `spotifyAdded`. These map 1:1 to Airtable field names (`Artist`, `Title`, `Genre`, `Release Date`, `Format`, `Rating`, `Notes`, `Listened`, `Revisits`, `Added At`, `Updated At`, `Spotify Added`).

**Release Date handling is defensive about legacy formats.** New entries are stored as ISO `YYYY-MM-DD` (native `<input type="date">`), but older records may hold legacy `dd/mm/yyyy` or bare-year strings from earlier versions. `normalizeToIso` / `parseReleaseDate` / `formatReleaseDateDisplay` all handle both — don't assume `r.year` is already ISO when reading it.

**Status derivation is computed, not stored:** `releaseStatus(r)` returns `listened` / `upcoming` / `unlistened` based on the `listened` flag and whether the parsed release date is in the future. This drives border colors, badges, and the "Out This Friday" and hero-card sections — don't add a separate stored status field.

**UI patterns to reuse, not reinvent:**
- Destructive actions use an inline two-click confirm (click once to arm, click again within a timeout to commit) — see `requestDeleteRelease`/`pendingRemoveId` and the duplicate-add confirm in `saveRelease`/`pendingDuplicateKey`. A custom `showConfirmDialog()` promise-based dialog exists only for the bulk-import flow, which has no persistent button to attach a two-click confirm to.
- The release detail modal (`renderModal`) renders the full card markup (`renderCardMarkup`); the grid tiles in `renderList` are a stripped-down summary that opens the modal on click. Actions (edit/delete/mark listened/revisit) only exist inside the modal, not on tiles.
- `esc()` must wrap any user-provided string interpolated into `innerHTML` (artist, title, genre, notes, etc.) to avoid XSS — every render path already does this; keep doing it for new fields.

**Import/export** round-trips the full `releases` array as JSON (client-side download / file picker), independent of the Airtable Worker's own storage — export is a backup mechanism, not a sync mechanism. Airtable caps writes at 10 records per request, so `importData` batches in chunks of 10.
