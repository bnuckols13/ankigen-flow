import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exampleHtml, stripFurigana, stripTarget, wordRubyHtml } from '../src/text/furigana.js';

const jaExamples = JSON.parse(fs.readFileSync(new URL('./fixtures/data/ex/ja/core-1.json', import.meta.url), 'utf8'));

test('furigana with the space rule becomes ruby; the target becomes <b class="t">', () => {
  assert.equal(
    exampleHtml('{水[みず]}を 一杯[いっぱい]ください。', { furigana: 'ruby' }),
    '<b class="t"><ruby>水<rt>みず</rt></ruby></b>を<ruby>一杯<rt>いっぱい</rt></ruby>ください。',
  );
  assert.equal(
    exampleHtml('私[わたし]たちはいつも 七時[しちじ]に 夕飯[ゆうはん]を{食[た]べます}。', { furigana: 'ruby' }),
    '<ruby>私<rt>わたし</rt></ruby>たちはいつも<ruby>七時<rt>しちじ</rt></ruby>に<ruby>夕飯<rt>ゆうはん</rt></ruby>を<b class="t"><ruby>食<rt>た</rt></ruby>べます</b>。',
  );
  assert.equal(exampleHtml('手伝[てつだ]ってくれて{ありがとう}！', { furigana: 'ruby' }), '<ruby>手伝<rt>てつだ</rt></ruby>ってくれて<b class="t">ありがとう</b>！');
  assert.equal(
    exampleHtml('プレゼント、 本当[ほんとう]に{ありがとうございます}。', { furigana: 'ruby' }),
    'プレゼント、<ruby>本当<rt>ほんとう</rt></ruby>に<b class="t">ありがとうございます</b>。',
  );
});

test('furigana can be stripped to plain kanji', () => {
  assert.equal(exampleHtml('{水[みず]}を 一杯[いっぱい]ください。', { furigana: 'strip' }), '<b class="t">水</b>を一杯ください。');
  assert.equal(stripFurigana('私[わたし]は 水[みず]を 飲[の]みます'), '私は水を飲みます');
});

test('every fixture sentence renders cleanly both ways', () => {
  for (const [id, slots] of Object.entries(jaExamples)) {
    for (const { t } of slots) {
      for (const furigana of /** @type {const} */ (['ruby', 'strip'])) {
        const html = exampleHtml(t, { furigana });
        assert.equal((html.match(/<b class="t">/g) || []).length, 1, `${id}: ${t}`);
        assert.doesNotMatch(html, /[[\]{}]/, `${id}: ${t}`);
        assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), / /, `${id}: no separator spaces left in ${t}`);
      }
      assert.match(exampleHtml(t, { furigana: 'ruby' }), /<ruby>/, `${id}: ${t}`);
      assert.doesNotMatch(exampleHtml(t, { furigana: 'strip' }), /<ruby>/, `${id}: ${t}`);
    }
  }
});

test('other languages: target only, text escaped', () => {
  assert.equal(exampleHtml('Can I have a glass of {water}, please?'), 'Can I have a glass of <b class="t">water</b>, please?');
  assert.equal(exampleHtml('Tom & {Jerry} <3'), 'Tom &amp; <b class="t">Jerry</b> &lt;3');
  assert.equal(exampleHtml('no target here'), 'no target here');
  assert.equal(stripTarget('Можно мне стакан {воды́}, пожалуйста?'), 'Можно мне стакан воды́, пожалуйста?');
});

test('word ruby spans the kanji part and leaves shared kana outside', () => {
  assert.equal(wordRubyHtml('食べる', 'たべる'), '<ruby>食<rt>た</rt></ruby>べる');
  assert.equal(wordRubyHtml('大きい', 'おおきい'), '<ruby>大<rt>おお</rt></ruby>きい');
  assert.equal(wordRubyHtml('勉強する', 'べんきょうする'), '<ruby>勉強<rt>べんきょう</rt></ruby>する');
  assert.equal(wordRubyHtml('お茶', 'おちゃ'), 'お<ruby>茶<rt>ちゃ</rt></ruby>');
  assert.equal(wordRubyHtml('月曜日', 'げつようび'), '<ruby>月曜日<rt>げつようび</rt></ruby>');
  assert.equal(wordRubyHtml('住民票', 'じゅうみんひょう'), '<ruby>住民票<rt>じゅうみんひょう</rt></ruby>');
  assert.equal(wordRubyHtml('テレビ局', 'テレビきょく'), 'テレビ<ruby>局<rt>きょく</rt></ruby>');
  assert.equal(wordRubyHtml('ありがとう', undefined), 'ありがとう');
  assert.equal(wordRubyHtml('コーヒー', 'コーヒー'), 'コーヒー');
});
