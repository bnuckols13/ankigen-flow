import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelGroups, stringifyLabels } from '../tools/lib/data.mjs';

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
