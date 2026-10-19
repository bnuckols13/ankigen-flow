# AnkiGen

Free Anki vocabulary decks in 15 languages, built right in your browser: **https://xenohunter.github.io/ankigen/**

Pick the language you're learning and one you speak, or short definitions in the same language. Choose topic modules, from the 500 most frequent words to food, housing, health, work and travel. Then choose what each card shows, and download an `.apkg` for Anki or AnkiDroid. The deck is built in your browser; nothing is uploaded.

Languages: English, Russian, Serbian, Japanese, Chinese, German, Spanish, Portuguese, Polish, Korean, Dutch, French, Armenian, Turkish and Greek. The page itself speaks all of them too: pick one with the flag menu in the top-right corner, or link to it with `?lang=ru`.

Decks are deterministic: the same settings and data version always give the same notes with the same IDs. You can download again later with more modules, other fields or newer data, and import the new file over the old deck. Anki updates the notes and keeps your review history.

**Status:** version 1.0.0. All 15 languages are complete: every word has a definition, three examples and, where the deck offers it, IPA. Italian, Irish, Scottish Gaelic and Swedish come next.

The vocabulary is drafted with an AI model and partly reviewed by people. If something looks wrong, select it on a card and press Ctrl+Enter, or use the Feedback button on the page.

## Run it locally

No build step and no dependencies: serve the repository root and open http://localhost:8000/.

```
python3 -m http.server 8000      # or: npx serve -l 8000
```

- Add `?data=tests/fixtures/data` to the address for the small test set (15 words in English, Russian, Japanese, German and Serbian).
- Downloading needs `https://` or `localhost`, because browsers hash note IDs only on secure pages. A phone opening the page by your computer's network address can do everything except download.
- The landing pages under `decks/` exist only in the built site (below).

## Checks

```
npm test                 # unit tests (node --test; Node 22)
npm run lint:data        # validate data/
npm run lint:fixtures    # validate the golden sample in tests/fixtures/data
```

## Build and deploy

```
node tools/bundle.mjs                   # build the site in _site/: the page, the data bundles, the landing pages, the SEO files
python3 -m http.server -d _site 8000    # preview the production build; the landing pages are at /decks/
```

The landing pages are one static page per language pair with words, such as `decks/japanese-for-russian-speakers/`, for search engines: the deck's modules with word counts and sample words, and links that open the app with the pair chosen. Each is written in the language its visitors speak, from the translations in `data/landing/`. `decks/` lists them, and `sitemap.xml` is written with them.

`.github/workflows/pages.yml` deploys to GitHub Pages on every push to `master`. It lints the data, runs the tests, checks the data gate, builds `_site/` and publishes it.

- One-time setup: Settings → Pages → Source: **GitHub Actions**.
- The data gate (`node tools/lint-data.mjs --gate`) fails until every active language has an entry for every concept, so nothing deploys before then.
- To deploy anyway, run the workflow by hand: Actions → Pages → Run workflow, then tick "Deploy even if some languages are incomplete".
- To release a data update: run the linter, bump `data` in `data/meta/version.json`, and push.

## Data and feedback

- `docs/DATA_FORMAT.md`: the data contract, implemented by `tools/lib/data.mjs` and `tools/lint-data.mjs`.
- `docs/GENERATION.md`: how the vocabulary is generated in resumable units by an API batch runner (`tools/gen/batch.mjs`, which reads `ANKIGEN_API_KEY` from `.env`). `node tools/gen/plan.mjs status` shows progress.
- `docs/FEEDBACK.md`: where error reports go (a Google Sheet through an Apps Script web app, `feedback/Code.gs`), and how to triage them.

## Repository

| Path | What |
|---|---|
| `index.html`, `css/`, `src/` | the app: native ES modules, no framework, no build step |
| `languages.html` | the supported languages, with "Request a language" |
| `vendor/` | sql.js and fflate, pinned, with their licenses |
| `data/` | the vocabulary: concepts, per-language layers, `meta/` (languages, modules, fields, labels, version), `landing/` (the landing pages' translations), `ui/` (the page's translations) |
| `img/flags/` | the interface languages' flags |
| `tools/lint-data.mjs` | data validator (`--report`, `--fix`, `--warnings`, `--gate`) |
| `tools/bundle.mjs` | builds the site with one data bundle per language |
| `tools/landing.mjs` | the landing pages per language pair and the sitemap (`tools/bundle.mjs` writes them) |
| `tools/ui-texts.mjs` | checks the page's translations in `data/ui/` and stamps them (`check`, `stamp <code>`) |
| `tools/apkg.mjs` | builds an `.apkg` in Node from a configuration hash (for testing imports) |
| `tools/gen/` | generation planner, unit merger, API batch runner, prompts |
| `tools/og-image.html` | source of `og-image.png`, the link preview picture |
| `tests/` | `node --test` suites; `tests/fixtures/data/` is the golden sample |
| `docs/SPEC.md`, `docs/ARCHITECTURE.md` | product decisions and technical design |
| `docs/ANKI_CHECKLIST.md` | manual import checks in Anki and AnkiDroid |
| `docs/CLAUDE_CODE_PROMPT.md`, `CLAUDE.md` | the build plan and the rules for Claude Code |

## License

- Code: [MIT](LICENSE).
- Vocabulary in `data/`: [CC BY-SA 4.0](data/LICENSE.md).
- `vendor/`: sql.js and fflate under their own licenses (MIT), see `vendor/README.md`. The share logos come from simple-icons (CC0), see the same file.

## Support

If AnkiGen helps you, you can support it on [Patreon](https://www.patreon.com/cw/blisstweeting) or [Buy Me a Coffee](https://buymeacoffee.com/blisstweeting).
