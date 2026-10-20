// @ts-check
// Flow drills (docs/FLOW.md): what the Mimic Method's practice adds to a vocabulary deck. Pure, no DOM.
//
//   Speech   plain text for Anki's text-to-speech: the word with its article, no HTML, no stress marks.
//   Ear      a card that plays the word (and shows its IPA) before the spelling is seen.
//   Shadow   a card that plays the first example sentence slow and then at speed, with no text, to shadow.
//   Reflex   a stimulus (a noun for its article, a verb for a form) answered aloud inside a draining bar.
//   Cues     one drill cue per note (whisper, pause, warmth…), fixed by a hash of the note key.
//   Voice    the native speaker the learner speaks as (the ego switch), the same on every card.
//
// Card texts are English for now (the known-language captions of labels.json have no flow entries yet).

import { escapeHtml } from '../text/html.js';
import { exampleHtml, stripFurigana, stripTarget } from '../text/furigana.js';
import { stripStress } from '../text/normalize.js';
import { srToLatin } from '../text/translit.js';

/** @typedef {import('./select.js').Note} Note */
/** @typedef {import('./fields.js').DeckContext} DeckContext */

/** The slow pass of a shadow card, as Anki's tts speed. */
export const SPEEDS = /** @type {const} */ ([0.25, 0.5, 0.75]);
export const DEFAULT_SPEED = 0.5;
/** The longest name for the voice the learner speaks as. */
export const VOICE_MAX = 40;

/** Form keys whose values are categories, not forms to say. */
const ENUM_FORMS = new Set(['aspect', 'class', 'type']);

/** Texts printed on the cards. */
export const FLOW_LABELS = {
  'ear.hint': 'Say it back before you flip.',
  'shadow.cap': 'Shadow',
  'shadow.hint': 'Slow, then at speed. Melody first, then the words. Flip when it leaves your mouth without thought.',
  'reflex.cap': 'Reflex',
  'reflex.hint': 'Say it before the bar empties.',
  'reflex.article': 'with its article',
  'voice.as': 'as {voice}',
  'voice.model': 'your model speaker',
};

/**
 * The drill cues, from the Flow School drills: one is printed on each note's question sides. The order is
 * part of the deck: a note keeps its cue across downloads.
 * @type {[string, string][]}
 */
export const CUES = [
  ['whisper', 'Whisper it, every muscle loose.'],
  ['pause', 'Say it, then hold a long pause. Gesture when the awkwardness arrives.'],
  ['warmth', 'Hold someone you love in mind while you say it.'],
  ['melody', 'Hum the melody first. Then put the word on it.'],
  ['face', 'Say it with the whole face. Exaggerate.'],
  ['body', 'Stand up. Say it with a gesture.'],
  ['slow', 'Say it at quarter speed, then at full speed.'],
  ['model', 'Say it as {voice}.'],
];

/** The flow cards' names on the site (the preview's headings). */
export const CARD_NAMES = { ear: 'Ear card', shadow: 'Shadow card', reflex: 'Reflex card' };

/** @param {string} key @returns {string} */
export const flowLabel = (key) => FLOW_LABELS[/** @type {keyof typeof FLOW_LABELS} */ (key)] ?? key;

/** Anki's tts language tag for a registry entry: es-ES → es_ES, zh-Hans-CN → zh_CN. @param {any} reg @param {string} code */
export function ttsLang(reg, code) {
  const parts = String(reg?.locale ?? code).split('-');
  return parts.length > 1 ? `${parts[0]}_${parts[parts.length - 1]}` : parts[0];
}

/** `{{tts es_ES speed=0.5:Field}}`. @param {string} lang @param {string} field @param {number} [speed] */
export function ttsTag(lang, field, speed) {
  return `{{tts ${lang}${speed ? ` speed=${speed}` : ''}:${field}}}`;
}

/** FNV-1a, 32 bits: a stable small number for a string. @param {string} text */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The cue printed on a note's cards, with the voice filled in. @param {string} key @param {string} voice */
export function cueFor(key, voice) {
  const [, text] = CUES[fnv1a(key) % CUES.length];
  return text.replace('{voice}', voice || flowLabel('voice.model'));
}

/** Learned-language text as text-to-speech should read it: no stress marks, Serbian in the chosen script. @param {string} text @param {DeckContext} ctx */
function spoken(text, ctx) {
  if (ctx.learn.code === 'ru') text = stripStress(text);
  if (ctx.learn.code === 'sr' && ctx.config.srScript === 'latn') text = srToLatin(text);
  if (ctx.learn.code === 'ja') text = stripFurigana(text);
  return text;
}

/** The entry's article in an article language ("la", "l'", the first of "el/la"), or null. @param {any} e @param {DeckContext} ctx */
function articleOf(e, ctx) {
  const rules = ctx.learn.reg?.gender;
  if (rules?.mode !== 'article' || !e.g) return null;
  const art = e.art ?? rules.articles?.[e.g];
  return art ? String(art).split('/')[0] : null;
}

/** @param {string} art @param {string} w */
const withArticle = (art, w) => (/['’]$/.test(art) ? `${art}${w}` : `${art} ${w}`);

/** What text-to-speech says for the word: the article is always included, so the ear learns it with the noun. @param {any} e @param {DeckContext} ctx */
export function speechText(e, ctx) {
  const w = spoken(e.w, ctx);
  const art = articleOf(e, ctx);
  return art ? withArticle(art, w) : w;
}

/** The first example sentence of the note, or null. @param {Note} note @param {DeckContext} ctx */
export function shadowOf(note, ctx) {
  for (const id of note.conceptIds) {
    const ex = ctx.learn.data.ex.get(id)?.[0];
    if (ex?.t) return { id, ex };
  }
  return null;
}

/**
 * The shadow card's fields: the sentence as speech, as a line with the word marked, and its translation when
 * the known language has a parallel one.
 * @param {Note} note @param {DeckContext} ctx
 */
export function shadowFields(note, ctx) {
  const found = shadowOf(note, ctx);
  if (!found) return { ShadowSpeech: '', ShadowLine: '', ShadowGloss: '' };
  const { id, ex } = found;
  const { learn, know } = ctx;
  const furigana = learn.code === 'ja' ? (ctx.place('reading') !== 'off' ? 'ruby' : 'strip') : undefined;
  let line = exampleHtml(ctx.learnText(ex.t), { furigana });
  if (learn.code === 'zh' && ctx.place('romanization') !== 'off' && ex.r) line += `<div class="ex-r">${escapeHtml(ex.r)}</div>`;
  let gloss = '';
  const other = !ctx.same && ctx.place('exampleTranslations') !== 'off' ? know.data.ex.get(id)?.[0] : undefined;
  if (other?.t && ex.p === undefined && other.p === undefined) {
    gloss = escapeHtml(ctx.knowText(stripTarget(know.code === 'ja' ? stripFurigana(other.t) : other.t)));
  }
  return { ShadowSpeech: escapeHtml(spoken(stripTarget(ex.t), ctx)), ShadowLine: line, ShadowGloss: gloss };
}

/**
 * The reflex drill of a note: a noun in an article language asks for its article; otherwise the first key form
 * the entry has (the 1st person, the preterite, the plural…). Category forms (aspect, class, type) are not said.
 * @param {Note} note @param {DeckContext} ctx @param {string | undefined} pos
 * @returns {{ kind: 'article', answer: string } | { kind: 'form', key: string, answer: string } | null}
 */
export function reflexOf(note, ctx, pos) {
  const e = note.learnEntries[0];
  if (pos === 'noun') {
    const art = articleOf(e, ctx);
    if (art) return { kind: 'article', answer: withArticle(art, e.w) };
  }
  const keys = /** @type {string[]} */ (ctx.learn.reg?.forms?.[pos ?? '']?.keys ?? []);
  for (const key of keys) {
    const value = e.forms?.[key];
    if (value && !ENUM_FORMS.has(key)) return { kind: 'form', key, answer: String(value) };
  }
  return null;
}

/** The reflex card's fields. @param {Note} note @param {DeckContext} ctx @param {string | undefined} pos */
export function reflexFields(note, ctx, pos) {
  const r = reflexOf(note, ctx, pos);
  if (!r) return { ReflexPrompt: '', ReflexAnswer: '', ReflexSpeech: '' };
  const e = note.learnEntries[0];
  const cue = r.kind === 'article' ? flowLabel('reflex.article') : (ctx.label(`form.${r.key}`) ?? r.key);
  return {
    ReflexPrompt: `<span class="rx-w">${escapeHtml(ctx.learnText(e.w))}</span> <span class="rx-k">${escapeHtml(cue)}</span>`,
    ReflexAnswer: escapeHtml(ctx.learnText(r.answer)),
    ReflexSpeech: escapeHtml(spoken(r.answer, ctx)),
  };
}

/**
 * How many shadow and reflex cards a deck gets: the notes with an example, and those with a reflex drill.
 * @param {Note[]} notes @param {DeckContext} ctx
 */
export function flowCounts(notes, ctx) {
  let shadow = 0;
  let reflex = 0;
  for (const note of notes) {
    if (shadowOf(note, ctx)) shadow++;
    if (reflexOf(note, ctx, ctx.concepts.byId.get(note.conceptIds[0])?.c?.pos)) reflex++;
  }
  return { shadow, reflex };
}

/** Whether any flow option is on. @param {import('../state.js').Config} c */
export const usesFlow = (c) => c.ear || c.shadow || c.reflex || c.cues || c.audio || Boolean(c.voice);
