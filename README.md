# AnkiGen

Free Anki vocabulary decks in 15 languages, generated entirely in your browser.

Repo: https://github.com/xenohunter/ankigen · Site: https://xenohunter.github.io/ankigen/

**Status:** the app runs locally (the page, the preview, the word list, feedback reports and the `.apkg` download); vocabulary is being generated (English is done).

Run it locally from the repo root, then open http://localhost:8000/ (add `?data=tests/fixtures/data` for the small test set in en/ru/ja/de/sr):

```
python3 -m http.server 8000      # or: npx serve -l 8000
```

| Path | What |
|---|---|
| `CLAUDE.md` | rules for Claude Code (no commits, `master`, data rules) |
| `docs/SPEC.md` | product specification (all decisions) |
| `docs/ARCHITECTURE.md` | technical design for the app |
| `docs/DATA_FORMAT.md` | vocabulary data contract |
| `docs/GENERATION.md` | how the vocabulary is generated in resumable units, quota planning |
| `docs/CLAUDE_CODE_PROMPT.md` | prompt to build the app with Claude Code |
| `docs/FEEDBACK.md`, `feedback/Code.gs` | error-report backend (Google Sheet + Apps Script) |
| `data/meta/` | languages, modules, field table, card labels |
| `data/` | vocabulary (filled by generation units) |
| `tools/lint-data.mjs` | data validator (`--report`, `--fix`, `--warnings`) |
| `tools/apkg.mjs` | builds an `.apkg` in Node from a config hash (testing imports) |
| `tools/gen/` | generation planner, unit merger, API batch runner, prompts |
| `tests/fixtures/data/` | golden sample dataset |

```
node tools/lint-data.mjs --data tests/fixtures/data --meta data/meta --report
node tools/gen/plan.mjs status
```

Support: https://www.patreon.com/cw/blisstweeting
