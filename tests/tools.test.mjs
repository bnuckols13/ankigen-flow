import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { labelGroups, stringifyLabels } from '../tools/lib/data.mjs';
import { loadSqlJs } from '../tools/lib/sqljs.mjs';
import { buildApkg } from '../src/deck/apkg.js';
import { apkgFileName } from '../src/deck/names.js';
import { createLoader } from '../src/data/loader.js';
import { fixtureDeck, fixtureLoader } from './helpers/fixtures.mjs';

const REPO = new URL('..', import.meta.url);
/** Run a tool from the repository root. @param {string[]} args */
const run = (args) => execFileSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', stdio: 'pipe' });
/** A tool's exit code and output, also when it fails. @param {string[]} args */
function runStatus(args) {
  try {
    return { status: 0, stdout: run(args) };
  } catch (error) {
    const e = /** @type {any} */ (error);
    return { status: e.status, stdout: String(e.stdout) + String(e.stderr) };
  }
}

test('labels.json layout: one line per key group, languages in registry order', () => {
  const keys = ['section.forms', 'section.ipa', 'pos.noun', 'form.gen', 'form.pl', 'form.aspect', 'form.pp', 'form.class', 'value.aspect.pf', 'value.class.godan'];
  assert.deepEqual(labelGroups(keys), [
    ['section.forms', 'section.ipa'], ['pos.noun'], ['form.gen', 'form.pl'], ['form.aspect', 'form.pp'], ['form.class'], ['value.aspect.pf'], ['value.class.godan'],
  ]);
  const data = { $comment: 'c', keys: ['pos.noun', 'pos.verb', 'reg.formal'], labels: { ru: { 'pos.noun': 'сущ.' }, en: { 'pos.noun': 'noun', 'pos.verb': 'verb', 'reg.formal': 'formal', extra: 'x' }, xx: {} } };
  const text = stringifyLabels(data, ['en', 'ru']);
  assert.equal(
    text,
    [
      '{',
      '  "$comment": "c",',
      '  "keys": [',
      '    "pos.noun", "pos.verb",',
      '    "reg.formal"',
      '  ],',
      '  "labels": {',
      '    "en": {',
      '      "pos.noun": "noun", "pos.verb": "verb",',
      '      "reg.formal": "formal",',
      '      "extra": "x"',
      '    },',
      '    "ru": {',
      '      "pos.noun": "сущ."',
      '    },',
      '    "xx": {}',
      '  }',
      '}',
      '',
    ].join('\n'),
  );
  assert.deepEqual(JSON.parse(text), data, 'content is unchanged');
});

test('tools/apkg.mjs writes the same package as buildApkg for a config hash', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ankigen-apkg-'));
  try {
    const now = 1_792_300_000_000;
    const args = ['tools/apkg.mjs', '#v1&l=ru&k=en&m=core-1,time&r=1', '--data', 'tests/fixtures/data', '--out', out, '--now', String(now)];
    const stdout = execFileSync(process.execPath, args, { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    assert.match(stdout, /AnkiGen::Русский \(English\), 11 notes, 22 cards/);
    const deck = await fixtureDeck({ learn: 'ru', know: 'en', modules: ['core-1', 'time'], reverse: true });
    const file = path.join(out, apkgFileName(deck.config, deck.meta));
    const expected = await buildApkg({ SQL: await loadSqlJs(), config: deck.config, meta: deck.meta, deck, now });
    assert.deepEqual(new Uint8Array(fs.readFileSync(file)), expected);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('tools/bundle.mjs: the site serves the same data from its bundles as the source files do', async () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'ankigen-site-'));
  try {
    const stdout = run(['tools/bundle.mjs', '--site', site, '--data', 'tests/fixtures/data']);
    const version = JSON.parse(fs.readFileSync(new URL('data/meta/version.json', REPO), 'utf8')).data;
    assert.match(stdout, new RegExp(`data ${version.replace(/\./g, '\\.')}`));
    const bundles = fs.readdirSync(path.join(site, 'bundles', version)).sort();
    assert.deepEqual(bundles, ['concepts.json', 'de.json', 'en.json', 'ja.json', 'meta.json', 'ru.json', 'sr.json'], 'one bundle per language with data');
    for (const file of ['index.html', '404.html', 'og-image.png', 'favicon.svg', 'src/main.js', 'src/deck/apkg.js', 'vendor/sql-wasm.wasm', 'data/meta/version.json']) {
      assert.ok(fs.existsSync(path.join(site, file)), `the site has ${file}`);
    }
    for (const file of ['docs', 'tools', 'tests', 'feedback', '.env', 'package.json', 'CLAUDE.md', 'data/concepts', 'data/lang']) {
      assert.ok(!fs.existsSync(path.join(site, file)), `the site leaves out ${file}`);
    }

    // The browser's loader, reading the site: it takes the bundles, and gets what the source files give.
    /** @type {string[]} */
    const fetched = [];
    const fromSite = createLoader({
      fetchJson: async (p) => {
        fetched.push(p);
        const file = path.join(site, p);
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      },
      fetchText: async () => '',
    });
    const fromSource = fixtureLoader();
    assert.deepEqual(await fromSite.getMeta(), await fromSource.getMeta());
    const [bundled, source] = [await fromSite.getConcepts(), await fromSource.getConcepts()];
    assert.deepEqual(bundled.order, source.order);
    for (const [id, record] of source.byId) {
      const { note, ...concept } = record.c;
      assert.deepEqual(bundled.byId.get(id), { ...record, c: concept }, `${id}, without its author note`);
    }
    for (const code of ['en', 'ru', 'ja', 'de', 'sr', 'zh']) {
      assert.deepEqual(await fromSite.getLanguage(code), await fromSource.getLanguage(code), code);
    }
    assert.ok(fetched.includes(`bundles/${version}/concepts.json`) && !fetched.some((p) => p.startsWith('data/concepts')), 'read from the bundles');

    // Same data, same bytes; and the next build replaces the site.
    const before = fs.readFileSync(path.join(site, 'bundles', version, 'en.json'));
    run(['tools/bundle.mjs', '--site', site, '--data', 'tests/fixtures/data']);
    assert.deepEqual(fs.readFileSync(path.join(site, 'bundles', version, 'en.json')), before);
  } finally {
    fs.rmSync(site, { recursive: true, force: true });
  }
});

test('tools/bundle.mjs never replaces a directory it did not build', () => {
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'ankigen-other-'));
  try {
    fs.writeFileSync(path.join(other, 'keep.txt'), 'mine');
    const refused = runStatus(['tools/bundle.mjs', '--site', other, '--data', 'tests/fixtures/data']);
    assert.equal(refused.status, 1);
    assert.match(refused.stdout, /refusing to replace .*not built by tools\/bundle\.mjs/);
    assert.equal(fs.readFileSync(path.join(other, 'keep.txt'), 'utf8'), 'mine');
    const root = runStatus(['tools/bundle.mjs', '--site', '.', '--data', 'tests/fixtures/data']);
    assert.equal(root.status, 1);
    assert.match(root.stdout, /refusing to replace .*contains the repository/);
  } finally {
    fs.rmSync(other, { recursive: true, force: true });
  }
});

test('lint-data --gate: the deploy needs an entry for every concept in every active language', () => {
  const failing = runStatus(['tools/lint-data.mjs', '--data', 'tests/fixtures/data', '--meta', 'data/meta', '--gate']);
  assert.equal(failing.status, 1);
  assert.match(failing.stdout, /Deploy gate: 10 active language\(s\) incomplete: zh 0\/15, es 0\/15/);

  // A registry with only the fixture languages active passes.
  const meta = fs.mkdtempSync(path.join(os.tmpdir(), 'ankigen-meta-'));
  try {
    fs.cpSync(new URL('data/meta', REPO), meta, { recursive: true });
    const languages = JSON.parse(fs.readFileSync(path.join(meta, 'languages.json'), 'utf8'));
    const five = ['en', 'ru', 'sr', 'ja', 'de'];
    languages.deferred = [...languages.active.filter((/** @type {string} */ c) => !five.includes(c)), ...languages.deferred];
    languages.active = five;
    fs.writeFileSync(path.join(meta, 'languages.json'), JSON.stringify(languages));
    const passing = runStatus(['tools/lint-data.mjs', '--data', 'tests/fixtures/data', '--meta', meta, '--gate']);
    assert.match(passing.stdout, /Deploy gate: every active language has an entry for every concept/);
    assert.equal(passing.status, 0, passing.stdout);
  } finally {
    fs.rmSync(meta, { recursive: true, force: true });
  }
});
