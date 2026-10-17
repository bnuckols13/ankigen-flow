# AnkiGen: architecture

Audience: the engineer (Claude Code) implementing the web app. Product decisions are in `SPEC.md` and the data contract is in `DATA_FORMAT.md`. This file explains how the pieces fit together.

## 1. Constraints

- **Static site on GitHub Pages** at `https://xenohunter.github.io/ankigen/`. It is served under `/ankigen/`, so use only relative URLs. No server code except the feedback Apps Script.
- **No build step for the app.** Native ES modules, vanilla JS with JSDoc types (`// @ts-check` on every module), plain CSS. Dependencies are **vendored** with pinned versions in `vendor/` (no CDN at runtime):
  - `sql.js` (WASM SQLite)
  - `fflate` (zip)
- **Deterministic** deck content: same data version and same config give the same notes, fields, IDs and order. Only export timestamps vary (see §7.4).
- **Fast**: initial page JS ≤ 60 KB gzipped (excluding sql.js, which is lazy-loaded). First paint < 1 s on a mid-range phone.
- Works offline once loaded (nice-to-have: a tiny service worker caching app + fetched data).

## 2. Repository layout

```
index.html              single page; semantic HTML, SEO meta, noscript description
404.html                redirect to /
robots.txt, sitemap.xml, og-image.png, favicon.svg
css/app.css             page styles (light/dark via prefers-color-scheme)
css/card.css            card styles; SAME file is embedded into the Anki note type
src/
  main.js               bootstrap, wiring
  config.js             constants: feedback endpoint URL, repo URL, Patreon URL, app version
  state.js              config model, defaults, validation, URL-hash codec, localStorage
  data/loader.js        fetch meta, concepts, layer files or bundles; caching; graceful misses
  deck/select.js        which concepts become which notes, in which order (merges, disambiguators)
  deck/fields.js        per-note field HTML (word, translation, forms, examples, …)
  deck/templates.js     Anki templates + CSS for a config
  deck/render.js        mini Anki template renderer for preview/sidebar
  deck/ids.js           stable hashes → GUIDs, note/card/deck/model IDs, Anki checksum
  deck/apkg.js          SQLite collection (schema 11) + zip → Blob
  text/translit.js      ru → Latin, sr Cyrillic ↔ Latin, hy → Latin (BGN/PCGN), el → Latin (ELOT 743)
  text/normalize.js     search folding (case, diacritics, stress, scripts)
  text/furigana.js      Anki-style furigana → <ruby>; target braces → <b>
  ui/steps.js ui/languages.js ui/modules.js ui/fields.js ui/options.js
  ui/preview.js ui/sidebar.js ui/feedback.js ui/popover.js ui/download.js
  feedback/client.js    rate limits, garbage heuristics, POST to Apps Script
vendor/                 sql-wasm.js, sql-wasm.wasm, fflate.min.js (pinned, with LICENSE files)
data/                   vocabulary (see DATA_FORMAT.md)
tools/                  data lint + generation tooling (exists), bundle.mjs (new), sitemap/landing generator (new)
tests/                  node --test suites + fixtures (tests/fixtures/data exists)
feedback/Code.gs        Apps Script backend (exists)
.github/workflows/      ci.yml (lint + tests), pages.yml (bundle + deploy)
```

Keep pure logic (`state`, `deck/*`, `text/*`, `feedback/client` minus `fetch`) free of DOM access, so it runs under `node --test`.

## 3. Data loading

- **Production:** CI runs `tools/bundle.mjs` to produce `bundles/concepts.json`, `bundles/<code>.json` (all layers of one language merged: `{lang:{}, ex:{}, ipa:{}, etym:{}}`) and `bundles/meta.json`. File names include the data version for cache busting: `bundles/<version>/…`. A learning/known pair is then two or three requests, which gzip well (~0.5–1 MB per language over the wire).
- **Development / fallback:** if bundles are missing, load `data/meta/*`, all `data/concepts/*.json`, then per-module layer files for the two languages, in parallel. A missing file means empty; never throw.
- Loader API (async, cached): `getMeta()`, `getConcepts()`, `getLanguage(code)` → `{lang: Map, ex: Map, ipa: Map, etym: Map}`.
- Start prefetching a language when the user hovers or clicks its chip. Show a small inline spinner in the step while loading.

## 4. State and URL

- **Config:** `{v:1, learn, know|'=', modules:[ids], fields:{id: placement}, examples:0–3, reverse, type, srScript}`.
- Encoded in `location.hash`, compact and human-readable, for example:
  `#v1&l=ja&k=ru&m=core-1,core-2,food&f=reading:f,ipa:o,forms:b&x=2&r=1&t=1&sr=c`
  - Only non-default field placements are written.
  - Unknown keys are ignored. Invalid values fall back to defaults, keeping the rest.
- The config is also saved to localStorage (try/catch). On load, the precedence is hash > localStorage > defaults.
- `state.js` exposes `subscribe()`. The UI re-renders the dependent parts (counter, preview, sidebar) on each change, debounced by about 100 ms.

## 5. Deck selection (`deck/select.js`)

Input: config, meta, concepts, learning-language data `A`, known-language data `B` (same as `A` in same-language mode). Output: an ordered list of **notes**:
`{key, conceptIds[], learnEntries[], knowEntries[], disambig?}`.

1. **Candidate concepts:** a concept is a candidate when its `mods` intersect the selected modules.
2. **Bilingual mode:** include the concept iff
   - the concept is owned by the learned language (no `only`, or `only` includes it);
   - `A` has a word entry (`w`);
   - `B` has a word entry or a gloss (`w` or `gl`).
3. **Same-language mode:** include iff `A` has `w` and `def`.
4. **Adult module:** profanity concepts are included only when that module is selected (they may be cross-listed, so check membership, not the primary module).
5. **Order:** canonical concept order (module tree order of the primary module, then position in its file).
6. **Merge sets** (learning side), computed once per learning language over the **whole inventory**, not the selection:
   - Group word entries by `(w, g, art, pos, JSON(forms))`.
   - Each group of 2 or more is one merge set, keyed by its first member in canonical order.
   - A selected concept that belongs to a merge set produces one note per set. That note contains the selected members only, and its key and GUID come from the set's first member, even if that member is not selected. Its position is the earliest selected member.
7. **Disambiguators:** entries with the same `w` that are *not* merged (different POS or forms) get `disambig`. That is the POS label in the known language if the POS differs, otherwise the first form value that differs, shown on the front as a small caption.

## 6. Field rendering (`deck/fields.js`)

Produces the HTML for each Anki field, given the note and config. All text is escaped; only our own tags are emitted.

- **Word:**
  - article or gender marker according to the language rules (`gender.mode`, `articles` table, `art` override, fr elision `l'` without space);
  - stress marks stripped if off;
  - Serbian converted to the chosen script;
  - `WordRuby` = `<ruby>` for Japanese (`w` + `read`; readings are per word, so place the ruby over the whole kanji part and keep okurigana outside when `w` ends in kana that also ends `read`);
  - `TypeTarget` = plain main form with no hint, no stress, de/nl article included.
- **Translation:**
  - format: `w (hint) · alt1, alt2`;
  - glosses are rendered in italics;
  - merged notes join members with `; ` in canonical order;
  - same-language mode: `def` (merged notes numbered `1. … 2. …`);
  - if the known language is Serbian, convert it to the chosen script.
- **Forms:**
  - `label value` pairs in the order of `languages.json` → `forms[pos].keys`;
  - labels come from `labels.json` in the **known** language, falling back to `en`;
  - enum values (`aspect`, `class`, `type`) are shown through `value.*` labels;
  - Russian stress follows the toggle.
- **Romanization:**
  - ja and ko: stored `rom`;
  - zh: `read`;
  - ru, hy, el: rule-based `text/translit.js` (tables + context rules, unit-tested);
  - sr "other script": the opposite script.
- **Examples:**
  - first N slots;
  - target `{…}` → `<b class="t">…</b>`;
  - Japanese furigana rendered as `<ruby>` when Reading ≠ Off, otherwise stripped to plain kanji;
  - Chinese: a pinyin line under the sentence when Romanization ≠ Off;
  - Russian stress follows the toggle;
  - if Example translations are on and both slot k entries are parallel, the known-language sentence goes underneath (braces removed, furigana stripped).
- **Related:**
  - antonyms `↔ w` and related `→ w`, rendered in the learned language;
  - concepts the learned language doesn't have are skipped.
- **Etymology, IPA, Measure word, Hanja, POS, Register, Emoji, ConceptId:** straight from the data, with captions from `labels.json`.

## 7. Anki package

### 7.1 Note type (one per language pair)

- **Fields (fixed order, never changes within schema v1):**
  `Word, WordRuby, TypeTarget, Disambig, Translation, Romanization, OtherScript, MeasureWord, Hanja, Forms, IPA, Examples, Related, Etymology, POS, Register, Emoji, ConceptId, Reverse`.
  - Fields switched off are left empty.
  - `Reverse` is `"1"` when reverse cards are on, otherwise empty.
- **Templates:**
  - `Forward`.
  - `Reverse`, whose front is wrapped entirely in `{{#Reverse}}…{{/Reverse}}`. Anki creates a reverse card only when the field is non-empty, so toggling reverse never changes the note type's schema.
  - Templates are generated from the config: field rows on Front go to the question, rows on Back go after `<hr id=answer>`.
  - On reverse cards every learning-side field goes to the answer.
  - Japanese: the front uses `WordRuby` only when Reading = Front; the back uses `WordRuby` whenever Reading ≠ Off.
  - Type the answer: `{{type:TypeTarget}}` on the reverse front and back, only when enabled.
- **CSS:** `css/card.css`, embedded verbatim.
  - Night mode via `.nightMode`/`.night_mode`.
  - `lang` attributes on learned/known blocks so CJK picks correct glyphs (zh-Hans vs ja).
  - Ruby styling, small grey captions, mobile-first.
- **Sort field:** Word (plain text).

### 7.2 IDs (`deck/ids.js`) — use `crypto.subtle` SHA-256 (async; available in browsers and Node ≥ 20)

| ID | Formula |
|---|---|
| note GUID | base91(first 8 bytes of SHA-256(`ankigen/v1/note|{learn}|{know}|{key}`)). `know` is `=` in same-language mode. |
| note id / card id | 53-bit integers from SHA-256(`…/note-id|…`) and (`…/card|{guid}|{ord}`), mapped into [1e12, 2^53) |
| deck id | from `ankigen/v1/deck|{learn}|{know}` |
| model id | from `ankigen/v1/model|{learn}|{know}` |

- `csum` = first 8 hex digits of SHA-1 of the stripped sort field, as an int (Anki's rule).
- Changing a prefix version (`v1`) is a breaking change for every user. Don't do it.

### 7.3 Collection

- Write a **schema 11** `collection.anki2`: `col`, `notes`, `cards`, `revlog`, `graves`, with `models`, `decks`, `dconf` and `conf` JSON in `col`. It imports into all current Anki desktop, AnkiDroid and AnkiMobile versions.
- Deck name: `AnkiGen::<Learning native name> (<Known native name>)`; for same-language mode, `AnkiGen::<name> (definitions)`.
- Tags: `ankigen::<category>::<module>` for every selected module the concept belongs to. Use the module IDs from `modules.json`.
- New cards: `due` = note position (0-based); `ord` 0 = forward, 1 = reverse.
- Zip with `fflate` entries `collection.anki2` and `media` (content `{}`), fixed entry mtime 1980-01-01, deterministic order.
- File name: `ankigen-<learn>-<know>-<data version>.apkg`.

### 7.4 Timestamps and updates

Anki's importer updates an existing note (same GUID) only when the incoming note is **newer** by its `mod` time. So `mod` and the collection timestamps use the export time (seconds). Everything else is deterministic.

Tests pass a fixed clock: in test mode two exports of the same config must be byte-identical. In normal mode, compare everything except the timestamp columns.

**Verify by hand on current Anki desktop and AnkiDroid:**
1. Import a deck, study a few cards, change the field placement, then re-import. Notes update, review history stays, and the note type templates follow the new config.
2. If templates don't update, document the importer option the user must pick (the "?" popup next to Download) rather than changing IDs.

## 8. Preview and sidebar

- **One template pipeline:** the preview renders the *same* generated templates and fields with `deck/render.js`, a tiny Mustache subset:
  - `{{Field}}`, `{{#F}}…{{/F}}`, `{{^F}}…{{/F}}`, `{{FrontSide}}`;
  - `{{type:F}}` renders as a disabled input.

  What the user sees is what Anki shows.
- **Preview:** each face is rendered in a sandboxed `<iframe srcdoc>` with `card.css`. Light/dark follows the page.
- **Sidebar:** a virtualized list with fixed row height, rendering only visible rows. Each row shows the front word plus a short back summary; clicking expands it to the full rendered card and makes it the preview sample.
- **Search index:** built lazily, one folded string per note (word, alt, translation, romanization, readings, Serbian in both scripts).
- **Mobile:** the sidebar is a drawer opened from a button with the note count.

## 9. Feedback client

- **Opening the dialog:**
  - Shortcut: `keydown` Ctrl/Cmd+Enter opens it.
  - Corner button: a fixed ⚑ in the bottom-right.
- **Selection capture:**
  - Listen to `selectionchange` and keep the last non-empty selection with its context: `closest('[data-concept]')`, `[data-field]`, and direction/side from the card container.
  - The preview iframes post their selection to the parent via `postMessage`.
  - Capture on `pointerdown` of the corner button, because on mobile tapping clears the selection before `click`.
- **Request:** `POST` to the Apps Script `/exec` URL with `Content-Type: text/plain;charset=utf-8` (a simple request, so no CORS preflight), body = JSON:

```json
{"clientId":"uuid","clientTime":"ISO","tzOffsetMin":-120,"category":"typo","message":"…","email":"",
 "selectedText":"…","conceptId":"word-water","direction":"forward","side":"back","field":"Examples",
 "learning":"ja","known":"ru","configUrl":"https://…#v1&…","appVersion":"…","dataVersion":"2026.10.17",
 "browserLang":"ru-RU","website":""}
```

  `website` is the honeypot. Read the JSON response `{ok:true}` / `{ok:false,error}`. If reading fails because of CORS, fall back to `mode:'no-cors'` and assume success.
- **Limits:** client rate limits and garbage heuristics as in SPEC §5, with counters in localStorage.

## 10. SEO

- `<title>`: "AnkiGen — free Anki vocabulary decks in 15 languages".
- Meta description, canonical URL, Open Graph and Twitter card (with `og-image.png`).
- JSON-LD `WebApplication` (free offer, `inLanguage` list).
- Semantic headings, `noscript` text describing the tool, `robots.txt`, `sitemap.xml`.
- **Optional, phase 2:** `tools/landing.mjs` generates static pages like `/decks/japanese-for-russian-speakers/`, each with a unique title and description, a short explanation, and a link into the app with a preset hash. Add them to the sitemap.

## 11. Testing

- `node --test` suites:
  - **IDs:** stable, known vectors.
  - **URL codec:** round trip and invalid input.
  - **translit:** tables.
  - **furigana:** parser.
  - **select:** fixtures. Merge рука́ hand/arm when learning Russian; hints for English brother; `only` concepts; glosses.
  - **fields:** snapshots per language for the golden sample.
  - **templates:** reverse rule moves learning fields to the back; type answer only on reverse.
  - **apkg:** build in Node with sql.js, reopen the DB, assert tables, IDs, field counts; byte-identical with a fixed clock.
- `tools/lint-data.mjs` on `data/` and on `tests/fixtures/data` in CI.
- Optional Playwright smoke test (Chromium): pick ja ← ru, select Core I, toggle reverse, download, check the blob size is > 0.

## 12. CI/CD

- `ci.yml` (push/PR): Node 22, `node tools/lint-data.mjs`, `node tools/lint-data.mjs --data tests/fixtures/data --meta data/meta`, `node --test`.
- `pages.yml` (push to `master`): run tests, `node tools/bundle.mjs`, assemble `_site/` (app + vendor + bundles + data/meta + SEO files), deploy with `actions/deploy-pages`.
- **Data gate:** the deploy job fails if any active language has < 100% entry coverage in `lint-data --report`, unless it is overridden with a workflow input. The site ships only when every language is complete.
