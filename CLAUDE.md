# AnkiGen Flow: instructions for Claude Code

A fork of AnkiGen (https://github.com/xenohunter/ankigen, by Phil Filippak) that adds flow drills after the Mimic Method to the decks it builds: spoken cards, ear cards, shadow cards, reflex cards, drill cues and the voice the learner speaks as. Start with `docs/FLOW.md`; AnkiGen's own documents below still hold for everything else.

- Working copy: `~/ankigen-flow` (Windows). Upstream is the `origin` remote; keep its history so upstream changes can be merged.
- Planned site: https://bnuckols13.github.io/ankigen-flow/ (src/config.js). Not deployed yet.

## Git

- Commit only when Brian asks. Default branch `master`, as upstream. No AI attribution lines in commits.
- `.claude/settings.json` denies reading `.env` and running `git commit`/`git push`; keep those rules.

## Read before working

- `docs/FLOW.md`: the drills, their fields and templates, what is not here.
- `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA_FORMAT.md`: AnkiGen's product decisions, design and data contract. Where they say two templates or 19 fields, the fork has five and 28 (`docs/FLOW.md` §3).

## Rules kept from upstream

- Vocabulary files under `data/concepts|lang|ex|ipa|etym` change only through the generation tools or when asked for a specific edit; then `node tools/lint-data.mjs --fix` and `node tools/lint-data.mjs`.
- Concept IDs are permanent. Never rename or reuse one; retire with `data/meta/retired.json`.
- The flow field order after AnkiGen's 19 fields, the template order and the `ankigen-flow/v1/` ID prefix are part of every user's deck: never change them.
- A deck with every drill off must stay AnkiGen's deck field for field (the snapshot tests check this).
- The flow texts stay out of `src/ui/strings.js` (which the translation checker owns); they live in `src/ui/flow.js` and `src/deck/flow.js`.
- No framework, no build step: native ES modules, vanilla JS with JSDoc and `// @ts-check`, plain CSS. Pure logic has no DOM access and is unit-tested.

## Commands

```
python3 -m http.server 8000        # open http://localhost:8000/ (add ?data=tests/fixtures/data for the small test set)
npm test                           # unit tests (node --test)
node tools/lint-data.mjs           # validate data/
node tools/apkg.mjs '#v1&l=es&k=en&m=core-1&e=1&s=1&rx=1&cu=1' --out tmp   # an .apkg from a hash, in Node
node tools/bundle.mjs              # build the site into _site/
```

On this machine the clone has `core.autocrlf false`: the snapshot tests compare files byte for byte.
