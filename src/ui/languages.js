// @ts-check
// Steps 1–2: language chips. Native names, with the English name as a tooltip and for screen readers;
// "Same language" in step 2. Hovering or focusing a chip starts loading that language's words.
// The chips are native radio buttons, so arrow keys move within a group.

import { SAME } from '../state.js';
import { SAME_HELP } from './copy.js';
import { h } from './dom.js';
import { help } from './popover.js';

/** @typedef {import('./app.js').App} App */

/**
 * @param {{ learn: HTMLElement, know: HTMLElement, learnStatus: HTMLElement, knowStatus: HTMLElement }} roots
 * @param {App} app
 */
export function mountLanguages(roots, app) {
  const registry = app.meta.languages.languages;

  /** @param {'learn' | 'know'} group @param {string} code @param {string} native @param {string} english @param {string} [lang] */
  function chip(group, code, native, english, lang) {
    const input = h('input', { type: 'radio', name: group, value: code, class: 'chip-input' });
    input.addEventListener('change', () => app.update(() => ({ [group]: code })));
    if (code !== SAME) input.addEventListener('focus', () => app.prefetch(code));
    const label = h(
      'label',
      { class: 'chip', title: native === english ? null : english, onpointerenter: code === SAME ? null : () => app.prefetch(code) },
      input,
      h('span', { lang: lang ?? null }, native),
      native === english ? null : h('span', { class: 'sr-only' }, ` (${english})`),
    );
    return { code, input, label };
  }

  const languageChip = (/** @type {'learn' | 'know'} */ group, /** @type {string} */ code) =>
    chip(group, code, registry[code].native, registry[code].name, registry[code].locale ?? code);

  const active = /** @type {string[]} */ (app.meta.languages.active);
  const learn = active.map((code) => languageChip('learn', code));
  const know = active.map((code) => languageChip('know', code));
  const same = chip('know', SAME, 'Same language', 'Same language');
  roots.learn.append(...learn.map((c) => c.label));
  roots.know.append(...know.map((c) => c.label), h('span', { class: 'chip-with-help' }, same.label, help('Same language', SAME_HELP)));

  /** Status line under a chip group: loading, or a load failure. @param {HTMLElement} el @param {string | null} code */
  function status(el, code) {
    const name = code && code !== SAME ? registry[code]?.name : null;
    if (name && (app.isLoading(code ?? '') || app.isLoading('concepts'))) el.textContent = `Loading ${name} words…`;
    else if (name && app.hasFailed(code ?? '')) el.textContent = `Could not load the ${name} words. Check your connection and reload the page.`;
    else el.textContent = '';
  }

  return {
    /** @param {import('./app.js').View} view */
    update({ config }) {
      for (const c of learn) c.input.checked = c.code === config.learn;
      for (const c of know) {
        c.input.checked = c.code === config.know;
        c.input.disabled = c.code === config.learn;
      }
      same.input.checked = config.know === SAME;
      status(roots.learnStatus, config.learn);
      status(roots.knowStatus, config.know);
    },
  };
}
