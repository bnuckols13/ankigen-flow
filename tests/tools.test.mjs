import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { labelGroups, stringifyLabels } from '../tools/lib/data.mjs';
import { loadSqlJs } from '../tools/lib/sqljs.mjs';
import { apkgFileName, buildApkg } from '../src/deck/apkg.js';
import { fixtureDeck } from './helpers/fixtures.mjs';

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
