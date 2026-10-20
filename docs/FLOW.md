# Flow drills

AnkiGen Flow is a fork of [AnkiGen](https://github.com/xenohunter/ankigen) that adds the practice of Idahosa Ness's Mimic Method (the Flow School) to the decks AnkiGen builds. AnkiGen's own documents (`SPEC.md`, `ARCHITECTURE.md`, `DATA_FORMAT.md`) still describe the vocabulary, the page and the package; this one describes what the fork adds and why.

## 1. The premise

Ness names four things that stop an adult from speaking: overanalysis (mind/body), not hearing or producing sounds fast enough (ear/mouth), attachment to the first-language identity (ego/spirit), and the plain gap in words and grammar (knowledge/experience). His claim is that conventional study fills the fourth gap while making the first three worse, and that the flash card is the conventional study in its purest form: silent, solitary, eye to page.

A deck cannot run a class. It can stop being silent. Every drill below turns a card from a test for the eye into a cue for the mouth, with Anki's own text-to-speech as the native voice. Nothing is uploaded, no media files are built: the cards carry `{{tts}}` tags, which Anki desktop, AnkiDroid and AnkiMobile all read with the voices installed on the device.

## 2. The drills

| Drill | Ness's practice | What the card does |
|---|---|---|
| **Speak the word** (`audio`) | ear before page | The word, article included, is spoken on the front of forward cards and on the back of reverse cards. |
| **Ear cards** (`ear`) | ear before page; IPA as the sound page | A third card per word: the word is heard, and shown in IPA when that row is on, before it is ever seen spelled. Say it back, then flip. The spelling waits on the back. |
| **Shadow cards** (`shadow`, `speed`) | shadowing; quarter-speed listening | For every word with an example: the sentence plays at the slow speed (¼, ½ or ¾), then at full speed, with no text. Shadow it live, melody first. The sentence, its translation and the word are on the back. |
| **Reflex cards** (`reflex`) | grammar as reflex, no charts | A stimulus answered before thought. A noun in an article language asks for its article (mesa → la mesa); otherwise the first key form the entry has (ser → soy; вода → gen. воды; 食べる → 食べます). A bar drains in a moment and a half. The answer is on the back, spoken. |
| **Drill cues** (`cues`) | whisper, pause, warmth; awareness of body, face, voice | A short cue closes every question side, fixed per word by a hash of its key: whisper it; say it and hold a long pause; hold someone you love in mind; hum the melody first; say it with the whole face; stand up; quarter speed then full; say it as your model. |
| **Speak as** (`voice`) | the ego switch | The name of one native speaker whose voice the learner borrows. Every question side ends with "as <name>", and the model cue names them. |

Everything is off by default: a deck with no drill on is AnkiGen's deck, field for field (the flow fields are empty), under the fork's own names.

## 3. In the package

- **Fields.** AnkiGen's 19 fields keep their order; nine follow: `Speech` (what text-to-speech reads for the word), `Ear` (`1` when ear cards are on), `ShadowSpeech`, `ShadowLine`, `ShadowGloss`, `ReflexPrompt`, `ReflexAnswer`, `ReflexSpeech`, `Cue`. A field is filled only while its drill is on.
- **Templates.** `Forward`, `Reverse`, `Ear`, `Shadow`, `Reflex`, in that order. Each flow question is wrapped in its own field (`{{#Ear}}`, `{{#ShadowSpeech}}`, `{{#ReflexAnswer}}`), so Anki creates the card only for notes that have the drill, and turning a drill off never changes the note type. Turning one off after studying leaves blank cards, which Tools → Empty Cards removes, as with reverse cards.
- **Speech.** `{{tts <lang>:Speech}}`, with the language from the registry's locale (`es-ES` → `es_ES`, `zh-Hans-CN` → `zh_CN`). The slow pass is `{{tts <lang> speed=0.5:ShadowSpeech}}`. Speech text has no HTML, no Russian stress marks and no furigana; Serbian follows the chosen script; the article is always included, so the ear learns `la mesa`, not `mesa`.
- **Names and IDs.** Decks are `AnkiGen Flow::<pair>`, note types `AnkiGen Flow <pair>`, files `ankigen-flow-<learn>-<know>-<data>.apkg`, and the hash prefix is `ankigen-flow/v1/`. A Flow deck never collides with a deck from the original site, and re-downloading updates the same notes.
- **The hash.** `a=1` audio, `e=1` ear, `s=1&sp=0.5` shadow and its slow pass, `rx=1` reflex, `cu=1` cues, `vc=<name>` the voice. Unknown values fall back as the rest of the hash does.
- **The deck description** names the drills on, says that the cards speak with the device's text-to-speech, and names the voice.

## 4. On the page

Step 6, **Flow drills**, sits between Card options and Download: five switches, the slow pass, and the name of the voice. The preview shows the ear, shadow and reflex cards beside the forward and reverse ones, with a speaker mark where Anki will show its play button; the live count includes every card the export creates. The step's texts are English only: they live in `src/ui/flow.js`, outside `src/ui/strings.js`, so the translation checker and `data/ui` are untouched. The card captions ("Shadow", "Reflex", the cues) are English too.

## 5. What is not here

- **Tibetan**, or any language AnkiGen does not ship. The drills work on the data AnkiGen has.
- **A listener.** Ness's method depends on a coach catching what the student cannot hear. A card can cue the mouth; it cannot score it. The weekly recording and the tutor's three worst errors stay outside Anki.
- **Timing enforcement.** The reflex bar is a CSS animation; Anki does not know when it emptied.
- **Translations** of the drill texts, and known-language captions for the flow sections in `labels.json`.

## 6. Code map

```
src/deck/flow.js      the drills: speech text, shadow and reflex fields, cues, counts, tts tags (pure)
src/deck/templates.js the five templates
src/deck/fields.js    the nine flow fields, after AnkiGen's
src/deck/render.js    {{tts}} rendered as a speaker mark for the preview
src/deck/names.js     AnkiGen Flow names; src/deck/ids.js: the ankigen-flow/v1/ prefix
src/deck/apkg.js      the deck description
src/state.js          the config keys and their hash
src/ui/flow.js        step 6 (loaded when the step appears)
src/ui/preview.js     the flow cards in the preview
css/card.css          the cards' flow styles (embedded in the note type)
tests/flow.test.mjs   the drills' tests
```
