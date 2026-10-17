// @ts-check
// Feedback entry points (SPEC §5, ARCHITECTURE §9): the Feedback button in the corner, Ctrl/Cmd+Enter, and
// where a report comes from: the selected text, its card (data-concept, data-word), its field (data-field)
// and the card face (data-dir, data-side). Selections are read in the page and in the preview frames; the
// frames run no scripts, so the page listens to their documents itself (watch). Buttons marked data-report
// take the selection on pointerdown, because on phones a tap clears it before the click.
// The dialog (ui/feedback-dialog.js, with feedback/client.js) loads when the browser is idle, or on first use.

import { h, icon, whenIdle } from './dom.js';

/**
 * Where a report points. Every key is optional: feedback can be about nothing in particular.
 * @typedef {object} ReportContext
 * @property {string} [selectedText]
 * @property {string} [conceptId]  one concept ID, or a merged note's IDs joined by commas
 * @property {string} [word]       the card's word, shown in the dialog
 * @property {string} [direction]  forward | reverse
 * @property {string} [side]       front | back
 * @property {string} [field]      the note type field
 */

/**
 * Open the dialog about `fallback`, unless text is selected on a card (or anywhere, without a fallback).
 * @typedef {(fallback?: ReportContext | null, opts?: { useSelection?: boolean }) => void} ReportFn
 */

/** How long a selection taken on pointerdown waits for its click. */
const PENDING_MS = 3000;

/**
 * The selection in a document, and where it is; null when there is none.
 * @param {Document} doc @returns {ReportContext | null}
 */
function readSelection(doc) {
  const selection = doc.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const text = selection.toString().replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const node = selection.getRangeAt(0).commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? /** @type {Element} */ (node) : node.parentElement;
  if (!el || el.closest('.fb, input, textarea, select')) return null;
  const attr = (/** @type {string} */ name) => el.closest(`[${name}]`)?.getAttribute(name) ?? '';
  return {
    selectedText: text.slice(0, 1000),
    conceptId: attr('data-concept'),
    word: attr('data-word'),
    field: attr('data-field'),
    direction: attr('data-dir'),
    side: attr('data-side'),
  };
}

/**
 * @param {{ app: import('./app.js').App, storage: Storage | null }} opts
 */
export function mountFeedback({ app, storage }) {
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘+Enter' : 'Ctrl+Enter';
  /** @type {Document | null} the document whose selection changed last: the page or a preview frame */
  let selectionDoc = null;
  /** @type {{ context: ReportContext | null, time: number } | null} */
  let pending = null;
  /** @type {Promise<import('./feedback-dialog.js').Dialog> | null} */
  let dialog = null;

  function loadDialog() {
    if (!dialog) {
      dialog = import('./feedback-dialog.js').then((m) => m.createDialog({ app, storage, shortcut, onSent }));
      dialog.catch(() => (dialog = null)); // offline: the next try loads it again
    }
    return dialog;
  }

  /** A quote that was reported stays selected otherwise, and the next report would quote it again. @param {ReportContext | null} context */
  function onSent(context) {
    if (!context?.selectedText) return;
    for (const doc of [selectionDoc, document]) doc?.getSelection()?.removeAllRanges();
    selectionDoc = null;
  }

  /** The current selection: in the document where it changed last, else in the page. */
  const current = () => (selectionDoc?.defaultView ? readSelection(selectionDoc) : null) ?? readSelection(document);

  /** @type {ReportFn} */
  function open(fallback = null, { useSelection = true } = {}) {
    const taken = pending && Date.now() - pending.time < PENDING_MS ? pending.context : current();
    pending = null;
    const selection = useSelection ? taken : null;
    const context = selection && (selection.conceptId || selection.direction || !fallback) ? selection : fallback;
    loadDialog().then((d) => d.show(context), () => {});
  }

  /** Ctrl/Cmd+Enter: report the selection, else the card in focus (a list row), else just feedback. @param {KeyboardEvent} event */
  function onKeydown(event) {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
    event.preventDefault();
    pending = null;
    const card = document.activeElement?.closest('[data-concept]');
    open(card ? { conceptId: card.getAttribute('data-concept') ?? '', word: card.getAttribute('data-word') ?? '' } : null);
  }

  /** Follow the selection and the shortcut in a document: the page, or a preview frame once it has loaded. @param {Document} doc */
  function watch(doc) {
    doc.addEventListener('selectionchange', () => {
      if (readSelection(doc)) selectionDoc = doc;
      else if (selectionDoc === doc) selectionDoc = null;
    });
    doc.addEventListener('keydown', onKeydown);
  }

  const fab = h(
    'button',
    { type: 'button', class: 'fab', 'data-report': true, title: `Feedback (${shortcut})`, onclick: () => open() },
    icon('flag'),
    h('span', { class: 'fab-label' }, 'Feedback'),
  );
  document.body.append(fab);
  watch(document);
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (/** @type {Element} */ (event.target).closest?.('[data-report]')) pending = { context: current(), time: Date.now() };
    },
    true,
  );
  whenIdle(() => loadDialog().catch(() => {}));

  return { open, watch };
}
