// @ts-check
// The live preview (ARCHITECTURE §8): the sample note's card faces, rendered from the deck's own templates
// by deck/render.js, each in a sandboxed iframe with card.css. No scripts run in the frames; allow-same-origin
// only lets the page size each frame to its content (and, later, read selections for reports).
// Light or dark follows the page, as Anki's night mode follows the app.

import { noteFields } from '../deck/fields.js';
import { renderCard } from '../deck/render.js';
import { debounce, h } from './dom.js';
import { deckSize } from './format.js';

/** @typedef {import('./app.js').View} View */

const FRAME_STYLE = 'html,body{margin:0}body{padding:12px 10px}';
const dark = window.matchMedia('(prefers-color-scheme: dark)');

/** @param {string} css @param {string} html */
function frameDoc(css, html) {
  const night = dark.matches ? ' nightMode night_mode' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}\n${FRAME_STYLE}</style></head><body class="card${night}"><div id="qa">${html}</div></body></html>`;
}

/** @param {HTMLIFrameElement} frame */
function fit(frame) {
  const body = frame.contentDocument?.body;
  if (body) frame.style.height = `${Math.ceil(body.getBoundingClientRect().height)}px`;
}

/** @param {View} view */
function emptyText({ config, ready, notes }) {
  if (!config.learn || !config.know) return 'Pick the language you are learning and one you speak to see sample cards here.';
  if (!ready) return 'Loading words…';
  if (!config.modules.length) return 'Choose modules to see sample cards here.';
  if (!notes.length) return 'No words for these languages in the chosen modules yet.';
  return '';
}

/**
 * @param {HTMLElement} root
 * @param {import('./app.js').App} app
 * @param {{ id: string, isActive: () => boolean }} opts  id prefix for headings; whether the preview is on screen
 */
export function mountPreview(root, app, { id, isActive }) {
  const counter = h('p', { class: 'pv-count', 'aria-live': 'polite' });
  const another = h('button', { type: 'button', class: 'button pv-another', onclick: () => app.randomSample() }, 'Another word');
  const empty = h('p', { class: 'pv-empty' });
  /** @type {{ ord: number, side: 'front' | 'back', frame: HTMLIFrameElement, doc: string }[]} */
  const faces = [];
  /** @type {HTMLElement[]} */
  const directions = [];
  for (const [ord, name] of /** @type {[number, string][]} */ ([[0, 'Forward card'], [1, 'Reverse card']])) {
    const figures = /** @type {const} */ (['front', 'back']).map((side) => {
      const frame = h('iframe', { sandbox: 'allow-same-origin', title: `${name}, ${side}`, class: 'pv-frame' });
      frame.addEventListener('load', () => {
        fit(frame);
        frame.contentDocument?.fonts?.ready.then(() => fit(frame));
      });
      faces.push({ ord, side, frame, doc: '' });
      return h('figure', { class: 'pv-face' }, h('figcaption', null, side === 'front' ? 'Front' : 'Back'), frame);
    });
    const section = h('section', { class: 'pv-dir', 'aria-labelledby': `${id}-dir-${ord}` }, h('h3', { id: `${id}-dir-${ord}` }, name), h('div', { class: 'pv-pair' }, ...figures));
    directions.push(section);
  }
  const body = h('div', { class: 'pv-faces' }, ...directions);
  root.append(h('div', { class: 'pv-tools' }, counter, another), empty, body);

  let stale = true;

  /** @param {View} view */
  function render(view) {
    if (!isActive()) {
      stale = true;
      return;
    }
    stale = false;
    counter.textContent = view.ready && view.config.modules.length ? deckSize(view.notes.length, view.cards) : '';
    const message = emptyText(view);
    empty.textContent = message;
    empty.hidden = !message;
    body.hidden = Boolean(message);
    another.hidden = Boolean(message);
    another.disabled = view.notes.length < 2;
    if (message || !view.sample || !view.ctx || !view.noteType) return;
    const fields = noteFields(view.sample, view.ctx);
    const css = view.noteType.css;
    directions[1].hidden = !view.config.reverse;
    for (const face of faces) {
      const card = renderCard(view.noteType, fields, face.ord);
      if (!card) continue;
      const doc = frameDoc(css, card[face.side]);
      if (doc !== face.doc) {
        face.doc = doc;
        face.frame.srcdoc = doc;
      }
    }
  }

  const scheduled = debounce(render, 60);
  const refit = debounce(() => faces.forEach((f) => fit(f.frame)), 50);
  new ResizeObserver(refit).observe(body);
  dark.addEventListener('change', () => {
    for (const face of faces) face.doc = '';
    render(app.view());
  });

  return {
    /** @param {View} view */
    update: scheduled,
    /** Render now if updates were skipped while hidden. */
    show() {
      if (stale) render(app.view());
    },
  };
}
