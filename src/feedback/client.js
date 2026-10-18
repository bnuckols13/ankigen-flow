// @ts-check
// Feedback reports (SPEC §5, ARCHITECTURE §9): client-side limits, the payload, and the POST to the Apps
// Script web app (feedback/Code.gs, which enforces the real limits). Pure except send(), whose fetch is a
// parameter in tests.
//
// The client limits are friction, not security (clearing localStorage resets them):
//   - at least 15 s between reports, at most 5 in 10 minutes and 20 in 24 hours;
//   - "garbage" (no letters, a single letter, one short sequence repeated, or the same report again) is sent
//     only after the user confirms it ("Send anyway");
//   - from the 10th garbage report on, garbage is dropped without asking (the user is still thanked); real
//     reports are still sent.

import { fold } from '../text/normalize.js';

export const LIMITS = {
  gapMs: 15_000,
  burst: 5,
  burstMs: 10 * 60_000,
  daily: 20,
  dailyMs: 24 * 60 * 60_000,
  /** garbage reports after which garbage is no longer sent */
  garbage: 10,
  /** reports remembered for the duplicate check */
  recent: 20,
};

/** @typedef {typeof LIMITS} Limits */

/**
 * What the dialog sends, before the automatic fields are added.
 * @typedef {object} Report
 * @property {string} message
 * @property {string} [category]
 * @property {string} [email]
 * @property {string} [selectedText]
 * @property {string} [conceptId]
 * @property {string} [direction] forward | reverse
 * @property {string} [side]      front | back
 * @property {string} [field]     the note type field the selection came from
 * @property {string} [website]   the honeypot: people leave it empty
 */

/**
 * Kept in localStorage.
 * @typedef {object} FeedbackState
 * @property {string} clientId  random, generated once (no fingerprinting)
 * @property {number[]} sent    send times (ms) within the last 24 hours
 * @property {number} garbage   garbage reports so far
 * @property {string[]} recent  fingerprints of the last reports
 */

/** @typedef {'letters' | 'short' | 'repeated' | 'duplicate'} Garbage */

/**
 * @typedef {{ action: 'wait', reason: 'gap' | 'burst' | 'daily', waitMs: number }
 *   | { action: 'confirm', reason: Garbage }
 *   | { action: 'drop', garbage: boolean }
 *   | { action: 'send', garbage: boolean }} Decision
 */

/** The same check as feedback/Code.gs. */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const STORAGE_KEY = 'ankigen:feedback';
const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

/** FNV-1a, 32 bits, as 8 hex digits. @param {string} text */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Identifies a report for the duplicate check: its message, card and quote. @param {Report} report */
export function fingerprint(report) {
  return hash([fold(report.message), report.conceptId ?? '', fold(report.selectedText ?? '')].join('\u0000'));
}

/**
 * Why a report looks like garbage, or null.
 * @param {Report} report @param {FeedbackState} state @returns {Garbage | null}
 */
export function garbageReason(report, state) {
  const letters = report.message.match(/\p{L}/gu)?.length ?? 0;
  if (!letters) return 'letters';
  if (letters < 2) return 'short';
  const compact = fold(report.message).replace(/ /g, '');
  if (/^(.{1,3})\1{2,}$/u.test(compact) || /(.)\1{9}/u.test(compact)) return 'repeated';
  if (state.recent.includes(fingerprint(report))) return 'duplicate';
  return null;
}

/**
 * Whether another report may be sent now, and if not, how long to wait.
 * @param {FeedbackState} state @param {number} now @param {Limits} [limits]
 * @returns {{ reason: 'gap' | 'burst' | 'daily', waitMs: number } | null}
 */
export function rateLimit(state, now, limits = LIMITS) {
  const sent = state.sent.filter((t) => t <= now && now - t < limits.dailyMs).sort((a, b) => a - b);
  if (sent.length >= limits.daily) return { reason: 'daily', waitMs: sent[sent.length - limits.daily] + limits.dailyMs - now };
  const burst = sent.filter((t) => now - t < limits.burstMs);
  if (burst.length >= limits.burst) return { reason: 'burst', waitMs: burst[burst.length - limits.burst] + limits.burstMs - now };
  const last = sent.at(-1);
  if (last !== undefined && now - last < limits.gapMs) return { reason: 'gap', waitMs: last + limits.gapMs - now };
  return null;
}

/**
 * What to do with a report: wait (rate limit), confirm (looks like garbage), drop (garbage from the 10th on:
 * say thanks, send nothing) or send.
 * @param {FeedbackState} state @param {Report} report @param {number} now
 * @param {{ confirmed?: boolean, limits?: Limits }} [opts] confirmed: the user chose "Send anyway"
 * @returns {Decision}
 */
export function decide(state, report, now, { confirmed = false, limits = LIMITS } = {}) {
  const limit = rateLimit(state, now, limits);
  if (limit) return { action: 'wait', ...limit };
  const garbage = garbageReason(report, state);
  if (!garbage) return { action: 'send', garbage: false };
  if (state.garbage >= limits.garbage) return { action: 'drop', garbage: true };
  if (!confirmed) return { action: 'confirm', reason: garbage };
  return { action: state.garbage + 1 >= limits.garbage ? 'drop' : 'send', garbage: true };
}

/**
 * The state after a report was sent or dropped.
 * @param {FeedbackState} state @param {Report} report @param {number} now @param {boolean} garbage
 * @param {Limits} [limits] @returns {FeedbackState}
 */
export function record(state, report, now, garbage, limits = LIMITS) {
  const print = fingerprint(report);
  return {
    ...state,
    sent: [...state.sent.filter((t) => t <= now && now - t < limits.dailyMs), now],
    garbage: state.garbage + (garbage ? 1 : 0),
    recent: [...state.recent.filter((p) => p !== print), print].slice(-limits.recent),
  };
}

/**
 * The JSON fields feedback/Code.gs reads, each cut to its column limit.
 * @param {Report} report
 * @param {{ clientId: string, now: Date, learning: string, known: string, configUrl: string,
 *   appVersion: string, dataVersion: string, browserLang: string }} env
 */
export function payload(report, env) {
  const cut = (/** @type {string | undefined} */ value, /** @type {number} */ max) => (value ?? '').slice(0, max);
  return {
    clientId: env.clientId,
    clientTime: env.now.toISOString(),
    tzOffsetMin: env.now.getTimezoneOffset(),
    category: cut(report.category, 32),
    message: cut(report.message, 4000),
    email: cut(report.email, 254),
    selectedText: cut(report.selectedText, 1000),
    conceptId: cut(report.conceptId, 80),
    direction: cut(report.direction, 16),
    side: cut(report.side, 16),
    field: cut(report.field, 40),
    learning: cut(env.learning, 12),
    known: cut(env.known, 12),
    configUrl: cut(env.configUrl, 1000),
    appVersion: cut(env.appVersion, 40),
    dataVersion: cut(env.dataVersion, 40),
    browserLang: cut(env.browserLang, 40),
    website: cut(report.website, 100),
  };
}

/** feedback/Code.gs refuses longer bodies. */
export const MAX_BODY = 8000;

/**
 * The request body, within MAX_BODY: escaping can make a long message longer than its 4,000 characters,
 * so the message, then the quote, are shortened until it fits.
 * @param {ReturnType<typeof payload>} data
 */
export function requestBody(data) {
  let json = JSON.stringify(data);
  for (const key of /** @type {const} */ (['message', 'selectedText'])) {
    while (json.length > MAX_BODY && data[key]) {
      data = { ...data, [key]: data[key].slice(0, Math.max(0, data[key].length - (json.length - MAX_BODY))) };
      json = JSON.stringify(data);
    }
  }
  return json;
}

/** @typedef {{ ok: true } | { ok: false, error: string }} SendResult */

/**
 * POST a report. A text/plain body keeps it a simple request, without a CORS preflight. The script answers
 * {ok: true} or {ok: false, error}. If the answer can't be read (a CORS failure), the report goes once more
 * without reading the answer, and counts as sent.
 * @param {string} body
 * @param {{ endpoint: string, fetch?: typeof globalThis.fetch, timeoutMs?: number }} opts
 * @returns {Promise<SendResult>}
 */
export async function send(body, { endpoint, fetch = globalThis.fetch, timeoutMs = 20_000 }) {
  /** @type {RequestInit} */
  const init = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body };
  /** @type {Response} */
  let res;
  try {
    res = await fetch(endpoint, { ...init, signal: AbortSignal.timeout?.(timeoutMs) });
  } catch (error) {
    const name = /** @type {any} */ (error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') return { ok: false, error: 'timeout' };
    try {
      await fetch(endpoint, { ...init, mode: 'no-cors' });
      return { ok: true };
    } catch {
      return { ok: false, error: 'network' };
    }
  }
  const data = await res.json().catch(() => null);
  if (data?.ok === true) return { ok: true };
  return { ok: false, error: typeof data?.error === 'string' ? data.error : `http_${res.status}` };
}

/** A UUID v4. crypto.randomUUID needs a secure context; getRandomValues works everywhere. @param {Crypto} [crypto] */
export function randomId(crypto = globalThis.crypto) {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The saved state, or a new one with a new client ID (saved at once, so the ID stays the same).
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null} storage @param {() => string} [newId]
 * @returns {FeedbackState}
 */
export function loadState(storage, newId = randomId) {
  /** @type {any} */
  let raw = null;
  try {
    raw = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // unreadable or blocked storage: start over
  }
  const valid = Boolean(raw) && typeof raw === 'object' && CLIENT_ID.test(String(raw.clientId));
  /** @type {FeedbackState} */
  const state = {
    clientId: valid ? raw.clientId : newId(),
    sent: valid && Array.isArray(raw.sent) ? raw.sent.filter(Number.isFinite) : [],
    garbage: valid && Number.isInteger(raw.garbage) && raw.garbage > 0 ? raw.garbage : 0,
    recent: valid && Array.isArray(raw.recent) ? raw.recent.filter((/** @type {unknown} */ p) => typeof p === 'string') : [],
  };
  if (!valid) saveState(storage, state);
  return state;
}

/** @param {Pick<Storage, 'setItem'> | null} storage @param {FeedbackState} state */
export function saveState(storage, state) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or disabled: the limits then last for this page only
  }
}
