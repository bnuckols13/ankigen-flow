// @ts-check
// "?" buttons that open a short explanation. The native Popover API closes it on Esc or an outside
// click and returns focus; this module only places it under its button, inside the viewport.

import { h } from './dom.js';

let nextId = 0;
/** @type {{ pop: HTMLElement, anchor: HTMLElement } | null} */
let open = null;

/** @param {HTMLElement} pop @param {HTMLElement} anchor */
function place(pop, anchor) {
  const gap = 6;
  const margin = 8;
  const r = anchor.getBoundingClientRect();
  const width = Math.min(340, window.innerWidth - 2 * margin);
  pop.style.width = `${width}px`;
  pop.style.left = `${Math.min(Math.max(margin, r.left + r.width / 2 - width / 2), window.innerWidth - width - margin)}px`;
  const height = pop.offsetHeight;
  const below = r.bottom + gap;
  const fitsBelow = below + height <= window.innerHeight - margin;
  pop.style.top = `${fitsBelow || r.top - gap - height < margin ? below : r.top - gap - height}px`;
}

window.addEventListener('scroll', () => open && place(open.pop, open.anchor), { passive: true, capture: true });
window.addEventListener('resize', () => open && place(open.pop, open.anchor));

/**
 * A "?" button and its popover, to insert next to the control it explains.
 * @param {string} topic for the accessible name: "About <topic>"
 * @param {string | string[] | Node} content
 * @returns {DocumentFragment}
 */
export function help(topic, content) {
  const id = `help-${++nextId}`;
  const body = typeof content === 'string' || Array.isArray(content) ? [content].flat().map((p) => h('p', null, p)) : [content];
  const pop = h('div', { id, popover: 'auto', class: 'help-pop' }, ...body);
  const button = h('button', { type: 'button', class: 'help', popovertarget: id, 'aria-label': `About ${topic}`, title: `About ${topic}` }, '?');
  pop.addEventListener('toggle', (event) => {
    const opened = /** @type {ToggleEvent} */ (event).newState === 'open';
    if (opened) {
      open = { pop, anchor: button };
      place(pop, button);
    } else if (open?.pop === pop) {
      open = null;
    }
  });
  const fragment = document.createDocumentFragment();
  fragment.append(button, pop);
  return fragment;
}
