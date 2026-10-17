// @ts-check
// UI text that is not part of data/meta (field rows and deck options carry their own "help" there).
// The feedback dialog's text is in ui/feedback-dialog.js, which loads on first use.

import { count, number } from './format.js';

export const DRAFT_HELP = [
  'Words, translations and example sentences were drafted with an AI model and are being checked by people, language by language.',
  'If something looks wrong, select it on a preview card and press Ctrl+Enter (⌘+Enter on a Mac), or use the Feedback button in the corner. Every report helps fix the deck for everyone.',
];

export const SAME_HELP =
  'Cards show a short definition in the language you are learning instead of a translation. Good once you can read simple sentences in it.';

export const ADULT_HELP =
  'Swear words, insults and vulgar slang, matched by strength across languages. They are included only when this module is selected, even the ones that also belong to another module.';

/**
 * The "?" on a module with words only some languages have (`only` in the data).
 * @param {number} n @param {string} example @param {string} language English name of the learned language
 */
export function localTermsHelp(n, example, language) {
  const them = n === 1 ? 'it' : 'them';
  return `${count(n, 'word')} here ${n === 1 ? 'is' : 'are'} specific to ${language}, such as ${example}. Other languages have no exact word for ${them}, so your cards explain ${them} in the language you speak.`;
}

export const UPDATE_HELP = {
  title: 'Updating your deck',
  intro:
    'Changed fields, added modules, or want newer data? Download again and import the new file into Anki (File → Import) with the default options. Anki updates your existing notes and their layout, adds new words to the same deck, and keeps your review progress.',
  points: [
    'Your own edits and tags on AnkiGen notes are replaced by the new version. Flags, suspended cards and progress are kept.',
    'New cards go to the deck with exactly this name. If you renamed or moved it, they appear in a new deck with the original name, and you can move them.',
    'If you changed the fields of the AnkiGen note type, tick “Merge note types” when importing, or Anki can’t update these notes.',
    'Turned reverse cards off? Anki keeps the old ones as blank cards. Remove them with Tools → Empty Cards.',
  ],
};

/** @param {string} file */
export const downloadedText = (file) =>
  `Saved ${file}. Open it with Anki (File → Import), or tap it on your phone to open it in AnkiDroid.`;

// ---------------------------------------------------------------- card list

/** @param {import('./app.js').View} view */
export function listEmptyText({ ready, notes }) {
  if (!ready) return 'Loading words…';
  return notes.length ? '' : 'No words for these languages in the chosen modules yet.';
}

/** While searching: "12 of 1,734 words", or that nothing matches. (The search box shows the total.) @param {number} shown @param {number} total @param {string} query */
export function listStatus(shown, total, query) {
  if (!query.trim()) return '';
  if (!shown) return `No words match “${query.trim()}”.`;
  return `${number(shown)} of ${count(total, 'word')}`;
}
