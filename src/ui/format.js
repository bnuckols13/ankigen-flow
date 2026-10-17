// @ts-check
// Numbers and counts in the UI text. Pure.

const NUMBER = new Intl.NumberFormat('en-US');

/** "1 note", "1,734 notes". @param {number} n @param {string} one @param {string} [many] */
export function count(n, one, many = `${one}s`) {
  return `${NUMBER.format(n)} ${n === 1 ? one : many}`;
}

/** "1,734 notes · 3,468 cards". @param {number} notes @param {number} cards */
export function deckSize(notes, cards) {
  return `${count(notes, 'note')} · ${count(cards, 'card')}`;
}
