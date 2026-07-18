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
