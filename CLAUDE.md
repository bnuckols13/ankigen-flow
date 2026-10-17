# AnkiGen: instructions for Claude Code

Free static web app (GitHub Pages) that builds Anki decks in the browser from curated multilingual vocabulary.

- Repo: https://github.com/xenohunter/ankigen. Site: https://xenohunter.github.io/ankigen/
- Working copy: `/home/xenohunter/projects/ankigen` (WSL). **This repo is the single source of truth.** Never assume another copy exists or is newer.

## Git: the owner commits, you don't

- Never run `git commit`, `git push`, `git rebase`, `git reset --hard`, `git checkout -- <file>`, `git stash` or anything that rewrites history or discards changes.
- Read-only git is fine: `status`, `diff`, `log`.
- The default branch is **`master`**. Never rename it, never create or switch to `main`, never change the default branch.
- When a piece of work is ready, stop and summarize it with a suggested commit message. The owner reviews and commits.

## Read before working

- `docs/SPEC.md`: product decisions (final unless you find a contradiction; then ask).
- `docs/ARCHITECTURE.md`: technical design.
- `docs/DATA_FORMAT.md`: data contract. Implemented by `tools/lib/data.mjs`.
- `docs/GENERATION.md`: how vocabulary is generated (API batch runner, units).
- `docs/CLAUDE_CODE_PROMPT.md`: the build plan in milestones.

## Data rules

- Vocabulary files under `data/concepts|lang|ex|ipa|etym` change only through `tools/gen/merge-unit.mjs` / `tools/gen/batch.mjs`, or when the owner asks for a specific edit. After any data change, run `node tools/lint-data.mjs --fix` and then `node tools/lint-data.mjs`.
- Concept IDs are permanent (they seed Anki note GUIDs). Never rename or reuse one; retire with `data/meta/retired.json`.
- The API key for the generation pipeline lives in `.env` as `ANKIGEN_API_KEY` (gitignored; `tools/gen/batch.mjs` reads it itself). Never read, print or edit `.env`, never echo the key, never put keys in other files, logs or commits. Do not set `ANTHROPIC_API_KEY` anywhere: it would switch Claude Code itself to API billing.
- `.claude/settings.json` denies reading `.env` and running `git commit`/`git push`; keep those rules.

## Commands

```
node tools/lint-data.mjs [--report] [--warnings] [--fix]          # validate data/
node tools/lint-data.mjs --data tests/fixtures/data --meta data/meta   # validate the golden sample
node tools/gen/plan.mjs status | list | show <unit>                 # generation progress / unit inputs
node tools/gen/batch.mjs estimate | submit | status | collect | retry | sync | auto   # API runner
```

## Code conventions

- No framework, no app build step: native ES modules, vanilla JS with JSDoc + `// @ts-check`, plain CSS.
- Vendored dependencies in `vendor/` (pinned, with licenses). Node 22 for tooling; tests use `node --test`.
- Pure logic (state, deck, text, feedback limits) has no DOM access and is unit-tested.
- Deterministic deck output (see ARCHITECTURE §7). Missing data is never an error.
