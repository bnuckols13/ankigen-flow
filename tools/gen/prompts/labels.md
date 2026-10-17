# Unit type: labels — card captions in one language

Input: `node tools/gen/plan.mjs show labels:<code>` gives the key list and the English and Russian labels.

Translate every key into the target language as a **short caption** for a flashcard (grey small text). Use the conventional grammatical terms and abbreviations of that language's school/dictionary tradition (e.g. de "Gen.", "Pl.", "Präteritum"; ja "複数形", "過去形"; fr "pl.", "f."). Values for `value.*` keys name grammatical categories (perfective, godan…) in that language. `form.1sg` etc. are personal pronouns of the target language when that is clearer than an abbreviation (de "ich", fr "je").

Output `tmp/labels__<code>.json`:

```json
{ "unit": "labels:de", "labels": { "section.forms": "Formen", "pos.noun": "Subst.", "gender.m": "m.", "...": "..." } }
```

All keys are required. Merge with `node tools/gen/merge-unit.mjs <file>`.
