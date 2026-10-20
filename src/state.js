// @ts-check
// Deck configuration (ARCHITECTURE §4): model, defaults from data/meta/fields.json, validation,
// URL-hash codec, local storage, and a tiny observable store. Pure logic: the storage object is passed in.
//
// Hash format: #v1&l=ja&k=ru&m=core-1,food&f=reading:f,ipa:o&x=2&r=1&t=1&sr=c
//   l learn · k know ('=' = same-language mode) · m modules (canonical order) · f field placements that
//   differ from the default (o off, f front, b back, n on, w with the word) · x examples 0–3 ·
//   r reverse · t type the answer (needs r) · sr Serbian script (c|l, written when Serbian is involved).
//   Flow drills (deck/flow.js): a audio on cards · e ear cards · s shadow cards · sp the shadow card's slow
//   pass (written with s) · rx reflex cards · cu drill cues · vc the voice the learner speaks as.
// Unknown keys are ignored; an invalid value falls back to its default and keeps the rest.

import { DEFAULT_SPEED, SPEEDS, VOICE_MAX } from './deck/flow.js';

/** @typedef {'off' | 'front' | 'back' | 'on' | 'word'} Placement */
/** @typedef {'cyrl' | 'latn'} Script */

/**
 * @typedef {object} Config
 * @property {1} v
 * @property {string | null} learn
 * @property {string | null} know  a language code, '=' for same-language mode, or null
 * @property {string[]} modules    selected module IDs, canonical order
 * @property {Record<string, Placement>} fields  explicit placements (only those the user changed)
 * @property {number} examples
 * @property {boolean} reverse
 * @property {boolean} type        type the answer; only effective with reverse
 * @property {Script} srScript
 * @property {boolean} audio     text-to-speech of the word on forward fronts and reverse backs
 * @property {boolean} ear       ear cards: the word heard (and in IPA) before it is seen
 * @property {boolean} shadow    shadow cards: an example sentence played slow and then at speed
 * @property {number} speed      the shadow card's slow pass (SPEEDS)
 * @property {boolean} reflex    reflex cards: article or key form, said inside a draining bar
 * @property {boolean} cues      a drill cue on every question side
 * @property {string} voice      the native speaker the learner speaks as ('' = none)
 */

/**
 * @typedef {object} FieldDef     a row of data/meta/fields.json
 * @property {string} id
 * @property {string} label
 * @property {string} [labelSame]
 * @property {'learning' | 'known' | 'concept'} side
 * @property {'*' | string[]} langs
 * @property {('bilingual' | 'same')[]} modes
 * @property {Placement[]} placements
 * @property {Placement} default
 * @property {Record<string, Placement>} [defaultByLang]
 * @property {boolean} [fixed]
 * @property {boolean} [more]   under "More…" in the field table
 * @property {{ min: number, max: number, default: number }} [count]
 * @property {string} help
 */

/**
 * @typedef {object} Meta  the data/meta files the config depends on
 * @property {{ active: string[], languages: Record<string, any> }} languages
 * @property {{ categories: { id: string, modules: { id: string }[] }[] }} modules
 * @property {{ fields: FieldDef[], deckOptions: { id: string, default: any, values?: string[] }[] }} fields
 */

export const SAME = '=';
export const STORAGE_KEY = 'ankigen:config';

const PLACEMENT_CODE = { off: 'o', front: 'f', back: 'b', on: 'n', word: 'w' };
const SCRIPT_CODE = { cyrl: 'c', latn: 'l' };
/** @param {Record<string, string>} map */
const invert = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
const CODE_PLACEMENT = invert(PLACEMENT_CODE);
const CODE_SCRIPT = invert(SCRIPT_CODE);
const HASH_KEYS = ['l', 'k', 'm', 'f', 'x', 'r', 't', 'sr', 'a', 'e', 's', 'sp', 'rx', 'cu', 'vc'];

// ---------------------------------------------------------------- meta helpers

/** @param {Meta} meta */
export function moduleIds(meta) {
  return meta.modules.categories.flatMap((c) => c.modules.map((m) => m.id));
}

/** @param {Meta} meta @param {string} id */
export function fieldDef(meta, id) {
  return meta.fields.fields.find((f) => f.id === id);
}

/** @param {Meta} meta @param {string} id */
function deckOption(meta, id) {
  return meta.fields.deckOptions.find((o) => o.id === id);
}

/** @param {Meta} meta */
function examplesRange(meta) {
  return fieldDef(meta, 'examples')?.count ?? { min: 0, max: 3, default: 2 };
}

/** @param {Config} config @returns {'bilingual' | 'same'} */
export function mode(config) {
  return config.know === SAME ? 'same' : 'bilingual';
}

/** True if Serbian is the learned or the known language. @param {Config} config */
export function usesSerbian(config) {
  return config.learn === 'sr' || config.know === 'sr';
}

/** Default placement of a field row for a learning language. @param {FieldDef} def @param {string | null} learn */
export function defaultPlacement(def, learn) {
  return (learn && def.defaultByLang?.[learn]) || def.default;
}

/** Whether the field table shows this row for the config. @param {FieldDef} def @param {Config} config */
export function isFieldShown(def, config) {
  if (!config.learn) return false;
  const langOk = def.langs === '*' || def.langs.includes(config.learn);
  return langOk && def.modes.includes(mode(config));
}

/**
 * Placement used to build the deck: the user's choice or the default; 'off' for rows that do not apply.
 * @param {Meta} meta @param {Config} config @param {string} id
 * @returns {Placement}
 */
export function placementOf(meta, config, id) {
  const def = fieldDef(meta, id);
  if (!def || !isFieldShown(def, config)) return 'off';
  return config.fields[id] ?? defaultPlacement(def, config.learn);
}

/** Type the answer counts only on reverse cards. @param {Config} config */
export function typesAnswer(config) {
  return config.reverse && config.type;
}

// ---------------------------------------------------------------- model

/** @param {Meta} meta @returns {Config} */
export function defaultConfig(meta) {
  return {
    v: 1,
    learn: null,
    know: null,
    modules: [],
    fields: {},
    examples: examplesRange(meta).default,
    reverse: Boolean(deckOption(meta, 'reverse')?.default),
    type: Boolean(deckOption(meta, 'typeAnswer')?.default),
    srScript: deckOption(meta, 'srScript')?.default === 'latn' ? 'latn' : 'cyrl',
    audio: false,
    ear: false,
    shadow: false,
    speed: DEFAULT_SPEED,
    reflex: false,
    cues: false,
    voice: '',
  };
}

/** A voice name as kept: trimmed, one line, at most VOICE_MAX characters. @param {unknown} raw */
export function cleanVoice(raw) {
  return typeof raw === 'string' ? raw.replace(/[\p{C}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, VOICE_MAX) : '';
}

/**
 * Normalize a partial or untrusted config. Invalid values fall back to defaults; the rest is kept.
 * @param {Partial<Record<keyof Config, any>>} raw
 * @param {Meta} meta
 * @returns {Config}
 */
export function validate(raw, meta) {
  const base = defaultConfig(meta);
  const active = meta.languages.active;
  const learn = active.includes(raw.learn) ? raw.learn : null;
  const know = raw.know === SAME || (active.includes(raw.know) && raw.know !== learn) ? raw.know : null;
  const all = moduleIds(meta);
  const chosen = new Set(Array.isArray(raw.modules) ? raw.modules : []);
  /** @type {Record<string, Placement>} */
  const fields = {};
  for (const [id, p] of Object.entries(raw.fields && typeof raw.fields === 'object' ? raw.fields : {})) {
    const def = fieldDef(meta, id);
    if (def && !def.fixed && def.placements.includes(p)) fields[id] = p;
  }
  const { min, max } = examplesRange(meta);
  const examples = Number.isInteger(raw.examples) && raw.examples >= min && raw.examples <= max ? raw.examples : base.examples;
  const reverse = typeof raw.reverse === 'boolean' ? raw.reverse : base.reverse;
  const flag = (/** @type {keyof Config} */ key) => (typeof raw[key] === 'boolean' ? /** @type {boolean} */ (raw[key]) : /** @type {boolean} */ (base[key]));
  return {
    v: 1,
    learn,
    know,
    modules: all.filter((id) => chosen.has(id)),
    fields,
    examples,
    reverse,
    type: typeof raw.type === 'boolean' ? raw.type : base.type,
    srScript: raw.srScript === 'cyrl' || raw.srScript === 'latn' ? raw.srScript : base.srScript,
    audio: flag('audio'),
    ear: flag('ear'),
    shadow: flag('shadow'),
    speed: SPEEDS.includes(raw.speed) ? raw.speed : base.speed,
    reflex: flag('reflex'),
    cues: flag('cues'),
    voice: cleanVoice(raw.voice),
  };
}

/**
 * Set a field placement. Choosing the default for the current learning language removes the override.
 * @param {Config} config @param {Meta} meta @param {string} id @param {Placement} placement
 * @returns {Config}
 */
export function withPlacement(config, meta, id, placement) {
  const def = fieldDef(meta, id);
  if (!def || def.fixed || !def.placements.includes(placement)) return config;
  const fields = { ...config.fields };
  if (placement === defaultPlacement(def, config.learn)) delete fields[id];
  else fields[id] = placement;
  return { ...config, fields };
}

// ---------------------------------------------------------------- URL hash

/** @param {Config} config @param {Meta} meta @returns {string} the hash, starting with '#' */
export function encodeHash(config, meta) {
  const parts = ['v1'];
  if (config.learn) parts.push(`l=${config.learn}`);
  if (config.know) parts.push(`k=${config.know}`);
  if (config.modules.length) parts.push(`m=${config.modules.join(',')}`);
  const fields = meta.fields.fields
    .filter((def) => config.fields[def.id] && isFieldShown(def, config) && config.fields[def.id] !== defaultPlacement(def, config.learn))
    .map((def) => `${def.id}:${PLACEMENT_CODE[config.fields[def.id]]}`);
  if (fields.length) parts.push(`f=${fields.join(',')}`);
  parts.push(`x=${config.examples}`);
  if (config.reverse) parts.push('r=1');
  if (typesAnswer(config)) parts.push('t=1');
  if (usesSerbian(config)) parts.push(`sr=${SCRIPT_CODE[config.srScript]}`);
  if (config.audio) parts.push('a=1');
  if (config.ear) parts.push('e=1');
  if (config.shadow) parts.push('s=1', `sp=${config.speed}`);
  if (config.reflex) parts.push('rx=1');
  if (config.cues) parts.push('cu=1');
  if (config.voice) parts.push(`vc=${encodeURIComponent(config.voice)}`);
  return '#' + parts.join('&');
}

/**
 * Parse a location hash. Returns null when it holds no configuration (empty, or another format version).
 * @param {string} hash @param {Meta} meta @returns {Config | null}
 */
export function decodeHash(hash, meta) {
  const segments = hash.replace(/^#/, '').split('&').filter(Boolean);
  /** @type {Record<string, string>} */
  const values = {};
  let version = null;
  for (const segment of segments) {
    const eq = segment.indexOf('=');
    if (eq < 0) {
      if (/^v\d+$/.test(segment)) version = segment;
      continue;
    }
    try {
      values[segment.slice(0, eq)] = decodeURIComponent(segment.slice(eq + 1));
    } catch {
      // malformed escape: ignore this key
    }
  }
  if (version ? version !== 'v1' : !HASH_KEYS.some((k) => k in values)) return null;
  /** @type {Record<string, Placement>} */
  const fields = {};
  for (const item of (values.f ?? '').split(',')) {
    const [id, code] = item.split(':');
    if (id && CODE_PLACEMENT[code]) fields[id] = /** @type {Placement} */ (CODE_PLACEMENT[code]);
  }
  const reverse = values.r === '1';
  return validate(
    {
      learn: values.l,
      know: values.k,
      modules: values.m ? values.m.split(',') : [],
      fields,
      examples: values.x !== undefined && /^\d+$/.test(values.x) ? Number(values.x) : undefined,
      reverse,
      type: reverse && values.t === '1',
      srScript: CODE_SCRIPT[values.sr],
      audio: values.a === '1',
      ear: values.e === '1',
      shadow: values.s === '1',
      speed: values.sp !== undefined && /^0\.\d+$/.test(values.sp) ? Number(values.sp) : undefined,
      reflex: values.rx === '1',
      cues: values.cu === '1',
      voice: values.vc,
    },
    meta,
  );
}

// ---------------------------------------------------------------- persistence

/**
 * Initial config: the URL hash wins, then the last config saved locally, then defaults.
 * @param {{ hash?: string, storage?: Pick<Storage, 'getItem'> | null }} sources
 * @param {Meta} meta
 * @returns {Config}
 */
export function loadConfig({ hash = '', storage = null }, meta) {
  const fromHash = decodeHash(hash, meta);
  if (fromHash) return fromHash;
  let saved = null;
  try {
    saved = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // storage disabled (private mode, blocked cookies)
  }
  return (saved && decodeHash(saved, meta)) || defaultConfig(meta);
}

/**
 * @param {Pick<Storage, 'setItem'> | null | undefined} storage @param {Config} config @param {Meta} meta
 */
export function saveConfig(storage, config, meta) {
  try {
    storage?.setItem(STORAGE_KEY, encodeHash(config, meta));
  } catch {
    // quota or disabled storage: the URL hash still holds the config
  }
}

// ---------------------------------------------------------------- store

/**
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial;
  /** @type {Set<(state: T) => void>} */
  const listeners = new Set();
  return {
    get: () => state,
    /** @param {T | ((state: T) => T)} next */
    set(next) {
      const value = typeof next === 'function' ? /** @type {(s: T) => T} */ (next)(state) : next;
      if (value === state) return;
      state = value;
      for (const fn of listeners) fn(state);
    },
    /** @param {(state: T) => void} fn @returns {() => void} unsubscribe */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
