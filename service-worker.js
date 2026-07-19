// Music Tracker — offline app shell
// Caches only same-origin shell assets so the app is installable and opens
// even with no network at all. Airtable/Spotify/iTunes requests are never
// cached and always go straight to the network.

// v17: bumped from v1 — the old cache could keep serving a stale lib/pure.js
// (missing the new monthlyAddedCounts export) alongside a fresh index.html
// that imports it, which throws a fatal module-load error and blanks the
// whole page. Bumping the name forces activate() below to purge the old
// cache instead of the cache-first fetch handler serving mismatched files.
const CACHE_NAME = 'music-tracker-shell-v2';
const SHELL_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-16.png',
  'icon-32.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for the shell itself.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // v17: network-first (was cache-first-with-background-update). Cache-first
  // could serve a stale file (e.g. lib/pure.js) alongside a freshly-fetched
  // sibling (e.g. index.html) that imports something the stale file doesn't
  // export yet — the module graph breaks and the whole app blanks out (see
  // the CACHE_NAME bump above). Trying the network first means anyone
  // online always gets the current, mutually-consistent set of files; the
  // cache is now purely an offline fallback, not a source of truth.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
