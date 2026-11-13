import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeToIso,
  parseReleaseDate,
  formatReleaseDateDisplay,
  releaseStatus,
  coverKey,
  spotifyDateToIso,
  formatFromSpotifyAlbumType,
  monthlyAddedCounts,
  spotifyAlbumIdFromUrl,
  matchKey,
  pickBestAlbum,
  pickTrackUris,
  chunkArray,
} from './pure.js';

test('normalizeToIso: already-ISO date passes through', () => {
  assert.equal(normalizeToIso('2024-03-15'), '2024-03-15');
});

test('normalizeToIso: legacy dd/mm/yyyy converts to ISO', () => {
  assert.equal(normalizeToIso('15/03/2024'), '2024-03-15');
});

test('normalizeToIso: legacy bare year converts to Jan 1st ISO', () => {
  assert.equal(normalizeToIso('2024'), '2024-01-01');
});

test('normalizeToIso: garbage input returns empty string', () => {
  assert.equal(normalizeToIso('not a date'), '');
  assert.equal(normalizeToIso(''), '');
  assert.equal(normalizeToIso(null), '');
});

test('parseReleaseDate: valid ISO date parses correctly', () => {
  const d = parseReleaseDate('2024-03-15');
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 15);
});

test('parseReleaseDate: garbage input returns null', () => {
  assert.equal(parseReleaseDate('not a date'), null);
  assert.equal(parseReleaseDate(''), null);
});

test('formatReleaseDateDisplay: formats as dd/mm/yyyy', () => {
  assert.equal(formatReleaseDateDisplay('2024-03-05'), '05/03/2024');
});

test('formatReleaseDateDisplay: unparseable input passed through as-is', () => {
  assert.equal(formatReleaseDateDisplay('garbage'), 'garbage');
  assert.equal(formatReleaseDateDisplay(''), '');
});

test('releaseStatus: listened always wins regardless of date', () => {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const futureIso = future.toISOString().slice(0, 10);
  assert.equal(releaseStatus({ listened: true, year: futureIso }), 'listened');
});

test('releaseStatus: future release date is upcoming', () => {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const futureIso = future.toISOString().slice(0, 10);
  assert.equal(releaseStatus({ listened: false, year: futureIso }), 'upcoming');
});

test('releaseStatus: past release date, not listened, is unlistened', () => {
  assert.equal(releaseStatus({ listened: false, year: '2020-01-01' }), 'unlistened');
});

test('releaseStatus: today boundary is not upcoming', () => {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  assert.equal(releaseStatus({ listened: false, year: todayIso }), 'unlistened');
});

test('coverKey: joins lowercased, trimmed artist/title', () => {
  assert.equal(coverKey(' Radiohead ', ' OK Computer '), 'radiohead|||ok computer');
});

test('coverKey: handles missing artist or title', () => {
  assert.equal(coverKey('', 'Title'), '|||title');
  assert.equal(coverKey('Artist', ''), 'artist|||');
});

test('spotifyDateToIso: full precision passes through', () => {
  assert.equal(spotifyDateToIso('2024-03-15'), '2024-03-15');
});

test('spotifyDateToIso: month precision pads day', () => {
  assert.equal(spotifyDateToIso('2024-03'), '2024-03-01');
});

test('spotifyDateToIso: year precision pads month and day', () => {
  assert.equal(spotifyDateToIso('2024'), '2024-01-01');
});

test('spotifyDateToIso: empty input returns empty string', () => {
  assert.equal(spotifyDateToIso(''), '');
});

test('formatFromSpotifyAlbumType: single with one track stays Single', () => {
  assert.equal(formatFromSpotifyAlbumType('single', 1), 'Single');
});

test('formatFromSpotifyAlbumType: single with multiple tracks becomes EP', () => {
  assert.equal(formatFromSpotifyAlbumType('single', 4), 'EP');
});

test('formatFromSpotifyAlbumType: compilation and album map directly', () => {
  assert.equal(formatFromSpotifyAlbumType('compilation', 12), 'Compilation');
  assert.equal(formatFromSpotifyAlbumType('album', 10), 'LP');
});

test('formatFromSpotifyAlbumType: unknown type returns empty string', () => {
  assert.equal(formatFromSpotifyAlbumType('unknown', 1), '');
});

test('monthlyAddedCounts: buckets by month, zero-filled, oldest first', () => {
  const now = new Date(2024, 5, 15); // 15 June 2024
  const releases = [
    { addedAt: new Date(2024, 5, 1).getTime() },  // June 2024
    { addedAt: new Date(2024, 5, 20).getTime() }, // June 2024
    { addedAt: new Date(2024, 4, 10).getTime() }, // May 2024
    { addedAt: new Date(2024, 2, 1).getTime() },  // March 2024 (outside a 3-month window)
  ];
  const buckets = monthlyAddedCounts(releases, 3, now);
  assert.equal(buckets.length, 3);
  assert.deepEqual(buckets.map(b => b.key), ['2024-04', '2024-05', '2024-06']);
  assert.deepEqual(buckets.map(b => b.count), [0, 1, 2]);
});

test('monthlyAddedCounts: releases with no addedAt are skipped, not thrown on', () => {
  const now = new Date(2024, 5, 15);
  const releases = [{ addedAt: null }, { addedAt: new Date(2024, 5, 1).getTime() }];
  const buckets = monthlyAddedCounts(releases, 1, now);
  assert.equal(buckets[0].count, 1);
});

// ---- v22: "Add to playlist" helpers ----

test('spotifyAlbumIdFromUrl: album links and URIs', () => {
  const id = '4aawyAB9vmqN3uQ7FjRGTy';
  assert.equal(spotifyAlbumIdFromUrl(`https://open.spotify.com/album/${id}`), id);
  assert.equal(spotifyAlbumIdFromUrl(`https://open.spotify.com/album/${id}?si=abc`), id);
  assert.equal(spotifyAlbumIdFromUrl(`https://open.spotify.com/intl-de/album/${id}`), id);
  assert.equal(spotifyAlbumIdFromUrl(`spotify:album:${id}`), id);
});

test('spotifyAlbumIdFromUrl: non-album links and blanks return empty', () => {
  assert.equal(spotifyAlbumIdFromUrl(''), '');
  assert.equal(spotifyAlbumIdFromUrl(null), '');
  assert.equal(spotifyAlbumIdFromUrl('https://open.spotify.com/search/converge'), '');
  assert.equal(spotifyAlbumIdFromUrl('https://open.spotify.com/track/4aawyAB9vmqN3uQ7FjRGTy'), '');
});

test('matchKey: ignores case, accents and punctuation', () => {
  assert.equal(matchKey('  Caminhos de Água '), 'caminhos de agua');
  assert.equal(matchKey('With Love // With Rage'), 'with love with rage');
  assert.equal(matchKey('DOMi & JD BECK'), 'domi and jd beck');
});

test('pickBestAlbum: needs an exact title and a matching artist', () => {
  const items = [
    { id: 'a', name: 'Nine (Deluxe)', artists: [{ name: 'Russian Circles' }] },
    { id: 'b', name: 'Nine', artists: [{ name: 'Someone Else' }] },
    { id: 'c', name: 'NINE', artists: [{ name: 'Russian Circles' }] },
  ];
  assert.equal(pickBestAlbum('Russian Circles', 'Nine', items).id, 'c');
  assert.equal(pickBestAlbum('Russian Circles', 'Ten', items), null);
  assert.equal(pickBestAlbum('', 'Nine', items), null);
  assert.equal(pickBestAlbum('Russian Circles', 'Nine', null), null);
});

test('pickBestAlbum: any one of several credited artists is enough', () => {
  const items = [{ id: 'x', name: 'Revector', artists: [{ name: 'zakè' }] }];
  assert.equal(pickBestAlbum('zakè, Ossa & ASC', 'Revector', items).id, 'x');
});

test('pickTrackUris: all, first, first3', () => {
  const uris = ['t1', 't2', null, 't3', 't4'];
  assert.deepEqual(pickTrackUris(uris, 'all'), ['t1', 't2', 't3', 't4']);
  assert.deepEqual(pickTrackUris(uris, 'first'), ['t1']);
  assert.deepEqual(pickTrackUris(uris, 'first3'), ['t1', 't2', 't3']);
  assert.deepEqual(pickTrackUris(null, 'all'), []);
});

test('chunkArray: splits into fixed-size chunks', () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunkArray([], 100), []);
});
