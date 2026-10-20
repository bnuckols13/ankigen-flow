import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLoader, safeDataDir } from '../src/data/loader.js';
import { fixtureLoader, readJsonFile } from './helpers/fixtures.mjs';
import { paths, loadRegistry, loadConcepts } from '../tools/lib/data.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));

test('per-file mode: canonical order matches the data tools', async () => {
  const loader = fixtureLoader();
  const concepts = await loader.getConcepts();
  const p = paths(path.join(REPO, 'tests/fixtures/data'), path.join(REPO, 'data/meta'));
  const tool = loadConcepts(p, loadRegistry(p.meta), []);
  assert.deepEqual(concepts.order, tool.order);
  assert.equal(concepts.byId.get('word-day-24h')?.module, 'time');
  assert.equal(concepts.byId.get('word-water')?.rank, 0);
});

test('per-file mode: layers load, missing files are empty', async () => {
  const loader = fixtureLoader();
  const ru = await loader.getLanguage('ru');
  assert.equal(ru.lang.get('word-water').w, 'вода́');
  assert.equal(ru.ex.get('word-water').length, 3);
  assert.equal(ru.ipa.get('word-water'), 'vɐˈda');
  assert.ok(ru.etym.get('word-water'));
  const zh = await loader.getLanguage('zh'); // no zh files in the golden sample
  assert.deepEqual([zh.lang.size, zh.ex.size, zh.ipa.size, zh.etym.size], [0, 0, 0, 0]);
  assert.match((await loader.getCardCss()) ?? '', /\.card/);
});

test('bundle mode reads bundles/<version>/ and caches every request', async () => {
  const meta = await fixtureLoader().getMeta();
  /** @type {Record<string, any>} */
  const files = {
    'data/meta/version.json': { data: '2026.10.17', schema: 1 },
    'bundles/2026.10.17/meta.json': meta,
    'bundles/2026.10.17/concepts.json': { time: { 'word-b': { pos: 'noun', mods: ['time'] } }, 'core-1': { 'word-a': { pos: 'noun', mods: ['core-1'] } } },
    'bundles/2026.10.17/ru.json': { lang: { 'word-a': { w: 'а' } }, ipa: { 'word-a': 'a' } },
  };
  /** @type {string[]} */
  const requested = [];
  const loader = createLoader({ fetchJson: async (p) => (requested.push(p), files[p] ?? null), fetchText: async () => '' });
  const concepts = await loader.getConcepts();
  assert.deepEqual(concepts.order, ['word-a', 'word-b'], 'module tree order, not bundle key order');
  const ru = await loader.getLanguage('ru');
  await loader.getLanguage('ru');
  assert.equal(ru.lang.get('word-a').w, 'а');
  assert.equal(ru.ex.size, 0);
  assert.equal((await loader.getLanguage('de')).lang.size, 0, 'a missing language bundle is empty');
  assert.equal(requested.filter((p) => p.endsWith('ru.json')).length, 1);
  assert.ok(!requested.some((p) => p.startsWith('data/concepts')), 'no per-file requests');
});

test('without bundles the loader falls back to data/', async () => {
  /** @type {string[]} */
  const requested = [];
  const loader = createLoader({ fetchJson: async (p) => (requested.push(p), readJsonFile(p)) });
  const meta = await loader.getMeta();
  assert.ok(meta.languages.active.includes('ja'));
  await loader.getConcepts();
  assert.ok(requested.includes('data/concepts/core-1.json'));
});

test('meta is required; vocabulary is not', async () => {
  const loader = createLoader({ fetchJson: async () => null });
  await assert.rejects(loader.getMeta(), /data\/meta/);
});

test('the ?data= override accepts only plain relative directories', () => {
  assert.equal(safeDataDir('tests/fixtures/data'), 'tests/fixtures/data');
  assert.equal(safeDataDir('tests/fixtures/data/'), 'tests/fixtures/data');
  for (const bad of ['https://example.com/data', '//example.com', '../data', 'tests/../../x', '/etc', '', null]) {
    assert.equal(safeDataDir(bad), null, String(bad));
  }
});
