import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectNotes, moduleCounts, learnedInventory } from '../src/deck/select.js';
import { noteGuid } from '../src/deck/ids.js';
import { stripHtml } from '../src/text/html.js';
import { validate } from '../src/state.js';
import { fixtureInput, fixtureDeck } from './helpers/fixtures.mjs';

/** @param {Awaited<ReturnType<typeof fixtureDeck>>} deck @param {string} id */
const noteWith = (deck, id) => deck.notes.find((n) => n.conceptIds.includes(id));

test('learning ru / known en: рука́ is one note "hand; arm", keyed by word-hand', async () => {
  const deck = await fixtureDeck({ learn: 'ru', know: 'en' });
  const hand = noteWith(deck, 'word-hand');
  assert.ok(hand);
  assert.deepEqual(hand.conceptIds, ['word-hand', 'word-arm']);
  assert.equal(hand.key, 'word-hand');
  assert.equal(noteWith(deck, 'word-arm'), hand);
  assert.equal(stripHtml(hand.fields.Translation), 'hand; arm');
  assert.equal(await noteGuid('ru', 'en', hand.key), 'wV3#_8fELM');
});

test('a merged note keeps its key when the first member is not in the deck', async () => {
  const input = await fixtureInput({ learn: 'ru', know: 'en' });
  const knowData = { ...input.knowData, lang: new Map(input.knowData.lang) };
  knowData.lang.delete('word-hand'); // word-hand drops out; word-arm still qualifies
  const notes = selectNotes(input.config, input.meta, input.concepts, input.learnData, knowData);
  const arm = notes.find((n) => n.conceptIds.includes('word-arm'));
  assert.deepEqual(arm?.conceptIds, ['word-arm']);
  assert.equal(arm?.key, 'word-hand');
});

test('learning en / known ru shows "брат (старший)"', async () => {
  const deck = await fixtureDeck({ learn: 'en', know: 'ru' });
  const brother = noteWith(deck, 'word-brother-older');
  assert.ok(brother);
  assert.deepEqual(brother.conceptIds, ['word-brother-older', 'word-brother-younger'], 'English "brother" is one word');
  assert.match(stripHtml(brother.fields.Translation), /^брат \(старший\) · старший брат; брат \(младший\) · младший брат$/);
});

test('learning ja / known en keeps 兄 and 弟 apart, with the English hints', async () => {
  const deck = await fixtureDeck({ learn: 'ja', know: 'en' });
  assert.equal(stripHtml(noteWith(deck, 'word-brother-older')?.fields.Translation ?? ''), 'brother (older) · big brother');
  assert.equal(stripHtml(noteWith(deck, 'word-brother-younger')?.fields.Translation ?? ''), 'brother (younger) · little brother');
});

test('learning ja / known de shows 住民票 with the German gloss', async () => {
  const deck = await fixtureDeck({ learn: 'ja', know: 'de' });
  const note = noteWith(deck, 'word-residence-record-jp');
  assert.ok(note);
  assert.equal(note.fields.Word, '住民票');
  assert.equal(note.fields.Translation, '<i class="gl">Jūminhyō: japanische Meldebescheinigung über den Wohnsitz</i>');
  assert.equal(noteWith(await fixtureDeck({ learn: 'de', know: 'ja' }), 'word-residence-record-jp'), undefined, 'only Japanese owns it');
});

test('word-day-24h appears only when learning Russian', async () => {
  for (const [learn, know, expected] of [['ru', 'en', true], ['ru', 'de', true], ['ru', '=', true], ['en', 'ru', false], ['de', 'ru', false], ['ja', 'ru', false], ['sr', 'ru', false]]) {
    const deck = await fixtureDeck({ learn, know });
    assert.equal(Boolean(noteWith(deck, 'word-day-24h')), expected, `${learn}/${know}`);
  }
  const ru = await fixtureDeck({ learn: 'ru', know: 'en' });
  assert.equal(noteWith(ru, 'word-day-24h')?.fields.Translation, '<i class="gl">a full day of 24 hours, day and night together</i>');
});

test('notes follow canonical order; only selected modules count', async () => {
  const all = await fixtureDeck({ learn: 'de', know: 'en' });
  const order = all.concepts.order;
  const ranks = all.notes.map((n) => order.indexOf(n.conceptIds[0]));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  const time = await fixtureDeck({ learn: 'de', know: 'en', modules: ['time'] });
  assert.deepEqual(time.notes.map((n) => n.conceptIds.join('+')), ['word-monday', 'word-tuesday']);
  assert.deepEqual(time.notes[0].modules, ['time'], 'tags only for selected modules');
  assert.deepEqual(all.notes[0].modules, ['core-1', 'food']);
});

test('same-language mode needs a word and a definition; merged definitions are numbered', async () => {
  const deck = await fixtureDeck({ learn: 'ru', know: '=' });
  const hand = noteWith(deck, 'word-hand');
  assert.equal(stripHtml(hand?.fields.Translation ?? ''), '1. Кисть: часть тела от запястья до кончиков пальцев.2. Верхняя конечность человека от плеча до кисти.');
  assert.match(hand?.fields.Translation ?? '', /<br>/);
  assert.ok(!noteWith(deck, 'word-residence-record-jp'), 'Russian has only a gloss for it');
});

test('18+ concepts need their module selected, even when cross-listed', async () => {
  const input = await fixtureInput({ learn: 'en', know: 'ru' });
  const byId = new Map(input.concepts.byId);
  byId.set('word-water', { ...byId.get('word-water'), c: { ...byId.get('word-water')?.c, mods: ['core-1', 'food', 'profanity'] } });
  const concepts = { order: input.concepts.order, byId };
  const pick = (/** @type {string[]} */ modules) => selectNotes(validate({ ...input.config, modules }, input.meta), input.meta, concepts, input.learnData, input.knowData);
  assert.ok(!pick(['core-1']).some((n) => n.conceptIds.includes('word-water')));
  assert.ok(pick(['core-1', 'profanity']).some((n) => n.conceptIds.includes('word-water')));
});

test('disambiguators: part of speech, then gender, then the first differing form, else the hint', async () => {
  const meta = (await fixtureInput({ learn: 'de', know: 'en' })).meta;
  const ids = ['word-a', 'word-b', 'word-c', 'word-d', 'word-e', 'word-f', 'word-g'];
  const pos = { 'word-a': 'noun', 'word-b': 'verb', 'word-c': 'noun', 'word-d': 'noun', 'word-e': 'noun', 'word-f': 'noun', 'word-g': 'noun' };
  const concepts = { order: ids, byId: new Map(ids.map((id, rank) => [id, { id, c: { pos: pos[/** @type {keyof typeof pos} */ (id)], mods: ['core-1'] }, module: 'core-1', rank }])) };
  const lang = new Map([
    ['word-a', { w: 'Fliege', g: 'f', forms: { pl: 'Fliegen' } }], // noun vs …
    ['word-b', { w: 'Fliege', hint: 'Insekt' }], // … verb (same w)
    ['word-c', { w: 'See', g: 'm', forms: { pl: 'Seen' } }], // der See …
    ['word-d', { w: 'See', g: 'f' }], // … die See
    ['word-e', { w: 'Bank', g: 'f', forms: { pl: 'Bänke' } }],
    ['word-f', { w: 'Bank', g: 'f', forms: { pl: 'Banken' } }],
    ['word-g', { w: 'Bank', g: 'f', forms: { pl: 'Bänke' }, hint: 'Sitz' }], // merges with word-e
  ]);
  const { keyOf, disambig } = learnedInventory(concepts, { lang, ex: new Map(), ipa: new Map(), etym: new Map() }, meta.languages.languages.de);
  assert.equal(keyOf.get('word-g'), 'word-e');
  assert.deepEqual(disambig.get('word-a'), { kind: 'pos', pos: 'noun' });
  assert.deepEqual(disambig.get('word-b'), { kind: 'pos', pos: 'verb' });
  assert.deepEqual(disambig.get('word-c'), { kind: 'gender', g: 'm' });
  assert.deepEqual(disambig.get('word-d'), { kind: 'gender', g: 'f' });
  assert.deepEqual(disambig.get('word-e'), { kind: 'form', key: 'pl', value: 'Bänke' });
  assert.deepEqual(disambig.get('word-f'), { kind: 'form', key: 'pl', value: 'Banken' });
});

test('module counts reflect the language pair', async () => {
  const input = await fixtureInput({ learn: 'ru', know: 'en' });
  const counts = moduleCounts(input.config, input.meta, input.concepts, input.learnData, input.knowData);
  assert.equal(counts.get('core-1'), 12);
  assert.equal(counts.get('time'), 3, 'weekdays (cross-listed from core-1) and сутки');
  assert.equal(counts.get('residence'), 1, 'the Japanese-only concept is not Russian');
  const ja = await fixtureInput({ learn: 'ja', know: 'en' });
  const jaCounts = moduleCounts(ja.config, ja.meta, ja.concepts, ja.learnData, ja.knowData);
  assert.equal(jaCounts.get('residence'), 2);
  assert.equal(jaCounts.get('time'), 2);
});
