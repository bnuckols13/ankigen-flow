// The flow drills (src/deck/flow.js, docs/FLOW.md): the config keys and their hash, the fields filled only while
// a drill is on, the cards each drill makes, the renderer's speaker mark, the cues and the deck description.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHash, encodeHash, validate } from '../src/state.js';
import { CUES, cueFor, flowCounts, fnv1a, reflexOf, shadowOf, ttsLang, ttsTag } from '../src/deck/flow.js';
import { FIELD_NAMES, deckContext } from '../src/deck/fields.js';
import { cardOrds, renderCard, renderTemplate } from '../src/deck/render.js';
import { deckDescription } from '../src/deck/apkg.js';
import { stripHtml } from '../src/text/html.js';
import { fixtureDeck, fixtureInput, fixtureLoader } from './helpers/fixtures.mjs';
import { buildApkg } from '../src/deck/apkg.js';
import { loadSqlJs } from '../tools/lib/sqljs.mjs';
import { strFromU8, unzipSync } from '../vendor/fflate.js';

const ALL = { audio: true, ear: true, shadow: true, reflex: true, cues: true };
const FLOW_FIELDS = FIELD_NAMES.slice(FIELD_NAMES.indexOf('Reverse') + 1);

/** @param {Awaited<ReturnType<typeof fixtureDeck>>} deck @param {string} id */
const fieldsOf = (deck, id) => {
  const note = deck.notes.find((n) => n.conceptIds.includes(id));
  assert.ok(note, `${id} in the deck`);
  return note.fields;
};

test('the flow keys round-trip through the hash; the slow pass is written with shadow cards only', async () => {
  const { meta } = await fixtureInput({ learn: 'ru', know: 'en' });
  const config = validate({ learn: 'ru', know: 'en', modules: ['core-1'], ...ALL, speed: 0.25, voice: '  Anna   Karenina ' }, meta);
  const hash = encodeHash(config, meta);
  assert.equal(hash, '#v1&l=ru&k=en&m=core-1&x=2&a=1&e=1&s=1&sp=0.25&rx=1&cu=1&vc=Anna%20Karenina');
  assert.deepEqual(decodeHash(hash, meta), config);
  assert.equal(config.voice, 'Anna Karenina', 'the voice is trimmed to one line');
  const off = encodeHash(validate({ learn: 'ru', know: 'en', speed: 0.25 }, meta), meta);
  assert.equal(off, '#v1&l=ru&k=en&x=2', 'nothing on: AnkiGen’s hash');
  const bad = decodeHash('#v1&l=ru&k=en&s=1&sp=0.9&vc=' + encodeURIComponent('x'.repeat(60) + '\u0007'), meta);
  assert.deepEqual([bad?.shadow, bad?.speed, bad?.voice], [true, 0.5, 'x'.repeat(40)], 'an unknown speed falls back; the voice is clipped and cleaned');
});

test('with every drill off the flow fields are empty: the deck is AnkiGen’s', async () => {
  const deck = await fixtureDeck({ learn: 'de', know: 'en', reverse: true });
  for (const note of deck.notes) for (const f of FLOW_FIELDS) assert.equal(note.fields[f], '', `${f} of ${note.key}`);
  for (const note of deck.notes) assert.deepEqual(cardOrds(deck.noteType, note.fields), [0, 1]);
});

test('Speech: the word as text-to-speech reads it, article included, no stress marks or furigana', async () => {
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', audio: true }), 'word-water').Speech, 'das Wasser');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', audio: true, fields: { gender: 'off' } }), 'word-water').Speech, 'das Wasser', 'even with the gender row off');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', ear: true }), 'word-water').Speech, 'вода');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ja', know: 'en', ear: true }), 'word-water').Speech, '水');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'sr', know: 'en', ear: true, srScript: 'latn' }), 'word-water').Speech, 'voda');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', ear: true }), 'word-water').Ear, '1');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', audio: true }), 'word-water').Ear, '', 'audio alone makes no ear card');
});

test('Shadow: the first example as speech and as a line, with its parallel translation', async () => {
  const ru = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', shadow: true }), 'word-water');
  assert.equal(ru.ShadowSpeech, 'Можно мне стакан воды, пожалуйста?');
  assert.equal(ru.ShadowLine, 'Можно мне стакан <b class="t">воды́</b>, пожалуйста?');
  assert.equal(ru.ShadowGloss, 'Can I have a glass of water, please?');
  const ja = fieldsOf(await fixtureDeck({ learn: 'ja', know: 'de', shadow: true }), 'word-water');
  assert.equal(ja.ShadowSpeech, '水を一杯ください。', 'no furigana, no spaces before kanji');
  assert.match(ja.ShadowLine, /<ruby>/);
  const same = fieldsOf(await fixtureDeck({ learn: 'ru', know: '=', shadow: true }), 'word-water');
  assert.equal(same.ShadowGloss, '', 'no translation in same-language mode');
  const deck = await fixtureDeck({ learn: 'ja', know: 'en', shadow: true });
  const silent = deck.notes.find((n) => !shadowOf(n, deck.ctx ?? deckContext(deck)));
  assert.ok(silent, 'a note without an example');
  assert.equal(silent.fields.ShadowSpeech, '');
});

test('Reflex: the article in article languages, else the first key form; category forms are skipped', async () => {
  const de = await fixtureDeck({ learn: 'de', know: 'en', reflex: true });
  const water = fieldsOf(de, 'word-water');
  assert.equal(stripHtml(water.ReflexPrompt), 'Wasser with its article');
  assert.deepEqual([water.ReflexAnswer, water.ReflexSpeech], ['das Wasser', 'das Wasser']);
  const ru = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', reflex: true }), 'word-water');
  assert.equal(stripHtml(ru.ReflexPrompt), 'вода́ gen.', 'a marker language drills a form');
  assert.deepEqual([ru.ReflexAnswer, ru.ReflexSpeech], ['воды́', 'воды'], 'the card keeps the stress mark; speech drops it');
  const ja = await fixtureDeck({ learn: 'ja', know: 'en', reflex: true });
  const eat = fieldsOf(ja, 'word-eat');
  assert.equal(stripHtml(eat.ReflexPrompt), '食べる polite', 'the verb class is a category, not a form to say');
  assert.equal(eat.ReflexAnswer, '食べます');
  const ctx = deckContext(ja);
  const none = ja.notes.find((n) => !reflexOf(n, ctx, ja.concepts.byId.get(n.conceptIds[0])?.c?.pos));
  assert.ok(none, 'a note without a reflex drill');
  assert.equal(none.fields.ReflexAnswer, '');
});

test('the five templates: each flow question needs its own field, speaks, and never spells the word', async () => {
  const deck = await fixtureDeck({ learn: 'de', know: 'en', reverse: true, ...ALL, speed: 0.25, voice: 'Anna' });
  const { noteType } = deck;
  assert.deepEqual(noteType.templates.map((t) => t.name), ['Forward', 'Reverse', 'Ear', 'Shadow', 'Reflex']);
  const [fwd, rev, ear, shadow, reflex] = noteType.templates;
  assert.match(fwd.qfmt, /\{\{tts de_DE:Speech\}\}/, 'audio on the forward question');
  assert.match(rev.afmt, /\{\{tts de_DE:Speech\}\}/, 'audio on the reverse answer');
  assert.doesNotMatch(rev.qfmt, /tts/, 'nothing gives the reverse answer away');
  assert.match(ear.qfmt, /^\{\{#Ear\}\}[\s\S]*\{\{\/Ear\}\}$/);
  assert.doesNotMatch(ear.qfmt, /\{\{Word\}\}|\{\{WordRuby\}\}/, 'the ear question never shows the spelling');
  assert.match(ear.qfmt, /\{\{#IPA\}\}/, 'IPA is the sound page');
  assert.match(ear.afmt, /<hr id=answer>[\s\S]*\{\{Word\}\}[\s\S]*\{\{Translation\}\}/);
  assert.match(shadow.qfmt, /\{\{tts de_DE speed=0.25:ShadowSpeech\}\}\{\{tts de_DE:ShadowSpeech\}\}/, 'slow, then at speed');
  assert.doesNotMatch(shadow.qfmt, /ShadowLine|\{\{Word\}\}/, 'no text to read while shadowing');
  assert.match(shadow.afmt, /\{\{ShadowLine\}\}[\s\S]*\{\{#ShadowGloss\}\}/);
  assert.match(reflex.qfmt, /\{\{#ReflexAnswer\}\}[\s\S]*\{\{ReflexPrompt\}\}[\s\S]*class="bar"/);
  assert.match(reflex.afmt, /\{\{ReflexAnswer\}\}[\s\S]*\{\{tts de_DE:ReflexSpeech\}\}/);
  for (const t of [fwd, rev, ear, shadow, reflex]) {
    assert.match(t.qfmt, /\{\{#Cue\}\}<div class="cue" data-field="Cue">\{\{Cue\}\}<\/div>\{\{\/Cue\}\}<div class="voice">as Anna<\/div>/, `${t.name}: cue and voice close the question`);
  }
  const water = fieldsOf(deck, 'word-water');
  assert.deepEqual(cardOrds(noteType, water), [0, 1, 2, 3, 4]);
  const earCard = renderCard(noteType, water, 2);
  assert.ok(earCard);
  assert.doesNotMatch(stripHtml(earCard.front), /Wasser/, 'the rendered ear front spells nothing');
  assert.match(earCard.front, /class="tts" title="das Wasser"/);
  assert.match(stripHtml(earCard.back), /Wasser/);
});

test('cards follow the data: no shadow card without an example, no reflex card without a drill', async () => {
  const deck = await fixtureDeck({ learn: 'ja', know: 'en', ...ALL });
  const ctx = deckContext(deck);
  const counts = flowCounts(deck.notes, ctx);
  let shadow = 0;
  let reflex = 0;
  for (const note of deck.notes) {
    const ords = cardOrds(deck.noteType, note.fields);
    assert.deepEqual(ords.slice(0, 2), [0, 2], `${note.key}: forward and ear`);
    if (ords.includes(3)) shadow++;
    if (ords.includes(4)) reflex++;
  }
  assert.deepEqual({ shadow, reflex }, counts);
  assert.ok(shadow > 0 && shadow < deck.notes.length, 'some notes have an example, some not');
  assert.ok(reflex > 0 && reflex < deck.notes.length, 'some notes have a reflex drill, some not');
});

test('the renderer shows a speaker mark for {{tts}}, with the text Anki reads and the slow pass', () => {
  assert.equal(renderTemplate('{{tts es_ES speed=0.5:X}}', { X: 'hola' }), '<span class="tts" title="hola">🔊<span class="tts-speed">×0.5</span></span>');
  assert.equal(renderTemplate('{{tts es_ES:X}}', { X: '<b>hola</b> &amp; adiós' }), '<span class="tts" title="hola &amp; adiós">🔊</span>');
  assert.equal(renderTemplate('{{tts es_ES:X}}', { X: '' }), '', 'no button for an empty field, as in Anki');
  assert.equal(ttsTag('es_ES', 'Speech'), '{{tts es_ES:Speech}}');
  assert.equal(ttsTag('ru_RU', 'ShadowSpeech', 0.25), '{{tts ru_RU speed=0.25:ShadowSpeech}}');
});

test('tts languages come from the registry locale', async () => {
  const meta = await fixtureLoader().getMeta();
  const reg = meta.languages.languages;
  assert.deepEqual(['es', 'zh', 'sr', 'ja', 'en'].map((c) => ttsLang(reg[c], c)), ['es_ES', 'zh_CN', 'sr_RS', 'ja_JP', 'en_US']);
  assert.equal(ttsLang(undefined, 'xx'), 'xx');
});

test('cues are fixed per note key and name the voice', () => {
  assert.equal(fnv1a('word-water') % CUES.length, 7, 'word-water gets the model cue');
  assert.equal(cueFor('word-water', ''), 'Say it as your model speaker.');
  assert.equal(cueFor('word-water', 'Anna'), 'Say it as Anna.');
  assert.equal(cueFor('word-hand', 'Anna'), CUES[1][1]);
  assert.equal(cueFor('word-hand', 'Anna'), cueFor('word-hand', 'Boris'), 'the same cue every time');
  const seen = new Set(['word-water', 'word-hand', 'word-arm', 'word-eat', 'word-big', 'word-brother-older', 'word-day-24h', 'word-sister'].map((k) => fnv1a(k) % CUES.length));
  assert.ok(seen.size >= 5, 'the keys spread over the cues');
});

test('the Cue field is filled only with cues on, and escaped', async () => {
  const on = fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', cues: true, voice: 'A & B' }), 'word-water');
  assert.equal(on.Cue, 'Say it as A &amp; B.');
  const off = fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', voice: 'A & B' }), 'word-water');
  assert.equal(off.Cue, '');
});

test('the deck description names the drills, the voice and the text-to-speech', async () => {
  const { meta } = await fixtureInput({ learn: 'ru', know: 'en' });
  const plain = deckDescription(validate({ learn: 'ru', know: 'en', modules: ['core-1'] }, meta), meta);
  assert.match(plain, /^Made with <a href="[^"]+#v1&amp;l=ru&amp;k=en&amp;m=core-1&amp;x=2">AnkiGen Flow<\/a> · data [\d.]+$/);
  const flow = deckDescription(validate({ learn: 'ru', know: 'en', modules: ['core-1'], ear: true, reflex: true, voice: 'Anna <3' }, meta), meta);
  assert.match(flow, /Flow drills: ear, reflex\./);
  assert.match(flow, /Install a Russian voice/);
  assert.match(flow, /You speak as Anna &lt;3:/);
  const audio = deckDescription(validate({ learn: 'ru', know: 'en', modules: ['core-1'], audio: true }, meta), meta);
  assert.doesNotMatch(audio, /Flow drills:/);
  assert.match(audio, /text-to-speech/);
});

test('the package holds every flow card with its own id', async () => {
  const deck = await fixtureDeck({ learn: 'de', know: 'en', reverse: true, ...ALL });
  const SQL = await loadSqlJs();
  const bytes = await buildApkg({ SQL, config: deck.config, meta: deck.meta, deck, now: 1_792_300_000_000 });
  const db = new SQL.Database(unzipSync(bytes)['collection.anki2']);
  try {
    const rows = db.exec('select id, nid, ord from cards order by id')[0]?.values ?? [];
    const expected = deck.notes.reduce((n, note) => n + cardOrds(deck.noteType, note.fields).length, 0);
    assert.equal(rows.length, expected);
    assert.equal(new Set(rows.map((r) => r[0])).size, rows.length, 'card ids are unique');
    assert.ok(rows.some((r) => r[2] === 4), 'a reflex card is in the package');
    const model = Object.values(JSON.parse(String(db.exec('select models from col')[0].values[0][0])))[0];
    assert.deepEqual(model.tmpls.map((t) => t.name), ['Forward', 'Reverse', 'Ear', 'Shadow', 'Reflex']);
    assert.match(model.tmpls[2].qfmt, /\{\{tts de_DE:Speech\}\}/);
  } finally {
    db.close();
  }
});
