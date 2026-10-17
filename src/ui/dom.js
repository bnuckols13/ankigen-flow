// @ts-check
// Small DOM helpers for the page (no framework).

/**
 * Create an element. Attributes: a string or number is set as is, `true` sets an empty attribute,
 * null/undefined/false skip it, and functions named on… become event listeners.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any> | null} [attrs]
 * @param {...(Node | string | null | undefined | false)} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) el.append(child);
  return el;
}

/**
 * Run `fn` once calls have stopped for `ms` milliseconds.
 * @template {any[]} A
 * @param {(...args: A) => void} fn @param {number} ms
 * @returns {(...args: A) => void}
 */
export function debounce(fn, ms) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Run `fn` when the browser is idle (or soon, where requestIdleCallback is missing). @param {() => void} fn */
export function whenIdle(fn) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 3000 });
  else setTimeout(fn, 200);
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = {
  flag: '<path d="M3.5 14.5v-13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 2h8.5l-2.2 3.25L12.5 8.5H4z" fill="currentColor"/>',
  list: '<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
};

/** A small inline icon, hidden from screen readers (the button around it has the name). @param {keyof typeof ICONS} name */
export function icon(name) {
  const span = h('span', { class: 'icon', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" focusable="false">${ICONS[name]}</svg>`;
  return span;
}
