import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base91, noteGuid, deckId, modelId, noteId, cardId, fieldChecksum } from '../src/deck/ids.js';

// Reference values from an independent implementation: Python hashlib plus base91() copied from
// anki/utils.py. If one of these changes, every user's notes would become new notes.

test('base91 matches Anki', () => {
  assert.equal(base91(0n), '');
  assert.equal(base91(1n), 'b');
  assert.equal(base91(90n), '~');
  assert.equal(base91(91n), 'ba');
  assert.equal(base91(2n ** 64n - 1n), 'Rj&Z5m[>Zp');
});

test('note GUIDs are stable', async () => {
  assert.equal(await noteGuid('ru', 'en', 'word-hand'), 'Lr.4[2YqAo');
  assert.equal(await noteGuid('en', 'ru', 'word-brother-older'), 'k`[kty-L}S');
  assert.equal(await noteGuid('ja', 'de', 'word-residence-record-jp'), 'C*H=g)o.{a');
  assert.equal(await noteGuid('ja', '=', 'word-water'), 'cc)G8rR{Oo');
});

test('GUIDs depend on the language pair and the key', async () => {
  const guids = new Set([
    await noteGuid('ru', 'en', 'word-hand'),
    await noteGuid('en', 'ru', 'word-hand'),
    await noteGuid('ru', '=', 'word-hand'),
    await noteGuid('ru', 'en', 'word-arm'),
  ]);
  assert.equal(guids.size, 4);
});

test('deck and note type IDs are stable 53-bit integers', async () => {
  assert.equal(await deckId('ja', 'ru'), 3355082269022541);
  assert.equal(await modelId('ja', 'ru'), 3745503778540576);
  assert.equal(await deckId('ja', '='), 1102383711317535);
  for (const id of [await deckId('en', 'sr'), await modelId('el', 'hy')]) {
    assert.ok(Number.isSafeInteger(id) && id >= 1e12 && id < 2 ** 53);
  }
});

test('note and card IDs count from the export clock', () => {
  const t = 1_792_246_910_826;
  assert.equal(noteId(t, 0), t);
  assert.equal(noteId(t, 41), t + 41);
  assert.equal(cardId(t, 0, 0), t);
  assert.equal(cardId(t, 0, 1), t + 1);
  assert.equal(cardId(t, 0, 4), t + 4);
  assert.equal(cardId(t, 41, 0), t + 205);
  assert.equal(cardId(t, 41, 1), t + 206);
  const cards = new Set();
  for (let i = 0; i < 1000; i++) for (const ord of [0, 1, 2, 3, 4]) cards.add(cardId(t, i, ord));
  assert.equal(cards.size, 5000);
});

test('field checksum matches Anki', async () => {
  assert.equal(await fieldChecksum('hand'), 2518786628);
  assert.equal(await fieldChecksum('рука́'), 3442735435);
  assert.equal(await fieldChecksum('水'), 2415653266);
  assert.equal(await fieldChecksum(''), 3661210606);
});
