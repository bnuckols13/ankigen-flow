// @ts-check
// Small DOM helpers for the page (no framework), and live texts: a text in the interface language that follows
// a switch to another language (relabel) without rebuilding what it is part of.

import { t } from './i18n.js';

const LIVE = Symbol('live');
/** A text worked out again after every language switch. @typedef {{ [LIVE]: () => string }} Live */

/** @param {() => string} fn @returns {Live} */
export const live = (fn) => ({ [LIVE]: fn });
/** A text of ui/strings.js, live. @param {string} key @param {Record<string, string | number>} [values] */
export const msg = (key, values) => live(() => t(key, values));
/** @param {unknown} value @returns {value is Live} */
const isLive = (value) => typeof value === 'object' && value !== null && LIVE in value;
/** The text now. @param {string | Live} value */
export const textOf = (value) => (isLive(value) ? value[LIVE]() : value);

/** @type {Set<{ ref: WeakRef<Node>, apply: (node: any) => void }>} */
const bound = new Set();
let binds = 0;

/** Keep a node's text up to date; nodes that are gone drop out. @template {Node} N @param {N} node @param {(node: N) => void} apply */
export function bind(node, apply) {
  apply(node);
  bound.add({ ref: new WeakRef(node), apply });
  if (++binds % 512 === 0) for (const b of bound) if (!b.ref.deref()) bound.delete(b);
}

/** Redo every live text, after a language switch. */
export function relabel() {
  for (const b of bound) {
    const node = b.ref.deref();
    if (node) b.apply(node);
    else bound.delete(b);
  }
}

/**
 * The nodes of a text whose {placeholders} are elements: "Created by {name}" with a link for {name}.
 * @param {string} text @param {Record<string, Node>} parts
 */
export function fillNodes(text, parts) {
  return text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 ? (parts[piece] ?? `{${piece}}`) : piece)).filter((p) => p !== '');
}

/**
 * Create an element. Attributes: a string or number is set as is, `true` sets an empty attribute,
 * null/undefined/false skip it, a live text follows the language, and functions named on… become event
 * listeners. Children: nodes, strings and live texts.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any> | null} [attrs]
 * @param {...(Node | string | Live | null | undefined | false)} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (isLive(value)) bind(el, (node) => node.setAttribute(key, value[LIVE]()));
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (isLive(child)) el.append(liveText(child));
    else el.append(child);
  }
  return el;
}

/** A text node that follows the language. @param {Live} text */
function liveText(text) {
  const node = document.createTextNode('');
  bind(node, (n) => (n.data = text[LIVE]()));
  return node;
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
