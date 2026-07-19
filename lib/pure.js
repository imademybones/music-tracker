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
