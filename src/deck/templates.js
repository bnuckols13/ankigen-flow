// @ts-check
// The note type for a config (ARCHITECTURE §7.1): fixed fields, the templates, card.css verbatim.
//   Forward: learned word → translation. Rows placed on Front go to the question, rows on Back after
//            <hr id=answer>. Japanese uses WordRuby on the question only when Reading = Front, and on
//            the answer whenever Reading ≠ Off.
//   Reverse: translation → learned word. The question is wrapped in {{#Reverse}}…{{/Reverse}}, so Anki
//            makes the card only when the Reverse field is filled. Every row about the learned word goes
//            to the answer; only the translation and concept rows placed on Front (POS, register, emoji)
//            stay on the question. Type the answer adds {{type:TypeTarget}} to both sides.
//   Flow drills (deck/flow.js, docs/FLOW.md), each wrapped in its own field so that turning a drill off
//   never changes the note type's schema:
//   Ear:     {{#Ear}} the word spoken, its IPA, no spelling → the word and the forward answer.
//   Shadow:  {{#ShadowSpeech}} the first example spoken slow and then at speed, no text → the sentence.
//   Reflex:  {{#ReflexAnswer}} a stimulus and a draining bar → the article or form, spoken.
//   Audio adds the spoken word to the forward question and the reverse answer. Cues and the voice the
//   learner speaks as close every question side.
// Captions come from labels.json in the known language. data-field / data-dir / data-side let the site
// tell which field a selection came from (feedback reports).

import { typesAnswer } from '../state.js';
import { escapeHtml } from '../text/html.js';
import { FIELD_NAMES } from './fields.js';
import { flowLabel, ttsTag } from './flow.js';
import { pairLabel } from './names.js';

/** @typedef {import('./fields.js').DeckContext} DeckContext */

/**
 * Field-table rows shown as sections, in display order: [row id, field, CSS class, caption key].
 * @type {[string, string, string, string | null][]}
 */
const ROWS = [
  ['romanization', 'Romanization', 'rom', 'section.romanization'],
  ['otherScript', 'OtherScript', 'other', 'section.otherScript'],
  ['measureWord', 'MeasureWord', 'mw', 'section.measureWord'],
  ['hanja', 'Hanja', 'hanja', 'section.hanja'],
  ['forms', 'Forms', 'forms', 'section.forms'],
  ['ipa', 'IPA', 'ipa', 'section.ipa'],
  ['examples', 'Examples', 'examples', 'section.examples'],
  ['related', 'Related', 'related', 'section.related'],
  ['etymology', 'Etymology', 'etym', 'section.etymology'],
  ['pos', 'POS', 'tag pos', null],
  ['register', 'Register', 'tag reg', null],
  ['emoji', 'Emoji', 'emoji', null],
  ['conceptId', 'ConceptId', 'cid', 'section.conceptId'],
];

/** The templates' names and ordinals: the first two are AnkiGen's, the rest the flow drills. */
export const TEMPLATE_NAMES = /** @type {const} */ (['Forward', 'Reverse', 'Ear', 'Shadow', 'Reflex']);

/** @param {DeckContext} ctx @param {string} row */
const sideOf = (ctx, row) => ctx.meta.fields.fields.find((/** @type {any} */ f) => f.id === row)?.side;

/**
 * A conditional section, shown only when the field is not empty.
 * @param {DeckContext} ctx @param {string} row @param {string} field @param {string} cls @param {string | null} captionKey
 */
function section(ctx, row, field, cls, captionKey) {
  const key = row === 'measureWord' && ctx.learn.code === 'ja' ? 'section.counter' : captionKey;
  const caption = key ? `<div class="cap">${escapeHtml(ctx.label(key) ?? '')}</div>` : '';
  const lang = sideOf(ctx, row) === 'learning' ? ` lang="${ctx.learn.tag}"` : ` lang="${ctx.know.tag}"`;
  return `{{#${field}}}<div class="sec ${cls}">${caption}<div class="val"${lang} data-field="${field}">{{${field}}}</div></div>{{/${field}}}`;
}

/** @param {DeckContext} ctx @param {(row: string, placement: string) => boolean} pick */
function sections(ctx, pick) {
  return ROWS.filter(([row]) => pick(row, ctx.place(row))).map(([row, field, cls, cap]) => section(ctx, row, field, cls, cap)).join('');
}

/** @param {DeckContext} ctx @param {boolean} ruby */
function word(ctx, ruby) {
  const field = ruby ? 'WordRuby' : 'Word';
  return (
    `<div class="word" lang="${ctx.learn.tag}" data-field="${field}">{{${field}}}</div>` +
    `{{#Disambig}}<div class="disambig" lang="${ctx.know.tag}" data-field="Disambig">{{Disambig}}</div>{{/Disambig}}`
  );
}

/** @param {DeckContext} ctx @param {string} cls */
function translation(ctx, cls) {
  return `<div class="${cls}" lang="${ctx.know.tag}" data-field="Translation">{{Translation}}</div>`;
}

/** @param {string} dir @param {string} side @param {string} body */
const card = (dir, side, body) => `<div class="ag ag-${dir}" data-dir="${dir}" data-side="${side}">${body}</div>`;

/** The spoken field: Anki's tts tag in a block. @param {DeckContext} ctx @param {string} field @param {string} [cls] @param {number} [speed] */
const speak = (ctx, field, cls = 'speak', speed) => `<div class="${cls}">${ttsTag(ctx.learn.tts, field, speed)}</div>`;

/** A flow card's caption and instruction. @param {string} cap @param {string} hint */
const drill = (cap, hint) => `<div class="cap">${escapeHtml(flowLabel(cap))}</div><div class="hint">${escapeHtml(flowLabel(hint))}</div>`;

/**
 * What closes every question side: the note's drill cue (empty unless cues are on) and the voice the learner
 * speaks as.
 * @param {DeckContext} ctx
 */
function flowFoot(ctx) {
  const cue = '{{#Cue}}<div class="cue" data-field="Cue">{{Cue}}</div>{{/Cue}}';
  const voice = ctx.config.voice ? `<div class="voice">${escapeHtml(flowLabel('voice.as').replace('{voice}', ctx.config.voice))}</div>` : '';
  return cue + voice;
}

/**
 * @param {DeckContext} ctx
 * @param {string} css  css/card.css, embedded verbatim
 */
export function noteType(ctx, css) {
  const { config } = ctx;
  const ja = ctx.learn.code === 'ja';
  const reading = ja ? ctx.place('reading') : 'off';
  const type = typesAnswer(config);
  const isEmoji = (/** @type {string} */ row) => row === 'emoji';
  const learningRow = (/** @type {string} */ row) => sideOf(ctx, row) === 'learning';
  const foot = flowFoot(ctx);
  const audio = config.audio ? speak(ctx, 'Speech') : '';

  // Forward: emoji (if on the front) above the word, other Front rows below it.
  const fwdQuestion = (/** @type {boolean} */ ruby) =>
    sections(ctx, (row, p) => isEmoji(row) && p === 'front') + word(ctx, ruby) + audio + sections(ctx, (row, p) => !isEmoji(row) && p === 'front');
  const backRows = sections(ctx, (_, p) => p === 'back');
  const forwardFront = card('forward', 'front', fwdQuestion(reading === 'front') + foot);
  const forwardBack = card('forward', 'back', fwdQuestion(reading !== 'off') + '<hr id=answer>' + translation(ctx, 'translation') + backRows);

  // Reverse: only the translation and concept rows placed on Front ask the question.
  const revQuestion =
    sections(ctx, (row, p) => isEmoji(row) && p === 'front') +
    translation(ctx, 'translation prompt') +
    sections(ctx, (row, p) => !isEmoji(row) && !learningRow(row) && p === 'front');
  const typeBox = type ? '<div class="typeans">{{type:TypeTarget}}</div>' : '';
  const reverseFront = `{{#Reverse}}${card('reverse', 'front', revQuestion + typeBox + foot)}{{/Reverse}}`;
  const reverseBack = card(
    'reverse',
    'back',
    revQuestion +
      '<hr id=answer>' +
      typeBox +
      word(ctx, reading !== 'off') +
      audio +
      sections(ctx, (row, p) => (learningRow(row) ? p !== 'off' : p === 'back')),
  );

  // Ear: the word heard, in IPA when the row is on, never spelled; the answer is the forward answer.
  const earQuestion =
    sections(ctx, (row, p) => isEmoji(row) && p === 'front') +
    speak(ctx, 'Speech', 'speak big') +
    sections(ctx, (row) => row === 'ipa' && ctx.place('ipa') !== 'off') +
    `<div class="hint">${escapeHtml(flowLabel('ear.hint'))}</div>`;
  const earFront = `{{#Ear}}${card('ear', 'front', earQuestion + foot)}{{/Ear}}`;
  const earBack = card(
    'ear',
    'back',
    speak(ctx, 'Speech', 'speak big') + '<hr id=answer>' + word(ctx, reading !== 'off') + translation(ctx, 'translation') + sections(ctx, (row, p) => p === 'back' && row !== 'ipa'),
  );

  // Shadow: the first example, slow and then at speed, with no text; the answer shows the sentence.
  const shadowQuestion =
    drill('shadow.cap', 'shadow.hint') +
    `<div class="speak big">${ttsTag(ctx.learn.tts, 'ShadowSpeech', config.speed)}${ttsTag(ctx.learn.tts, 'ShadowSpeech')}</div>`;
  const shadowFront = `{{#ShadowSpeech}}${card('shadow', 'front', shadowQuestion + foot)}{{/ShadowSpeech}}`;
  const shadowBack = card(
    'shadow',
    'back',
    `<div class="cap">${escapeHtml(flowLabel('shadow.cap'))}</div>` +
      speak(ctx, 'ShadowSpeech', 'speak') +
      '<hr id=answer>' +
      `<div class="sh-line" lang="${ctx.learn.tag}" data-field="ShadowLine">{{ShadowLine}}</div>` +
      `{{#ShadowGloss}}<div class="sh-gloss" lang="${ctx.know.tag}" data-field="ShadowGloss">{{ShadowGloss}}</div>{{/ShadowGloss}}` +
      `<div class="sh-word"><span lang="${ctx.learn.tag}" data-field="Word">{{Word}}</span> <span class="sh-tr" lang="${ctx.know.tag}" data-field="Translation">{{Translation}}</span></div>`,
  );

  // Reflex: the stimulus and a bar that drains in a moment; the answer is said back by text-to-speech.
  const prompt = `<div class="rx" lang="${ctx.learn.tag}" data-field="ReflexPrompt">{{ReflexPrompt}}</div>`;
  const reflexQuestion = drill('reflex.cap', 'reflex.hint') + prompt + '<div class="bar"><div class="bar-fill"></div></div>';
  const reflexFront = `{{#ReflexAnswer}}${card('reflex', 'front', reflexQuestion + foot)}{{/ReflexAnswer}}`;
  const reflexBack = card(
    'reflex',
    'back',
    `<div class="cap">${escapeHtml(flowLabel('reflex.cap'))}</div>` +
      prompt +
      '<hr id=answer>' +
      `<div class="rx-a" lang="${ctx.learn.tag}" data-field="ReflexAnswer">{{ReflexAnswer}}</div>` +
      speak(ctx, 'ReflexSpeech'),
  );

  return {
    name: `AnkiGen Flow ${pairLabel(ctx.meta, config)}`,
    fields: [...FIELD_NAMES],
    sortField: 0,
    templates: [
      { name: 'Forward', qfmt: forwardFront, afmt: forwardBack },
      { name: 'Reverse', qfmt: reverseFront, afmt: reverseBack },
      { name: 'Ear', qfmt: earFront, afmt: earBack },
      { name: 'Shadow', qfmt: shadowFront, afmt: shadowBack },
      { name: 'Reflex', qfmt: reflexFront, afmt: reflexBack },
    ],
    css,
  };
}

/** @typedef {ReturnType<typeof noteType>} NoteType */
