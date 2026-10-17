# AnkiGen: product specification

A free single-page web app on GitHub Pages that builds Anki decks (`.apkg`) entirely in the browser from curated vocabulary data. Output is **deterministic**: the same configuration and data version always give the same notes with the same IDs. Re-importing an updated deck updates existing cards and keeps review history.

Repo: https://github.com/xenohunter/ankigen (branch `master`). Site: https://xenohunter.github.io/ankigen/. Support link: https://www.patreon.com/cw/blisstweeting

## 1. Languages

- **Active (15):**

  | Language | Variant |
  |---|---|
  | English | US |
  | Russian | |
  | Serbian | ekavian; stored in Cyrillic, Latin derived |
  | Japanese | |
  | Chinese | Mandarin, Simplified, mainland |
  | German | Germany |
  | Spanish | Spain |
  | Portuguese | Portugal |
  | Polish | |
  | Korean | South Korea |
  | Dutch | Netherlands |
  | French | France |
  | Armenian | Eastern, reformed orthography |
  | Turkish | Turkey |
  | Greek | modern, monotonic |

- **Deferred** (codes reserved, added later): Italian, Irish, Scottish Gaelic, Swedish, and more to come.
- **Regional variants** (pt-BR, es-MX, en-GB, …) are added later as separate dropdown entries backed by override files (`extends`).
- **Modes:**
  - Bilingual: *I'm learning* X, *I speak* Y.
  - **Same language**: X → short definitions in X.

## 2. Modules (tree, collapsible meta-categories)

- **Foundations** (open by default): Core I (500), Core II (500), Core III (800), Numbers & math, Time & calendar
- **Communication:** Survival phrases, Countries/nationalities/languages, Language learning
- **Daily life:** Family & relationships, Feelings & character, Food & drinks, Cooking & kitchen, Shopping & clothing, Housing & renting, Household & repair, Weather & nature, Pets & animals
- **Getting around:** City & directions, Transport & travel, Driving & road rules, Signs & notices
- **Living abroad:** Residence & legalization, Money & banking, Work & employment, Post/phone/internet, Education
- **Health & safety:** Health & medicine, Emergencies
- **Interests:** Hobbies, Sports, Music, Video games, Tabletop games, Tech & computers, Science
- **18+:** Profanity (visible, marked 18+). There is no slang module.

How modules behave:
- Concepts can belong to several modules. They are deduplicated in the deck.
- Core bands are mutually exclusive, and word groups (numbers 0–10, weekdays, months…) never split across bands.
- Country-specific modules (residence, driving, …) contain generic concepts plus country-specific terms for each language's country. Those terms appear only when learning that language, with a descriptive gloss on the other side.
- Sizes and descriptions: `data/meta/modules.json`.

## 3. Cards

### Directions
- **Forward:** learned word → translation (or definition).
- **Reverse** (optional): translation → learned word.
  - On reverse cards **every field about the learned word moves to the answer side**. Only the translation with its hint, plus concept-level fields the user placed on the front (part of speech, register, emoji), stay on the question side.
- **Type the answer** (optional, only when reverse cards are on): the user types the learned word on reverse cards. The answer is compared with a clean field: main form, no hint, no stress marks, articles included for German and Dutch, CJK in native script. Forward cards never use typing.

### Field table (step 4)
Each row is Off / Front / Back (some rows have fewer choices). Defaults are in `data/meta/fields.json`. Rows are shown only when relevant to the chosen language:

| Field | Default | Languages / notes |
|---|---|---|
| Word | Front (fixed) | |
| Translation | Back (fixed) | "Definition" in same-language mode; includes hint and synonyms |
| Gender / article | With the word | de nl fr es pt el ru sr pl |
| Stress marks | On | ru |
| Reading (furigana) | Back | ja |
| Romanization | Back | ja zh ko hy el; ru default Off |
| Other script | Off | sr |
| Measure word / counter | Back | zh ja |
| Hanja | Back | ko |
| Key forms | Back | |
| IPA | Back | all but zh ja |
| Examples | Back | slider 0–3, default 2 |
| Example translations | Back | bilingual mode only |
| Antonyms & related | Back | |
| Etymology | Back | shown when present |
| Part of speech | Off | |
| Register | Off | |
| Emoji | Off | |
| Concept ID | Off | with a "?" popup explaining it is for error reports |

- **Deck options:** Reverse cards (off), Type the answer (off; needs reverse), Serbian script (Cyrillic/Latin; shown when Serbian is on either side).
- No audio, no color coding, no listening or cloze cards (explicitly out of scope).

## 4. Page flow and UI

Minimal, clean, fast. English UI. Card captions use the language the user speaks, via `labels.json`.

1. **Title + short description**, plus a one-line disclaimer: vocabulary is machine-drafted and partly unreviewed, and feedback is welcome.
2. **I'm learning:** language chips with native names (Српски, 日本語, Հայերեն) and English names as tooltips.
3. **I speak:** chips plus a **Same language** button (definitions instead of translations).
4. **Modules:** a tree with expand/collapse and checkboxes at module and category level, a selected count, and an 18+ badge on Profanity.
5. **Card fields:** the field table and examples slider.
6. **Reverse cards / Type the answer** toggles.
7. **Download:** summary plus the button.

How the steps behave:
- Each step's block appears once the previous step has a choice.
- Steps stay editable; changing an earlier step never resets later choices unless they become invalid.
- "?" popups explain non-obvious controls: same-language mode, modules with country-specific terms, 18+, each field row, reverse cards, type the answer, Serbian script, concept ID, the draft disclaimer, and how to re-import updates.

Always-visible elements:
- **Live counter:** "1,734 notes · 3,468 cards".
- **Live preview:** up to 4 rendered card faces (forward front/back, reverse front/back when reverse is on), using a sample concept. A "random sample" button cycles samples. Clicking a card in the sidebar makes it the sample.
- **Cards sidebar:** every note of the would-be deck in a virtualized list, with a search box. Search ignores case, diacritics and stress, matches Serbian in both scripts, and finds Japanese/Chinese/Korean words by romanization. Each card has a "report" action. On mobile the sidebar becomes a drawer.
- **Shareable state:** the full configuration lives in the URL hash, so a link reproduces the exact deck. The last configuration is also remembered locally.
- **Footer:**
  - a "Support this project" button → Patreon;
  - data version and app version;
  - link to the GitHub repo.

## 5. Feedback and error reports

- **Opening the dialog:** Ctrl/Cmd+Enter (with or without selected text), or a small fixed button in a screen corner (the only way on phones). If text is selected inside a card, the dialog quotes it and records which card and field it came from.
- **Dialog fields:**
  - Message (required; prefilled with the quote).
  - Email (optional; "If you want us to get back to you, leave your email").
  - Category (optional): Wrong translation / Typo / Wrong form / Bad example / Suggestion / Other.
  - Hidden honeypot field.
  - One-line privacy note.
- **Attached automatically:**
  - client timestamp and timezone;
  - random client ID (generated once, kept in localStorage; **no fingerprinting**);
  - config URL, app version, data version;
  - concept ID, card direction, side and field of the selection;
  - the selected text;
  - browser language.
- **Backend:** a Google Apps Script web app bound to a Google Sheet (`feedback/Code.gs`, setup in `docs/FEEDBACK.md`). The server adds the received timestamp.
- **Client limits** (overridable, just friction):
  - ≥ 15 s between sends, ≤ 5 per 10 min, ≤ 20 per day;
  - "garbage" detection (too short, no letters, repeated characters, duplicates);
  - from the 10th garbage message on, the client silently stops sending but still says "Thanks".
- **Server limits:**
  - payload ≤ 8 KB, schema check, honeypot;
  - ≤ 30 reports per client ID per rolling 6 h;
  - **≤ 2,000 rows per day globally**;
  - formula-injection guard on every cell.

## 6. Anki output

- `.apkg` built in the browser (sql.js + zip). No media files.
- **One deck per language pair:** `AnkiGen::<Learning> (<Known>)`. Deck, note type and note IDs come from stable hashes, so importing more modules later adds to the same deck, and re-downloading updates notes.
- **Note order:** canonical order (module tree order, then file order).
- **Module membership** goes into hierarchical tags: `ankigen::<category>::<module>`.
- The **note type** has a fixed field list. Templates depend on the configuration. Fields the user switched off are left empty.

## 7. Data

- See `docs/DATA_FORMAT.md`. The data is concept-centric, with per-language layer files, permanent IDs, a linter, and a golden sample in `tests/fixtures/data`.
- Data is generated in resumable units (`docs/GENERATION.md`). The site deploys once all 15 languages are complete. IPA comes last. Etymology content is deferred; the app supports it when present.

## 8. Non-goals (for now)

Audio, images, user accounts, server-side generation, translations of example sentences beyond the slot-parallel scheme, UI localization, slang, analytics.
