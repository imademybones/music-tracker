// Pure, DOM-free helpers shared by index.html and lib/pure.test.js.
// Extracted so the trickiest date/status parsing has automated coverage —
// see the repo's CLAUDE.md for why these particular functions are pure.

// Release Date is saved as ISO (YYYY-MM-DD) going forward, but older
// records may still hold the legacy dd/mm/yyyy or bare-year strings that
// earlier versions' text field and Spotify autofill used to write.
export function normalizeToIso(dateStr){
  if(!dateStr) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const dm = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(dm) return `${dm[3]}-${dm[2]}-${dm[1]}`;
  const ym = dateStr.match(/^(\d{4})$/);
  if(ym) return `${ym[1]}-01-01`;
  return '';
}

export function parseReleaseDate(dateStr){
  const iso = normalizeToIso(dateStr);
  if(!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if(!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatReleaseDateDisplay(dateStr){
  const d = parseReleaseDate(dateStr);
  if(!d) return dateStr || '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

// Status: listened always wins; otherwise upcoming vs already-released
// is decided by comparing the parsed Release Date to today.
export function releaseStatus(r){
  if(r.listened) return 'listened';
  const d = parseReleaseDate(r.year);
  if(d){
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if(d.getTime() > today.getTime()) return 'upcoming';
  }
  return 'unlistened';
}

export function coverKey(artist, title){
  return (artist || '').trim().toLowerCase() + '|||' + (title || '').trim().toLowerCase();
}

// Converts Spotify's release_date (which may be a bare year, YYYY-MM, or
// full YYYY-MM-DD depending on precision) into an ISO YYYY-MM-DD the
// native date input can accept, approximating month/day as 01 when
// Spotify's precision is coarser than a full date.
export function spotifyDateToIso(releaseDate){
  if(!releaseDate) return '';
  const parts = releaseDate.split('-');
  if(parts.length === 3) return releaseDate;
  if(parts.length === 2) return `${releaseDate}-01`;
  if(parts.length === 1) return `${releaseDate}-01-01`;
  return '';
}

export function formatFromSpotifyAlbumType(albumType, totalTracks){
  if(albumType === 'single') return (totalTracks && totalTracks > 1) ? 'EP' : 'Single';
  if(albumType === 'compilation') return 'Compilation';
  if(albumType === 'album') return 'LP';
  return '';
}

// v17: buckets releases by the month of their `addedAt` (epoch ms — see
// recordToRelease in index.html), for the Stats "Logged per Month" chart.
// Returns a fixed trailing window of `monthsBack` months, oldest first,
// zero-filled for months with no additions. `now` defaults to the current
// date but is accepted as a parameter so this stays pure/testable.
export function monthlyAddedCounts(releases, monthsBack = 12, now = new Date()){
  const buckets = [];
  for(let i = monthsBack - 1; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }
  const byKey = new Map(buckets.map(b => [b.key, b]));
  releases.forEach(r => {
    if(!r.addedAt) return;
    const d = new Date(r.addedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const b = byKey.get(key);
    if(b) b.count++;
  });
  return buckets;
}

// ---- v22: "Add to playlist" helpers ----

// Pulls the album id out of a saved "Spotify URL" (open.spotify.com/album/…,
// with or without an intl-xx prefix or ?si= query) or a spotify:album: URI.
// Returns '' for anything else — search links, track/artist links, blanks.
export function spotifyAlbumIdFromUrl(url){
  if(!url) return '';
  const m = String(url).match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/|spotify:album:)([A-Za-z0-9]{22})/);
  return m ? m[1] : '';
}

// Lowercase, diacritic-free, punctuation-free comparison key, so
// "NØ MAN" / "No Man" style differences in casing and punctuation don't
// defeat an otherwise exact artist/title match.
export function matchKey(str){
  return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Picks the Spotify search result that is actually this release: the title
// must match exactly (after matchKey) and at least one credited artist must
// match one of the release's comma/&-separated artists. Deliberately strict —
// a release that can't be matched is reported as skipped rather than risking
// the wrong album landing in the playlist. Returns the album object or null.
export function pickBestAlbum(artist, title, items){
  const wantTitle = matchKey(title);
  const wantArtists = String(artist || '').split(/,|&|\band\b/i).map(matchKey).filter(Boolean);
  if(!wantTitle || !wantArtists.length || !Array.isArray(items)) return null;
  return items.find(a => {
    if(!a || matchKey(a.name) !== wantTitle) return false;
    const have = (a.artists || []).map(x => matchKey(x.name));
    return have.some(h => wantArtists.includes(h));
  }) || null;
}

// Which of an album's track URIs go into the playlist: 'all', 'first'
// (opening track only) or 'first3'.
export function pickTrackUris(uris, mode){
  const list = (uris || []).filter(Boolean);
  if(mode === 'first') return list.slice(0, 1);
  if(mode === 'first3') return list.slice(0, 3);
  return list;
}

export function chunkArray(arr, size){
  const out = [];
  for(let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
