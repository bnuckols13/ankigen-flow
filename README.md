# AnkiGen

Free Anki vocabulary decks in 15 languages, generated entirely in your browser.

Repo: https://github.com/xenohunter/ankigen · Site: https://xenohunter.github.io/ankigen/

**Status:** specification and data pipeline ready; app not built yet; vocabulary being generated.

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
| `tools/gen/` | generation planner, unit merger, API batch runner, prompts |
| `tests/fixtures/data/` | golden sample dataset |

```
node tools/lint-data.mjs --data tests/fixtures/data --meta data/meta --report
node tools/gen/plan.mjs status
```

Support: https://www.patreon.com/cw/blisstweeting
