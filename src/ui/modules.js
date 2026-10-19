// @ts-check
// Step 3: the module tree (SPEC §2). Categories expand and collapse and have a checkbox for all their
// modules; each module shows how many words it has for the chosen languages. An 18+ badge marks adult
// modules, and a "?" explains words that only some languages have (country-specific terms).

import { localTermsHelp } from './copy.js';
import { h, live, msg } from './dom.js';
import { categoryName, moduleText, number, plural, t } from './i18n.js';
import { help } from './popover.js';

/** @typedef {import('./app.js').App} App */
/** @typedef {import('./app.js').View} View */

/**
 * @param {HTMLElement} root @param {HTMLElement} summary the line under the step heading
 * @param {App} app
 */
export function mountModules(root, summary, app) {
  const { meta } = app;
  const initial = new Set(app.store.get().modules);
  /** @type {{ id: string, input: HTMLInputElement, words: HTMLElement, local: HTMLElement, localText: HTMLElement }[]} */
  const modules = [];
  /** @type {{ input: HTMLInputElement, tally: HTMLElement, ids: string[] }[]} */
  const categories = [];

  /** @param {string[]} ids @param {boolean} on */
  const setModules = (ids, on) =>
    app.update((config) => ({ modules: on ? [...config.modules, ...ids] : config.modules.filter((m) => !ids.includes(m)) }));

  for (const cat of meta.modules.categories) {
    const ids = cat.modules.map((/** @type {any} */ m) => m.id);
    const listId = `modules-${cat.id}`;
    const list = h('ul', { class: 'mod-list', id: listId });
    // Open by default as modules.json says, and wherever the loaded config already selects something.
    const open = Boolean(cat.open) || ids.some((/** @type {string} */ id) => initial.has(id));
    list.hidden = !open;
    const name = live(() => categoryName(cat));
    const toggle = h('button', {
      type: 'button',
      class: 'cat-toggle',
      'aria-expanded': String(open),
      'aria-controls': listId,
      'aria-label': live(() => t('modules.show', { category: categoryName(cat) })),
    });
    toggle.addEventListener('click', () => {
      list.hidden = !list.hidden;
      toggle.setAttribute('aria-expanded', String(!list.hidden));
    });
    const input = h('input', { type: 'checkbox', class: 'cat-check' });
    input.addEventListener('change', () => setModules(ids, input.checked));
    const tally = h('span', { class: 'cat-tally' });
    categories.push({ input, tally, ids });

    for (const m of cat.modules) {
      const box = h('input', { type: 'checkbox', value: m.id, 'aria-describedby': `desc-${m.id}` });
      box.addEventListener('change', () => setModules([m.id], box.checked));
      const words = h('span', { class: 'mod-words' });
      const localText = h('p');
      const local = h('span', { class: 'mod-help', hidden: true }, help(live(() => t('modules.localTopic', { module: moduleText(m).name })), localText));
      list.append(
        h(
          'li',
          { class: 'mod' },
          h(
            'div',
            { class: 'mod-head' },
            h('label', { class: 'mod-label' }, box, h('span', { class: 'mod-name' }, live(() => moduleText(m).name))),
            m.adult ? h('span', { class: 'badge' }, '18+') : null,
            m.adult ? help(msg('modules.adultTopic'), msg('modules.adultHelp')) : null,
            local,
            words,
          ),
          h('p', { class: 'mod-desc', id: `desc-${m.id}` }, live(() => moduleText(m).desc)),
        ),
      );
      modules.push({ id: m.id, input: box, words, local, localText });
    }

    root.append(
      h(
        'div',
        { class: 'cat' },
        h('div', { class: 'cat-head' }, toggle, h('label', { class: 'cat-label' }, input, h('span', { class: 'cat-name' }, name)), tally),
        list,
      ),
    );
  }

  const total = modules.length;
  return {
    /** @param {View} view */
    update({ config, ready, counts, local }) {
      const selected = new Set(config.modules);
      for (const m of modules) {
        m.input.checked = selected.has(m.id);
        m.words.textContent = ready ? plural('word', counts.get(m.id) ?? 0) : '';
        const terms = ready ? local.get(m.id) : undefined;
        m.local.hidden = !terms;
        if (terms) m.localText.textContent = localTermsHelp(terms.count, terms.example);
      }
      for (const c of categories) {
        const n = c.ids.filter((id) => selected.has(id)).length;
        c.input.checked = n === c.ids.length;
        c.input.indeterminate = n > 0 && n < c.ids.length;
        c.tally.textContent = n ? t('modules.tally', { n: number(n), total: number(c.ids.length) }) : '';
      }
      summary.textContent = selected.size ? plural('modulesChosen', selected.size, { total: number(total) }) : t('modules.hint');
    },
  };
}
