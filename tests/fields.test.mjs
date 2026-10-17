import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_NAMES } from '../src/deck/fields.js';
import { stripHtml } from '../src/text/html.js';
import { fixtureDeck, matchSnapshot } from './helpers/fixtures.mjs';

/** @param {Awaited<ReturnType<typeof fixtureDeck>>} deck @param {string} id */
const fieldsOf = (deck, id) => {
  const note = deck.notes.find((n) => n.conceptIds.includes(id));
  assert.ok(note, `${id} in the deck`);
  return note.fields;
};

test('every note has exactly the fixed fields', async () => {
  const deck = await fixtureDeck({ learn: 'ja', know: 'ru', reverse: true });
  for (const note of deck.notes) assert.deepEqual(Object.keys(note.fields), [...FIELD_NAMES]);
});

test('gender and articles follow the language rules and the toggle', async () => {
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'de', know: 'en' }), 'word-water').Word, '<span class="art">das</span> Wasser');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', fields: { gender: 'off' } }), 'word-water').Word, 'Wasser');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en' }), 'word-water').Word, 'вода́ <span class="g" lang="en-US">f.</span>');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ru', know: 'de' }), 'word-water').Word, 'вода́ <span class="g" lang="de-DE">f.</span>', 'German labels are missing: English fallback');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'sr', know: 'ru' }), 'word-water').Word, 'вода <span class="g" lang="ru-RU">ж. р.</span>');
});

test('type the answer: plain main form, de article while the gender row is on', async () => {
  const typed = { reverse: true, type: true };
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', ...typed }), 'word-brother-older').TypeTarget, 'der Bruder');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', ...typed, fields: { gender: 'off' } }), 'word-brother-older').TypeTarget, 'Bruder');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', ...typed }), 'word-water').TypeTarget, 'вода', 'no stress marks');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ja', know: 'en', ...typed }), 'word-eat').TypeTarget, '食べる', 'native script');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'sr', know: 'en', ...typed, srScript: 'latn' }), 'word-water').TypeTarget, 'voda');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'de', know: 'en', reverse: true }), 'word-water').TypeTarget, '', 'empty unless typing is on');
});

test('example translations appear only for parallel slots', async () => {
  const ruEn = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', examples: 3 }), 'word-eat').Examples;
  const slots = ruEn.split('<div class="ex" ').slice(1);
  assert.equal(slots.length, 3);
  assert.doesNotMatch(slots[0], /ex-tr/, 'Russian slot 1 is an independent sentence (p: 0)');
  assert.match(slots[1], /<div class="ex-tr" lang="en-US">I don't eat meat\.<\/div>/);
  assert.match(slots[2], /What did you eat for breakfast\?/);

  const enRu = fieldsOf(await fixtureDeck({ learn: 'en', know: 'ru', examples: 3 }), 'word-eat').Examples.split('<div class="ex" ').slice(1);
  assert.doesNotMatch(enRu[0], /ex-tr/, 'the English source has no parallel Russian slot 1');
  assert.match(enRu[1], /Я не ем мясо\./);

  const off = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', fields: { exampleTranslations: 'off' } }), 'word-eat').Examples;
  assert.doesNotMatch(off, /ex-tr/);
  const same = fieldsOf(await fixtureDeck({ learn: 'ru', know: '=' }), 'word-eat').Examples;
  assert.doesNotMatch(same, /ex-tr/, 'no translations in same-language mode');
});

test('the examples slider limits slots; merged notes alternate their members', async () => {
  const two = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en' }), 'word-hand').Examples;
  assert.deepEqual([...two.matchAll(/data-concept="([^"]+)"/g)].map((m) => m[1]), ['word-hand', 'word-arm']);
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', examples: 0 }), 'word-hand').Examples, '');
  const three = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', examples: 3 }), 'word-hand').Examples;
  assert.deepEqual([...three.matchAll(/data-concept="([^"]+)"/g)].map((m) => m[1]), ['word-hand', 'word-arm', 'word-hand']);
});

test('furigana follows the Reading setting', async () => {
  const back = fieldsOf(await fixtureDeck({ learn: 'ja', know: 'de' }), 'word-eat');
  assert.equal(back.WordRuby, '<ruby>食<rt>た</rt></ruby>べる');
  assert.match(back.Examples, /<b class="t"><ruby>食<rt>た<\/rt><\/ruby>べます<\/b>/);
  const off = fieldsOf(await fixtureDeck({ learn: 'ja', know: 'de', fields: { reading: 'off' } }), 'word-eat');
  assert.equal(off.WordRuby, '');
  assert.doesNotMatch(off.Examples, /<ruby>|\[/);
  assert.match(off.Examples, /夕飯を<b class="t">食べます<\/b>/);
  const deJa = fieldsOf(await fixtureDeck({ learn: 'de', know: 'ja', examples: 3 }), 'word-eat').Examples;
  assert.match(deJa, /<div class="ex-tr" lang="ja-JP">私は肉を食べません。<\/div>/, 'Japanese translations without readings or braces');
});

test('Russian stress follows its toggle', async () => {
  const on = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', examples: 1, fields: { romanization: 'back' } }), 'word-water');
  assert.match(on.Word, /^вода́/);
  assert.match(on.Forms, /воды́/);
  assert.match(on.Examples, /<b class="t">воды́<\/b>/);
  assert.equal(on.Romanization, 'vodá');
  const off = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', examples: 1, fields: { stress: 'off', romanization: 'back' } }), 'word-water');
  assert.doesNotMatch(off.Word + off.Forms + off.Examples, /́/);
  assert.equal(off.Romanization, 'voda');
  const known = fieldsOf(await fixtureDeck({ learn: 'en', know: 'ru' }), 'word-small').Translation;
  assert.equal(stripHtml(known), 'маленький · небольшой', 'the known language never shows stress marks');
});

test('Serbian script covers word, forms, examples, definitions, translations and captions', async () => {
  const latn = fieldsOf(await fixtureDeck({ learn: 'sr', know: 'en', srScript: 'latn', examples: 1, fields: { otherScript: 'back' } }), 'word-water');
  assert.equal(latn.Word, 'voda <span class="g" lang="en-US">f.</span>');
  assert.equal(stripHtml(latn.Forms), 'gen. vode · pl. vode');
  assert.match(latn.Examples, /Mogu li da dobijem čašu <b class="t">vode<\/b>, molim vas\?/);
  assert.equal(latn.OtherScript, 'вода');
  const cyrl = fieldsOf(await fixtureDeck({ learn: 'sr', know: 'en', fields: { otherScript: 'back' } }), 'word-water');
  assert.equal(cyrl.OtherScript, 'voda');
  const def = fieldsOf(await fixtureDeck({ learn: 'sr', know: '=', srScript: 'latn' }), 'phrase-thank-you').Translation;
  assert.equal(def, 'Izraz kojim se pokazuje da si nekome blagodaran.');
  const known = fieldsOf(await fixtureDeck({ learn: 'en', know: 'sr', srScript: 'latn', examples: 1 }), 'word-hand');
  assert.equal(stripHtml(known.Translation), 'ruka (šaka) · šaka');
  assert.match(known.Examples, /Operi ruke pre večere\./);
});

test('related words: synonyms, antonyms, related, in the learned language', async () => {
  const small = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en' }), 'word-small').Related;
  assert.equal(stripHtml(small), '= небольшо́й · ↔ большо́й');
  const hand = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en' }), 'word-hand').Related;
  assert.equal(hand, '', 'hand and arm are the same Russian note');
  const water = fieldsOf(await fixtureDeck({ learn: 'de', know: 'en' }), 'word-water').Related;
  assert.equal(stripHtml(water), '→ trinken');
});

test('concept rows: POS, register, emoji, ID in the known language', async () => {
  const f = fieldsOf(await fixtureDeck({ learn: 'en', know: 'ru', fields: { pos: 'front', emoji: 'front', conceptId: 'back' } }), 'word-hand');
  assert.equal(f.POS, 'сущ.');
  assert.equal(f.Emoji, '✋');
  assert.equal(f.ConceptId, 'word-hand');
  const merged = fieldsOf(await fixtureDeck({ learn: 'ru', know: 'en', fields: { emoji: 'back', conceptId: 'back' } }), 'word-hand');
  assert.equal(merged.Emoji, '✋ 💪');
  assert.equal(merged.ConceptId, 'word-hand, word-arm');
  const off = fieldsOf(await fixtureDeck({ learn: 'en', know: 'ru' }), 'word-hand');
  assert.deepEqual([off.POS, off.Emoji, off.ConceptId, off.Register], ['', '', '', ''], 'off by default');
});

test('missing layers render nothing', async () => {
  const f = fieldsOf(await fixtureDeck({ learn: 'ja', know: 'en' }), 'word-big');
  assert.equal(f.IPA, '', 'Japanese has no IPA row');
  assert.equal(f.Etymology, '');
  assert.equal(f.Examples, '', 'no examples in the sample for this concept');
  assert.equal(fieldsOf(await fixtureDeck({ learn: 'ja', know: 'en' }), 'word-arm').Etymology, '腕 = ⺼ + 宛');
});

// Golden snapshots: every field of every note for a spread of pairs, with all rows switched on.
const ALL_ON = {
  examples: 3, reverse: true, type: true,
  fields: { romanization: 'back', otherScript: 'back', pos: 'front', register: 'back', emoji: 'front', conceptId: 'back' },
};
const PAIRS = [['ru', 'en'], ['en', 'ru'], ['ja', 'de'], ['de', 'ja'], ['sr', 'en'], ['en', 'sr', { srScript: 'latn' }], ['ja', '='], ['ru', '=']];

for (const [learn, know, extra] of PAIRS) {
  test(`snapshot ${learn}-${know === '=' ? 'same' : know}`, async () => {
    const deck = await fixtureDeck({ ...ALL_ON, learn, know, ...(/** @type {object} */ (extra ?? {})) });
    const notes = deck.notes.map((n) => ({ key: n.key, ids: n.conceptIds, fields: Object.fromEntries(Object.entries(n.fields).filter(([, v]) => v)) }));
    matchSnapshot(`fields-${learn}-${know === '=' ? 'same' : know}`, notes);
  });
}
