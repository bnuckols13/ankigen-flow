// Feedback (SPEC §5, ARCHITECTURE §9): client limits, garbage heuristics, the payload and the POST, checked
// against what feedback/Code.gs reads and accepts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EMAIL, MAX_BODY, STORAGE_KEY, decide, fingerprint, garbageReason, loadState, payload, randomId, rateLimit, record,
  requestBody, saveState, send,
} from '../src/feedback/client.js';
import { placeText, sendErrorText, waitText } from '../src/ui/feedback-dialog.js';

const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;
const T0 = Date.UTC(2026, 9, 17, 12);

const fresh = () => ({ clientId: 'test-client-1', sent: [], garbage: 0, recent: [] });
/** @param {string} message @param {Record<string, string>} [extra] */
const report = (message, extra = {}) => ({ message, ...extra });

// The backend's contract, read from the script itself.
const gs = fs.readFileSync(new URL('../feedback/Code.gs', import.meta.url), 'utf8');
const KEY_MAP = Object.fromEntries([.../** @type {string} */ (gs.match(/var KEY_MAP = \{([\s\S]*?)\};/)?.[1]).matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
const CAPS = Object.fromEntries([.../** @type {string} */ (gs.match(/var COLUMNS = \[([\s\S]*?)\n\];/)?.[1]).matchAll(/\['(\w+)', (\d+|null)\]/g)].map((m) => [m[1], m[2] === 'null' ? null : Number(m[2])]));

test('garbage: no letters, a single letter, repeated characters, the same report again', () => {
  const state = fresh();
  /** @type {[string, string][]} */
  const garbage = [['!!!', 'letters'], ['12345', 'letters'], ['x', 'short'], ['水', 'short'], ['aaaa', 'repeated'], ['asdasdasd', 'repeated'], ['ха ха ха', 'repeated'], ['ok aaaaaaaaaa', 'repeated']];
  for (const [message, reason] of garbage) assert.equal(garbageReason(report(message), state), reason, message);
  for (const message of ['ok', 'typo', '错字', 'мама', '“вада” should be вода', 'Wrong gender: das See → der See']) {
    assert.equal(garbageReason(report(message), state), null, message);
  }
  const sent = record(state, report('typo', { conceptId: 'word-water' }), T0, false);
  assert.equal(garbageReason(report('Typo!', { conceptId: 'word-water' }), sent), 'duplicate', 'compared folded, like search');
  assert.equal(garbageReason(report('typo', { conceptId: 'word-eat' }), sent), null, 'the same words about another card');
  assert.equal(garbageReason(report('typo', { conceptId: 'word-water', selectedText: 'вада' }), sent), null, 'or another quote');
});

test('rate limits: 15 s between reports, 5 in 10 minutes, 20 in 24 hours', () => {
  let state = record(fresh(), report('one'), T0, false);
  assert.deepEqual(rateLimit(state, T0 + 5 * S), { reason: 'gap', waitMs: 10 * S });
  assert.equal(rateLimit(state, T0 + 15 * S), null);
  for (let i = 1; i < 5; i++) state = record(state, report(`report ${i}`), T0 + i * MIN, false);
  assert.deepEqual(rateLimit(state, T0 + 5 * MIN), { reason: 'burst', waitMs: 5 * MIN }, 'the first of 5 leaves the window at 10 minutes');
  assert.equal(rateLimit(state, T0 + 10 * MIN), null);

  let day = fresh();
  for (let i = 0; i < 20; i++) day = record(day, report(`report ${i}`), T0 + i * H, false);
  assert.deepEqual(rateLimit(day, T0 + 20 * H), { reason: 'daily', waitMs: 4 * H });
  assert.equal(rateLimit(day, T0 + 24 * H), null);
  assert.equal(record(day, report('late'), T0 + 30 * H, false).sent.length, 14, 'sends older than a day are forgotten'); // hours 7–19, and this one

  assert.equal(rateLimit(record(fresh(), report('x'), T0 + H, false), T0), null, 'a clock set back locks no one out');
});

test('garbage is sent only when confirmed; from the 10th on it is dropped with thanks, and real reports still go out', () => {
  let state = fresh();
  assert.deepEqual(decide(state, report('Wrong translation'), T0), { action: 'send', garbage: false });
  assert.deepEqual(decide(state, report('x'), T0), { action: 'confirm', reason: 'short' });
  assert.deepEqual(decide(state, report('x'), T0, { confirmed: true }), { action: 'send', garbage: true });
  for (let i = 0; i < 9; i++) state = record(state, report(`? ${i}`), T0 + i * H, true);
  const t = T0 + 9 * H;
  assert.deepEqual(decide(state, report('x'), t), { action: 'confirm', reason: 'short' }, 'the 10th garbage report still asks');
  assert.deepEqual(decide(state, report('x'), t, { confirmed: true }), { action: 'drop', garbage: true }, 'and is dropped');
  state = record(state, report('x'), t, true);
  assert.deepEqual(decide(state, report('y'), t + H), { action: 'drop', garbage: true }, 'later garbage is dropped without asking');
  assert.deepEqual(decide(state, report('The plural of вода is wrong'), t + H), { action: 'send', garbage: false }, 'real reports still go out');
  assert.equal(decide(state, report('The plural of вода is wrong'), t + 5 * S).action, 'wait', 'rate limits still apply');
});

test('the payload has the keys feedback/Code.gs reads, within its column limits', () => {
  const long = (/** @type {number} */ n) => 'x'.repeat(n);
  const data = payload(
    { message: long(5000), category: long(50), email: long(300), selectedText: long(2000), conceptId: long(100), direction: long(20), side: long(20), field: long(50), website: '' },
    { clientId: 'abcd-1234', now: new Date(T0), learning: 'ru', known: 'en', configUrl: long(1200), appVersion: '0.1.0', dataVersion: '2026.10.17', browserLang: 'ru-RU' },
  );
  assert.deepEqual(Object.keys(data).sort(), [...Object.values(KEY_MAP), 'website'].sort());
  for (const [column, key] of Object.entries(KEY_MAP)) {
    const cap = CAPS[column];
    if (cap) assert.ok(String(/** @type {any} */ (data)[key]).length <= cap, `${key} fits ${column} (${cap})`);
  }
  assert.equal(data.message.length, 4000);
  assert.equal(data.clientTime, '2026-10-17T12:00:00.000Z');
  assert.equal(typeof data.tzOffsetMin, 'number');
  assert.equal(MAX_BODY, Number(gs.match(/var MAX_BODY_CHARS = (\d+);/)?.[1]));
  assert.ok(gs.includes(EMAIL.source), 'the same email check as the server');
});

test('the body stays within the server limit, even when escaping makes a message longer', () => {
  const env = { clientId: 'abcd-1234', now: new Date(T0), learning: 'ja', known: 'ru', configUrl: 'https://xenohunter.github.io/ankigen/#v1&l=ja&k=ru', appVersion: '0.1.0', dataVersion: '2026.10.17', browserLang: 'ru' };
  const big = payload(report('"\n'.repeat(2000), { selectedText: '\\'.repeat(1000) }), env);
  const body = requestBody(big);
  assert.ok(body.length <= MAX_BODY, String(body.length));
  assert.ok(JSON.parse(body).message.length > 1500, 'only what does not fit is cut');
  const small = payload(report('The reading of 今日 is wrong'), env);
  assert.equal(requestBody(small), JSON.stringify(small));
});

test('send: POSTs text/plain, reads {ok}, and falls back to no-cors when the answer cannot be read', async () => {
  /** @type {RequestInit[]} */
  const calls = [];
  /** @param {any[]} answers */
  const fake = (answers) => async (/** @type {string} */ _url, /** @type {RequestInit} */ init) => {
    calls.push(init);
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return new Response(typeof answer === 'string' ? answer : JSON.stringify(answer));
  };
  assert.deepEqual(await send('{"message":"hi"}', { endpoint: 'https://example.test/exec', fetch: fake([{ ok: true }]) }), { ok: true });
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].headers, { 'Content-Type': 'text/plain;charset=utf-8' });
  assert.equal(calls[0].body, '{"message":"hi"}');
  assert.deepEqual(await send('{}', { endpoint: 'x', fetch: fake([{ ok: false, error: 'client_cap' }]) }), { ok: false, error: 'client_cap' });
  assert.deepEqual(await send('{}', { endpoint: 'x', fetch: fake(['<html>quota</html>']) }), { ok: false, error: 'http_200' });

  calls.length = 0;
  assert.deepEqual(await send('{}', { endpoint: 'x', fetch: fake([new TypeError('Failed to fetch'), '']) }), { ok: true });
  assert.deepEqual(calls.map((c) => c.mode ?? 'cors'), ['cors', 'no-cors']);
  assert.deepEqual(await send('{}', { endpoint: 'x', fetch: fake([new TypeError('offline'), new TypeError('offline')]) }), { ok: false, error: 'network' });
  const timeout = Object.assign(new Error('slow'), { name: 'TimeoutError' });
  assert.deepEqual(await send('{}', { endpoint: 'x', fetch: fake([timeout]) }), { ok: false, error: 'timeout' }, 'a timeout is not sent twice');
});

test('state: one client ID, kept; bad or missing storage starts over', () => {
  /** @type {Map<string, string>} */
  const store = new Map();
  const storage = { getItem: (/** @type {string} */ k) => store.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => void store.set(k, v) };
  const state = loadState(storage, () => 'id-aaaaaaaa');
  assert.equal(state.clientId, 'id-aaaaaaaa');
  assert.ok(store.has(STORAGE_KEY), 'a new ID is saved at once');
  assert.equal(loadState(storage, () => 'id-bbbbbbbb').clientId, 'id-aaaaaaaa');
  saveState(storage, record(state, report('hi there'), 5, true));
  assert.deepEqual(loadState(storage), { clientId: 'id-aaaaaaaa', sent: [5], garbage: 1, recent: [fingerprint(report('hi there'))] });

  store.set(STORAGE_KEY, '{not json');
  assert.equal(loadState(storage, () => 'id-cccccccc').clientId, 'id-cccccccc');
  store.set(STORAGE_KEY, JSON.stringify({ clientId: 'not valid', garbage: 99 }));
  assert.deepEqual(loadState(storage, () => 'id-dddddddd'), { clientId: 'id-dddddddd', sent: [], garbage: 0, recent: [] });
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(loadState(denied, () => 'id-eeeeeeee').clientId, 'id-eeeeeeee');
  assert.equal(loadState(null, () => 'id-ffffffff').clientId, 'id-ffffffff');
});

test('client IDs are UUIDs the server accepts, with or without crypto.randomUUID', () => {
  const server = /^[A-Za-z0-9-]{8,64}$/; // feedback/Code.gs
  assert.ok(gs.includes(server.source));
  assert.match(randomId(), server);
  const insecure = /** @type {Crypto} */ (/** @type {unknown} */ ({ getRandomValues: (/** @type {Uint8Array} */ a) => crypto.getRandomValues(a) }));
  assert.match(randomId(insecure), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('dialog text: how long to wait, what went wrong, where a report points', () => {
  assert.equal(waitText({ reason: 'gap', waitMs: 11_200 }), 'Please wait 12 seconds before sending another report.');
  assert.equal(waitText({ reason: 'burst', waitMs: 61 * S }), 'You’ve sent several reports in a few minutes. Please try again in 2 minutes.');
  assert.match(waitText({ reason: 'daily', waitMs: 3.2 * H }), /send more in 4 hours\.$/);
  assert.equal(placeText({ direction: 'forward', side: 'back', field: 'Examples' }, false), 'forward card, back, examples');
  assert.equal(placeText({ field: 'Translation' }, true), 'definition');
  assert.equal(placeText({ field: 'WordRuby' }, false), 'word');
  assert.equal(placeText({}, false), '');
  for (const error of ['network', 'timeout', 'daily_cap', 'client_cap', 'bad_email', 'too_large', 'empty', 'server', 'http_500']) {
    assert.ok(sendErrorText(error).endsWith('.'), error);
  }
});
