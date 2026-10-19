// @ts-check
// Steps 1–2: language chips. Native names, with the name in the interface language as a tooltip and for screen
// readers. Step 2 starts with "Same language" (definitions instead of translations) on a row of its own, set
// apart from the languages. Hovering or focusing a chip starts loading that language's words. The chips are
// native radio buttons, so arrow keys move within a group.

import { SAME } from '../state.js';
import { h, live, msg } from './dom.js';
import { languageName, t } from './i18n.js';

/** @typedef {import('./app.js').App} App */
/** @typedef {import('./dom.js').Live} Live */

/**
 * @param {{ learn: HTMLElement, know: HTMLElement, learnStatus: HTMLElement, knowStatus: HTMLElement }} roots
 * @param {App} app
 */
export function mountLanguages(roots, app) {
  const registry = app.meta.languages.languages;

  /**
   * @param {'learn' | 'know'} group @param {string} code @param {string | Live} text
   * @param {{ title?: Live, hint?: Live, lang?: string }} [opts] title: tooltip; hint: for screen readers, after the text
   */
  function chip(group, code, text, { title, hint, lang } = {}) {
    const input = h('input', { type: 'radio', name: group, value: code, class: 'chip-input' });
    input.addEventListener('change', () => app.update(() => ({ [group]: code })));
    if (code !== SAME) input.addEventListener('focus', () => app.prefetch(code));
    const label = h(
      'label',
      { class: 'chip', title, onpointerenter: code === SAME ? null : () => app.prefetch(code) },
      input,
      h('span', { lang: lang ?? null }, text),
      hint ? h('span', { class: 'sr-only' }, hint) : null,
    );
    return { code, input, label };
  }

  /** @param {'learn' | 'know'} group @param {string} code */
  function languageChip(group, code) {
    const reg = registry[code];
    const name = () => languageName(code, reg.name);
    return chip(group, code, reg.native, {
      title: live(() => (name() === reg.native ? '' : name())),
      hint: live(() => (name() === reg.native ? '' : ` (${name()})`)),
      lang: reg.locale ?? code,
    });
  }

  const active = /** @type {string[]} */ (app.meta.languages.active);
  const learn = active.map((code) => languageChip('learn', code));
  const know = active.map((code) => languageChip('know', code));
  const same = chip('know', SAME, msg('lang.same'), { title: msg('lang.sameHelp') });
  same.input.setAttribute('aria-describedby', 'same-note');
  roots.learn.append(...learn.map((c) => c.label));
  roots.know.append(
    h('div', { class: 'same-row' }, same.label, h('span', { class: 'same-note', id: 'same-note' }, h('span', { 'aria-hidden': 'true' }, '— '), msg('lang.sameNote'))),
    h('div', { class: 'chips' }, ...know.map((c) => c.label)),
  );

  /** Status line under a chip group: loading, or a load failure. @param {HTMLElement} el @param {string | null} code */
  function status(el, code) {
    const language = code && code !== SAME && registry[code] ? languageName(code, registry[code].name) : null;
    if (language && (app.isLoading(code ?? '') || app.isLoading('concepts'))) el.textContent = t('lang.loading', { language });
    else if (language && app.hasFailed(code ?? '')) el.textContent = t('lang.failed', { language });
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
