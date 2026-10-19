// @ts-check
// Texts the page puts together from ui/strings.js, in the interface language (ui/i18n.js). Pure.

import { number, plural, t } from './i18n.js';

/** "1,734 notes · 3,468 cards". @param {number} notes @param {number} cards */
export const deckSize = (notes, cards) => `${plural('note', notes)} · ${plural('card', cards)}`;

/**
 * The "?" on a module with words only some languages have (`only` in the data).
 * @param {number} n @param {string} example
 */
export const localTermsHelp = (n, example) => plural('localTerms', n, { example });

/** What the word list says instead of rows. @param {import('./app.js').View} view */
export function listEmptyText({ ready, notes }) {
  if (!ready) return t('preview.loading');
  return notes.length ? '' : t('preview.empty');
}

/** While searching: "12 of 1,734 words", or that nothing matches. (The search box shows the total.) @param {number} shown @param {number} total @param {string} query */
export function listStatus(shown, total, query) {
  if (!query.trim()) return '';
  if (!shown) return t('list.noMatch', { query: query.trim() });
  return plural('matches', total, { shown: number(shown) });
}
