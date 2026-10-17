# Prompt for Claude Code

Paste everything below the line into Claude Code, started in the repo root (`/home/xenohunter/projects/ankigen`, WSL).

---

You are building **AnkiGen**, a free, static, single-page web app (GitHub Pages; repo https://github.com/xenohunter/ankigen, site https://xenohunter.github.io/ankigen/). It generates Anki decks (`.apkg`) fully in the browser from curated multilingual vocabulary data. The product, the data contract and the architecture are already decided and documented. Your job is to implement the app and its tooling to that spec, with tests, in milestones.

**`CLAUDE.md` rules apply throughout.**
- I commit; you never do.
- The branch stays `master`.
- This repo is the only source of truth.

## Read first, in this order

0. `CLAUDE.md`
1. `docs/SPEC.md`: what the product does. Every decision there is final unless you find a contradiction; then stop and ask.
2. `docs/ARCHITECTURE.md`: how to build it (modules, IDs, Anki package, preview, feedback, SEO, CI).
3. `docs/DATA_FORMAT.md`: the data contract. `tools/lib/data.mjs` and `tools/lint-data.mjs` implement its validation; read them.
4. `data/meta/*.json`: languages, module tree, field table, card labels, version.
5. `tests/fixtures/data/`: a small golden dataset (15 concepts × en/ru/ja/de/sr, incl. examples, IPA, etymology, a merge case, hint collisions, country-specific and language-unique concepts). Build and test against it; the real `data/` is filled gradually by separate generation sessions.
6. `docs/FEEDBACK.md` + `feedback/Code.gs`: the feedback backend (done; you build the client).

Run `node tools/lint-data.mjs --data tests/fixtures/data --meta data/meta` to see the data checks pass.

## Ground rules

- **No framework, no app build step.** Native ES modules, vanilla JS with JSDoc and `// @ts-check`, plain CSS. Vendor pinned copies of `sql.js` (sql-wasm.js + .wasm) and `fflate` into `vendor/` with their licenses; no CDNs at runtime. Node 22 for tooling and tests (`node --test`); add dev dependencies only if clearly worth it.
- **Do not hand-edit** `data/concepts|lang|ex|ipa|etym` or `feedback/Code.gs`. Vocabulary changes go through the pipeline (`merge-unit.mjs`, `batch.mjs`).
- You may fix bugs in `tools/` and add lint checks to `tools/lib/data.mjs` if the fixtures still pass. Tell me what you changed.
- Pure logic (`src/state.js`, `src/deck/*`, `src/text/*`, feedback limits) must not touch the DOM, so it runs under `node --test`.
- **Determinism is a feature.** Same data version + same config → same notes, same GUIDs, same field contents, same order. IDs follow ARCHITECTURE §7.2 exactly; never change the `ankigen/v1/…` hash prefixes.
- Missing data (a language file, an IPA entry, etymology, a third example) is normal: render nothing for it, never throw.
- Keep the UI minimal and clean:
  - one calm accent color, system font stack (plus CJK-appropriate fallbacks), generous whitespace;
  - light/dark via `prefers-color-scheme`;
  - fully usable on a phone;
  - keyboard accessible;
  - good contrast.
- Card styling should look like a tidy Anki card, and `css/card.css` is embedded verbatim in the note type.
- Put every external URL and environment value in `src/config.js`:

  | Constant | Value |
  |---|---|
  | `PATREON_URL` | `https://www.patreon.com/cw/blisstweeting` |
  | `REPO_URL` | `https://github.com/xenohunter/ankigen` |
  | `SITE_URL` | `https://xenohunter.github.io/ankigen/` (all asset paths relative: Pages serves under `/ankigen/`) |
  | `FEEDBACK_ENDPOINT` | the Apps Script `/exec` URL. It is public by design (it ships in the page), so it goes straight into `config.js`, not into `.env`. Here's the URL: `https://script.google.com/macros/s/AKfycbyyz5eLFkjHU2NUg5CgILLnt-8zYWKGJODuws0sFeeJh7NKuWOUMF2LwNnqIRQR9xU/exec` |
  | `APP_VERSION` | |

## Milestones

- **Do not commit.** At the end of each milestone, stop and give me:
  - a summary;
  - the list of changed files;
  - a suggested commit message.

  I review and commit, then you continue.
- Keep tests green.

**M0: Vocabulary pipeline smoke test** (do this first; the data generation runs in the background while you build the app)
- The data tooling exists and is tested against a mock API: `tools/lint-data.mjs`, `tools/gen/{units,inputs,plan,merge-unit,batch}.mjs`. Read `docs/GENERATION.md`.
- The concept inventory (`data/concepts/`) was built in an earlier session. Run:
  - `node tools/lint-data.mjs --report`
  - `node tools/gen/plan.mjs status`

  Report anything odd.
- My API key is in `.env` as `ANKIGEN_API_KEY`; `batch.mjs` reads it itself. Never open or print `.env`. Run one cheap real call:
  - `node tools/gen/batch.mjs sync labels:de`;
  - then show me the merged labels and the token usage.

  If the API rejects anything (model name, parameters, response shape), fix `batch.mjs` and tell me what changed.
- Then run `node tools/gen/batch.mjs estimate` and show me the cost estimate. **Don't submit large batches until I say go.**

**M1: Foundations and pure helpers**
- `package.json` (type module; scripts: `test`, `lint:data`, `lint:fixtures`, `bundle`), `.github/workflows/ci.yml` (lint data + fixtures, run tests).
- `src/deck/ids.js`: SHA-256 via `crypto.subtle`, base91 GUIDs, 53-bit IDs, Anki `csum` (SHA-1). Known-vector tests.
- `src/text/translit.js`: ru → Latin (simple, readable scheme), sr Cyrillic ↔ Latin (Cyrillic→Latin is exact; Latin→Cyrillic only for search), hy → Latin (BGN/PCGN), el → Latin (ELOT 743). Table-driven, with tests.
- `src/text/furigana.js`: Anki-style `漢字[かな]` with the space rule → `<ruby>`; `{target}` → `<b class="t">`; stripping helpers. Tests from the fixture sentences.
- `src/text/normalize.js`: search folding (case, diacritics, U+0301, Serbian both scripts, kana/romaji, pinyin without tones).
- `src/state.js`: config model, defaults from `fields.json`, validation, URL hash codec (ARCHITECTURE §4), localStorage (try/catch). Round-trip tests.

**M2: Deck pipeline**
- `src/data/loader.js`: bundles when present, else per-file loading; a `?data=` dev override pointing at `tests/fixtures/data` (meta always from `data/meta`).
- `src/deck/select.js`: inclusion rules, canonical order, learning-side merge sets over the whole inventory, disambiguators (ARCHITECTURE §5).
- `src/deck/fields.js`, `src/deck/templates.js`, `src/deck/render.js` (ARCHITECTURE §6–8).
- Tests on the fixtures:
  - learning ru / known en merges рука́ into one note "hand; arm" whose GUID comes from `word-hand`;
  - learning en / known ru shows "брат (старший)";
  - learning ja / known de shows 住民票 with the German gloss;
  - `word-day-24h` appears only when learning ru;
  - reverse cards move every learning-side field to the back;
  - type-the-answer appears only on reverse cards and compares against `TypeTarget`;
  - Example translations appear only for parallel slots;
  - furigana follows the Reading setting; Russian stress follows its toggle;
  - Serbian script conversion covers word, forms, examples and definitions.

**M3: Anki package**
- `src/deck/apkg.js`: schema-11 collection via sql.js, note type with the fixed field list, templates, CSS, deck, tags, `due` order, zip via fflate with fixed entry times.
- Node test: build a fixture deck, reopen the SQLite file, assert structure and IDs; with a fixed clock, two builds are byte-identical.
- Write `docs/ANKI_CHECKLIST.md` for my manual test on Anki desktop and AnkiDroid:
  - import;
  - study;
  - change fields and re-import (notes update, history kept);
  - add a module and re-import (notes added to the same deck);
  - toggle reverse.

  Tell me exactly what to look for. If Anki's importer needs a specific option to update note types, write the user-facing "?" text for it.

**M4: Page and flow**
- `index.html` + `css/app.css` + `src/ui/*`: the step flow (SPEC §4):
  - language chips with native names and English tooltips;
  - "Same language";
  - the module tree with category checkboxes and 18+ badge;
  - the field table (only rows relevant to the chosen languages) with the examples slider;
  - the reverse and type-answer toggles; Serbian script choice;
  - "?" popovers on the controls listed in SPEC;
  - live counter;
  - live preview of up to 4 faces in sandboxed iframes with a "random sample" button;
  - Download (lazy-load sql.js on first use, or prefetch when idle after step 3).
- Steps reveal progressively, stay editable, and the full state lives in the URL hash.

**M5: Sidebar and feedback**
- Virtualized card list with search (normalized matching). On mobile it is a drawer.
- Clicking a card makes it the preview sample; each card has a report action.
- Feedback dialog per SPEC §5 and ARCHITECTURE §9:
  - Ctrl/Cmd+Enter;
  - corner ⚑ button;
  - selection capture, including inside preview iframes via `postMessage`, and capture on `pointerdown` for mobile;
  - quoted selection, optional email and category, honeypot;
  - client rate limits and garbage heuristics with the 10-garbage silent cutoff;
  - privacy line (text in `docs/FEEDBACK.md`).

  Unit-test the limiter and heuristics.

**M6: Release readiness**
- Footer: "Support this project" (Patreon), data and app versions, GitHub link.
- Draft disclaimer near the top.
- SEO per ARCHITECTURE §10: title, description, canonical, OG/Twitter, JSON-LD, sitemap, robots, noscript, `og-image.png`.
- `tools/bundle.mjs` (per-language bundles under a versioned path).
- `.github/workflows/pages.yml` with the data-completeness gate (ARCHITECTURE §12).
- `README.md`: what it is, local dev (`npx serve` or `python -m http.server`), data pipeline pointers, license (code MIT, data CC BY-SA 4.0).
- Lighthouse-style self-check: no layout shift, fast first paint, accessible names on controls.

**M7: Only when I ask**
- `tools/landing.mjs`: static SEO landing pages per language pair.

## Working style

- Before M1, give me a short plan: file list and any spec ambiguity you found. Then proceed without waiting unless something is truly blocked.
- Prefer small, well-named modules and table-driven code over cleverness. No dead code, no TODOs left behind without telling me.
- Verify in a real browser (Playwright in WSL; install its Chromium if missing): pick ja ← ru, select Core I, toggle reverse, download, and inspect the preview and sidebar.
- At the end of each milestone, report:
  - what's done;
  - what you verified and how;
  - what needs my manual check (Anki import, Apps Script URL);
  - any deviations from the docs and why.
