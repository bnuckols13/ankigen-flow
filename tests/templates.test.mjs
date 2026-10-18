import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate, renderCard, isEmptyField } from '../src/deck/render.js';
import { fixtureDeck } from './helpers/fixtures.mjs';

const LEARNING_FIELDS = ['Word', 'WordRuby', 'Disambig', 'Romanization', 'OtherScript', 'MeasureWord', 'Hanja', 'Forms', 'IPA', 'Examples', 'Related', 'Etymology'];
/** Field tags used by a template, in order (section tags excluded). @param {string} tpl */
const fieldsIn = (tpl) => [...tpl.matchAll(/\{\{([^#^/}][^}]*)\}\}/g)].map((m) => m[1]);
/** @param {string} tpl */
const beforeAnswer = (tpl) => tpl.split('<hr id=answer>')[0];
/** @param {string} tpl */
const afterAnswer = (tpl) => tpl.split('<hr id=answer>')[1] ?? '';

// Every learning-side row placed on Front, to prove the reverse question still hides them.
const ALL_FRONT = { reverse: true, fields: { romanization: 'front', forms: 'front', ipa: 'front', pos: 'front', register: 'front', emoji: 'front' } };

test('forward: Front rows ask, Back rows answer', async () => {
  const { noteType } = await fixtureDeck({ learn: 'ru', know: 'en', ...ALL_FRONT });
  const [fwd] = noteType.templates;
  assert.deepEqual(fieldsIn(fwd.qfmt), ['Emoji', 'Word', 'Disambig', 'Romanization', 'Forms', 'IPA', 'POS', 'Register']);
  assert.ok(!fieldsIn(fwd.qfmt).includes('Translation'));
  assert.ok(fieldsIn(afterAnswer(fwd.afmt)).includes('Translation'));
  assert.ok(fieldsIn(afterAnswer(fwd.afmt)).includes('Examples'), 'examples are always on the back');
});

test('reverse: every learning-side row moves to the answer', async () => {
  const { noteType } = await fixtureDeck({ learn: 'ru', know: 'en', ...ALL_FRONT });
  const rev = noteType.templates[1];
  assert.match(rev.qfmt, /^\{\{#Reverse\}\}[\s\S]*\{\{\/Reverse\}\}$/);
  const question = fieldsIn(rev.qfmt);
  assert.deepEqual(question, ['Emoji', 'Translation', 'POS', 'Register']);
  for (const f of LEARNING_FIELDS) assert.ok(!question.includes(f), `${f} is not on the reverse question`);
  const answer = fieldsIn(afterAnswer(rev.afmt));
  for (const f of ['Word', 'Disambig', 'Romanization', 'Forms', 'IPA', 'Examples', 'Related']) assert.ok(answer.includes(f), `${f} on the reverse answer`);
  assert.deepEqual(fieldsIn(beforeAnswer(rev.afmt)), ['Emoji', 'Translation', 'POS', 'Register']);
});

test('type the answer: only on reverse cards, both sides, against TypeTarget', async () => {
  const on = (await fixtureDeck({ learn: 'de', know: 'en', reverse: true, type: true })).noteType.templates;
  assert.doesNotMatch(on[0].qfmt + on[0].afmt, /\{\{type:/);
  assert.match(on[1].qfmt, /\{\{type:TypeTarget\}\}/);
  assert.match(afterAnswer(on[1].afmt), /\{\{type:TypeTarget\}\}/);
  const off = (await fixtureDeck({ learn: 'de', know: 'en', reverse: true })).noteType.templates;
  assert.doesNotMatch(off[1].qfmt + off[1].afmt, /\{\{type:/);
});

test('Japanese: WordRuby on the question only with Reading = Front, on the answer unless Off', async () => {
  const fwd = async (/** @type {string} */ reading) => (await fixtureDeck({ learn: 'ja', know: 'ru', reverse: true, fields: { reading } })).noteType.templates;
  const back = await fwd('back');
  assert.ok(fieldsIn(back[0].qfmt).includes('Word') && !fieldsIn(back[0].qfmt).includes('WordRuby'));
  assert.ok(fieldsIn(back[0].afmt).includes('WordRuby'));
  assert.ok(fieldsIn(afterAnswer(back[1].afmt)).includes('WordRuby'));
  const front = await fwd('front');
  assert.ok(fieldsIn(front[0].qfmt).includes('WordRuby'));
  const off = await fwd('off');
  assert.ok(!fieldsIn(off[0].afmt + off[1].afmt).includes('WordRuby'));
});

test('captions are in the known language; lang attributes mark both languages', async () => {
  const { noteType } = await fixtureDeck({ learn: 'ja', know: 'de' });
  assert.match(noteType.templates[0].afmt, /<div class="cap">Formen<\/div>/);
  assert.match(noteType.templates[0].afmt, /<div class="cap">Beispiele<\/div>/);
  assert.match(noteType.templates[0].qfmt, /<div class="word" lang="ja-JP"/);
  assert.match(noteType.templates[0].afmt, /<div class="translation" lang="de-DE"/);
  assert.equal(noteType.name, 'AnkiGen 日本語 (Deutsch)');
  assert.equal((await fixtureDeck({ learn: 'ja', know: '=' })).noteType.name, 'AnkiGen 日本語 (definitions)');
  assert.match(noteType.css, /\.nightMode/);
});

test('renderer: sections, inverted sections, FrontSide, unknown fields', () => {
  const fields = { A: 'a', B: '', C: '<br>' };
  assert.equal(renderTemplate('{{#A}}[{{A}}]{{/A}}{{#B}}no{{/B}}{{^B}}empty{{/B}}{{#C}}no{{/C}}', fields), '[a]empty');
  assert.equal(renderTemplate('{{FrontSide}}|{{Missing}}', fields, { frontSide: 'F' }), 'F|');
  assert.equal(renderTemplate('{{#A}}{{#B}}x{{/B}}y{{/A}}', fields), 'y');
  assert.ok(isEmptyField(' <div></div> ') && !isEmptyField('x'));
});

test('cards render like Anki: no reverse card without the Reverse field, type box on reverse', async () => {
  const off = await fixtureDeck({ learn: 'de', know: 'en' });
  const note = off.notes[0];
  assert.equal(renderCard(off.noteType, note.fields, 1), null);
  const fwd = renderCard(off.noteType, note.fields, 0);
  assert.ok(fwd);
  assert.match(fwd.front, /<span class="art">das<\/span> Wasser/);
  assert.doesNotMatch(fwd.front, /water/);
  assert.match(fwd.back, /<hr id=answer><div class="translation" lang="en-US" data-field="Translation">water<\/div>/);

  const typed = await fixtureDeck({ learn: 'de', know: 'en', reverse: true, type: true });
  const rev = renderCard(typed.noteType, typed.notes[0].fields, 1);
  assert.ok(rev);
  assert.match(rev.front, /<input id="typeans" type="text" disabled/);
  assert.doesNotMatch(rev.front, /Wasser/);
  assert.match(rev.back, /<code id="typeans">das Wasser<\/code>/);
});

test('every card of every sample deck renders without leftover template syntax', async () => {
  for (const [learn, know] of [['ru', 'en'], ['ja', 'de'], ['sr', '='], ['en', 'ja']]) {
    const deck = await fixtureDeck({ learn, know, reverse: true, type: true, examples: 3 });
    for (const note of deck.notes) {
      for (const ord of [0, 1]) {
        const card = renderCard(deck.noteType, note.fields, ord);
        assert.ok(card, `${learn}/${know} ${note.key} ord ${ord}`);
        assert.doesNotMatch(card.front + card.back, /\{\{|\}\}/);
      }
    }
  }
});
