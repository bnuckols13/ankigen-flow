// The card list: row text and search (SPEC §4: case, diacritics and stress don't matter, Serbian matches in
// both scripts, Japanese by kana and romanization), on the fixture decks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckContext, noteSummary } from '../src/deck/fields.js';
import { createSearch } from '../src/deck/search.js';
import { selectNotes } from '../src/deck/select.js';
import { fixtureInput } from './helpers/fixtures.mjs';

/** The deck's notes, its context, and a search over them. @param {Record<string, any>} partial */
async function deck(partial) {
  const input = await fixtureInput(partial);
  const notes = selectNotes(input.config, input.meta, input.concepts, input.learnData, input.knowData);
  const ctx = deckContext(input);
  const search = createSearch(notes, ctx);
  /** @param {string} query */
  const find = (query) => search.filter(query).map((n) => n.key);
  return { notes, ctx, find };
}

test('rows show the word as the card does and the translation', async () => {
  const ru = await deck({ learn: 'ru', know: 'en' });
  const summary = (/** @type {string} */ key) => noteSummary(/** @type {any} */ (ru.notes.find((n) => n.key === key)), ru.ctx);
  assert.deepEqual(summary('word-hand'), { word: 'рука́ f.', disambig: '', translation: 'hand; arm' }); // the gender mark is in the known language
  assert.equal(summary('word-day-24h').translation, 'a full day of 24 hours, day and night together');

  const en = await deck({ learn: 'en', know: 'ru' });
  const brother = noteSummary(/** @type {any} */ (en.notes.find((n) => n.key === 'word-brother-older')), en.ctx);
  assert.equal(brother.translation, 'брат (старший) · старший брат; брат (младший) · младший брат'); // one English note for both

  const de = await deck({ learn: 'de', know: 'en' });
  assert.equal(noteSummary(de.notes[0], de.ctx).word, 'das Wasser');
});

test('search folds case, accents and stress, and finds Russian by romanization', async () => {
  const { find } = await deck({ learn: 'ru', know: 'en' });
  for (const q of ['рука', 'РУКА́', 'ruka', 'Ruká', 'arm', 'HAND']) assert.deepEqual(find(q), ['word-hand'], q);
  assert.deepEqual(find(''), find('  '), 'a blank query keeps the whole deck');
  assert.equal(find('').length, 12);
  assert.deepEqual(find('xyz'), []);
});

test('better matches come first: a whole part, then a word start, then anywhere', async () => {
  const { find } = await deck({ learn: 'ru', know: 'en' });
  // "a full day of 24 hours" starts a word with "day"; Monday and Tuesday only contain it. Deck order is the other way round.
  assert.deepEqual(find('day'), ['word-day-24h', 'word-monday', 'word-tuesday']);
  assert.deepEqual(find('вторник'), ['word-tuesday']);
});

test('Serbian matches in both scripts, on either side', async () => {
  const latin = await deck({ learn: 'sr', know: 'en', srScript: 'latn' });
  for (const q of ['вода', 'voda', 'VODA']) assert.deepEqual(latin.find(q), ['word-water'], q);
  const cyrillic = await deck({ learn: 'sr', know: 'en' });
  assert.deepEqual(cyrillic.find('voda'), ['word-water']);
  const known = await deck({ learn: 'en', know: 'sr' });
  for (const q of ['вода', 'voda']) assert.deepEqual(known.find(q), ['word-water'], q);
});

test('Japanese is found by kanji, kana in either script, and romaji with or without macrons', async () => {
  const { find } = await deck({ learn: 'ja', know: 'de' });
  for (const q of ['住民票', 'じゅうみんひょう', 'ジュウミンヒョウ', 'jūminhyō', 'juminhyo', 'juuminhyou', 'jumin']) {
    assert.deepEqual(find(q), ['word-residence-record-jp'], q);
  }
  assert.deepEqual(find('mizu'), ['word-water']);
  assert.deepEqual(find('wasser'), ['word-water'], 'and by the German translation');
});

test('same-language decks are found by word and by definition', async () => {
  const { find } = await deck({ learn: 'en', know: '=' });
  assert.deepEqual(find('water'), ['word-water']);
  assert.deepEqual(find('five fingers'), ['word-hand']);
  assert.deepEqual(find('arm'), ['word-arm', 'word-hand'], 'the word first, then a definition that mentions it');
});
