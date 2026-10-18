# Language guides

Per-language conventions for `lang`, `review` and `ipa` units. The registry (`data/meta/languages.json`) defines the allowed keys; this file says how to fill them. "Formal you" means the polite second-person form the concept `word-you-formal` maps to.

People nouns (all gendered languages): `w` is the masculine (or common) form; give the feminine counterpart in `forms.f` (ru учи́тельница, de Lehrerin, es profesora, fr actrice) when one exists.

Definition style (all languages): one short sentence. English: lower-case start, no final period (learner-dictionary style). All other languages: capitalized, ending with a period (or the language's full stop).

---

## en — English (US)
- US spelling and vocabulary: apartment, truck, gas, cell phone, driver's license, fall (season), elevator.
- Verbs without "to"; phrasal verbs are fine (`pick up`). Nouns in singular, lower case except proper names and weekdays/months.
- `forms`: only irregular — noun `pl` (children), verb `past` + `pp` (ate, eaten), adj `comp` + `sup` (better, best).
- English examples are the source for every other language: keep them literal-friendly (see lang.md).

## ru — Russian
- **Stress**: U+0301 after the stressed vowel in every word of 2+ syllables in `w`, `alt`, `forms` (молоко́, вы́пить). Never on ё (it is always stressed; always write ё, never е for ё). Not in `hint`, `def`, `gl`. In examples, stress only inside the `{target}`.
- Nouns: `g` m|f|n|mf|pl (pl = plurale tantum: су́тки, но́жницы). `forms.gen` = genitive singular (genitive plural for pluralia tantum); `forms.pl` = nominative plural if it exists.
- Verbs: lemma is the imperfective unless the concept is inherently perfective. `aspect` ipf|pf|bi, `pair` = the aspect partner (most common one). `1sg`, `2sg` (present for ipf, simple future for pf), `3pl` when irregular, `past` as "m, f" when stress shifts or stem changes (пил, пила́; нёс, несла́).
- Adjectives: masculine nominative singular; `comp` when irregular (лу́чше), `short` when the short form is common ("рад, ра́да").
- Formal you: вы.

## sr — Serbian (Serbia, ekavian)
- **Cyrillic only** everywhere (entries, hints, definitions, examples). The app derives Latin automatically. Ekavian: млеко, дете, река, лепо.
- Serbian of Serbia, not Croatian/Bosnian: воз (not влак), хлеб, кафа, недеља = Sunday and week (collision → hints), сто (table), пиринач.
- Nouns: `g` m|f|n|pl; `forms.gen` genitive singular; `forms.pl` nominative plural (браћа, деца).
- Verbs: infinitive (-ти, -ћи). `aspect`, `pair`, `1sg`, `3pl` when irregular, `lpt` = active past participle "m, f" (јео, јела).
- Adjectives: the long (definite) masculine form used attributively (велики, нови, мали); `f` feminine, `comp` when irregular (бољи, већи).
- No accent marks. Formal you: ви.

## ja — Japanese
- `w`: the usual written form — kanji where Japanese normally uses kanji, kana where normally kana (する, ある, これ, ちょっと). Katakana for loanwords.
- `read`: kana reading, required when `w` contains kanji (hiragana; katakana stays katakana).
- `rom`: modified Hepburn with macrons for long ō/ū (and ā/ē/ī in loanwords): とうきょう tōkyō, おおきい ōkii, くうき kūki; えい stays ei, いい stays ii; っ doubles the consonant; ん before a vowel/y → n' (kin'en). Spaces between words of multi-word entries.
- Verbs: dictionary form; `forms.class` godan|ichidan|suru|kuru, `masu` (食べます), `te` (食べて), `nai` (食べない). する-compounds: `w` 勉強する, class suru.
- Adjectives: i-adjectives `type: "i"` + `neg` (高くない); na-adjectives `type: "na"`, `w` without な.
- `mw` (counter) for countable nouns that have a specific common counter: 本, 枚, 匹, 台, 冊, 人, 軒, 着. Omit when only つ/個 would apply.
- Phrases: the natural polite form where politeness matters (すみません, お願いします).
- Definitions and glosses use full-width punctuation too: `ギブドド：ロシアの交通警察` (lint rejects ASCII , : ; ! ? ( ) next to Japanese text).
- Examples: natural Japanese, consistent style per sentence (です/ます is the default). Full-width punctuation 。、！？. **Furigana syntax** (the same as Anki's): every kanji run is followed by its reading in square brackets, `日本[にほん]`. When a kanji run follows kana or other characters, put one space before it: `お 茶[ちゃ]を 飲[の]みます` (the space is invisible in the rendered card). The target goes in braces around the furigana: `{食[た]べます}`. Definitions (`def`) use plain text without furigana.

## zh — Chinese (Mandarin, Simplified, mainland)
- `w` in simplified characters, mainland usage (出租车, 自行车, 手机, 地铁).
- `read`: pinyin with tone marks, syllables of one word joined (yínháng, xiǎoshuō); neutral tone unmarked (péngyou); dictionary (citation) tones for 一 and 不, no sandhi.
- `mw`: the usual measure word for nouns (本, 张, 只, 条, 辆, 件, 把, 位); use 个 only when no more specific one is standard. Omit for uncountables.
- No forms. Definitions in simple Chinese.
- Hanzi text (`t`, `def`, `gl`) uses full-width punctuation ，。：；！？（）, also next to Latin words: `导入 Anki（File → Import）`. Only the pinyin `r` uses ASCII punctuation; lint rejects ASCII marks next to hanzi.
- Examples: hanzi with the target in braces; `r` = pinyin of the whole sentence with tone marks, words separated by spaces, ASCII punctuation, no braces: `{"t":"我每天喝{水}。","r":"Wǒ měitiān hē shuǐ."}`.

## de — German (Germany)
- Nouns capitalized, without article in `w`; `g` m|f|n|pl. `forms.pl` whenever a plural exists (Brüder, Hände); `forms.gen` only when not simply -(e)s (des Namens, des Herrn).
- Verbs: infinitive; `3sg` (isst, fährt), `pret` (aß), `pp` with auxiliary (hat gegessen, ist gefahren). Separable: `w` aufstehen, 3sg "steht auf", pret "stand auf", pp "ist aufgestanden". Reflexive: "sich freuen".
- Adjectives: `comp` and `sup` when irregular or umlauted (größer, am größten).
- Formal you: Sie.

## es — Spanish (Spain)
- Peninsular vocabulary: coche, ordenador, móvil, zumo, piso, gafas, conducir. vosotros forms are normal Spain usage.
- Nouns: `g` m|f|mf|m.pl|f.pl. `art: "el"` for feminine nouns with stressed initial a-/ha- (el agua, el hambre). `forms.pl` only when irregular.
- Verbs: `1sg` present (hago), `pret` preterite 3sg (hizo), `pp` (hecho). Reflexive: "levantarse".
- Adjectives: `f` when different (bueno → buena). Formal you: usted.

## pt — Portuguese (Portugal)
- European Portuguese vocabulary and spelling (post-1990 agreement as used in Portugal): comboio, autocarro, pequeno-almoço, frigorífico, telemóvel, casa de banho, ecrã, facto, receção.
- Nouns: `g` m|f|mf|m.pl|f.pl. `forms.pl` only when irregular (pão → pães, avião → aviões).
- Verbs: `1sg` present (faço), `pret` pretérito perfeito 1sg (fiz), `pp` (feito). Reflexive with hyphen: "levantar-se".
- Adjectives: `f` when different. Informal you: tu; formal: você / o senhor (concept mapping per note).

## pl — Polish
- Nouns: `g` m|f|n|pl; `forms.gen` genitive singular, `forms.pl` nominative plural.
- Verbs: `aspect`, `pair`, `1sg`, `2sg` (present for ipf, future for pf), `past` 3sg masculine.
- Adjectives: masculine nominative; `comp` when irregular (lepszy). Formal you: Pan/Pani.

## ko — Korean (South Korea)
- `w` in Hangul. `rom`: official Revised Romanization including its sound-change rules, lower case (한국어 hangugeo, 신라 silla).
- `hanja`: only for Sino-Korean words (은행 → 銀行). Omit for native words and loanwords.
- Verbs and adjectives (descriptive verbs): `w` dictionary form (-다); `haeyo` polite present (가요, 예뻐요); `past` polite past (갔어요).
- Examples: polite 해요체 by default; target in braces around the conjugated form. No romanization in examples.

## nl — Dutch (Netherlands)
- Nouns: `g` c (de-word) | n (het-word) | pl. `forms.pl` whenever it exists; `forms.dim` when the diminutive is common (kopje).
- Verbs: `past` as "sg, pl" (at, aten), `pp` with auxiliary (heeft gegeten, is gegaan).
- Adjectives: `comp` when irregular (beter). Formal you: u.

## fr — French (France)
- Nouns: `g` m|f|mf|m.pl|f.pl. Nouns starting with a vowel or h need `art`: "l'" (h muet: l'homme) or "le"/"la" (h aspiré: le héros). `forms.pl` only when irregular (yeux, chevaux); `forms.f` for the feminine counterpart of people/animals (acteur → actrice).
- Verbs: `1sg` (je fais → "fais"), `1pl` when irregular, `pp` (fait), `aux` avoir|être. Pronominal: "se laver" (aux être).
- Adjectives: `f` when different (beau → belle), `pl` when irregular. Formal you: vous.

## hy — Armenian (Eastern, reformed orthography)
- Armenian script only; Eastern Armenian as used in Armenia, reformed spelling (ուժ, not ույժ).
- Nouns: `forms.pl` nominative plural (-եր / -ներ). No gender.
- Verbs: infinitive (-ել / -ալ); `aor` aorist 3sg (գրեց, կարդաց); `imp` imperative 2sg when irregular.
- Formal you: դուք. Romanization is generated by the app (BGN/PCGN); do not add `rom`.

## tr — Turkish (Turkey)
- Mind ı/i, İ/I. Nouns: `forms.acc` definite accusative (kitabı, ağacı, suyu) — shows consonant changes and harmony; `pl` only if irregular; `poss3` when irregular (su → suyu).
- Verbs: infinitive (-mek/-mak); `aor` aorist 3sg (gelir, yapar, alır) required; `prog` (geliyor) and `past` (geldi) optional.
- Formal you: siz.

## el — Greek (Modern, monotonic)
- Monotonic orthography only; the tonos is mandatory on every word of 2+ syllables.
- Nouns: `g` m|f|n|mf|m.pl|f.pl|n.pl (article is derived: ο/η/το). `forms.gen` genitive singular, `forms.pl` nominative plural.
- Verbs: lemma = 1sg present (γράφω); `aor` simple past 1sg (έγραψα); `fut` "θα + perfective 1sg" (θα γράψω).
- Adjectives: masculine nominative; `f` and `n` required (καλός, καλή, καλό).
- Formal you: εσείς. Romanization is generated by the app (ELOT 743); do not add `rom`.
