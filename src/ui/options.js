// @ts-check
// Step 5: deck options from fields.json → deckOptions: reverse cards, type the answer (needs reverse
// cards) and the Serbian script (shown when Serbian is on either side).

import { usesSerbian } from '../state.js';
import { h } from './dom.js';
import { help } from './popover.js';

/** @type {Record<string, string>} */
const SCRIPT_LABEL = { cyrl: 'Cyrillic', latn: 'Latin' };

/**
 * @param {HTMLElement} root
 * @param {import('./app.js').App} app
 */
export function mountOptions(root, app) {
  const option = (/** @type {string} */ id) => app.meta.fields.deckOptions.find((/** @type {any} */ o) => o.id === id);

  /** @param {string} id @param {(on: boolean) => Partial<import('../state.js').Config>} change */
  function toggle(id, change) {
    const def = option(id);
    const input = h('input', { type: 'checkbox', role: 'switch' });
    input.addEventListener('change', () => app.update(() => change(input.checked)));
    const el = h('div', { class: 'opt' }, h('label', { class: 'switch' }, input, h('span', null, def.label)), help(def.label, def.help));
    root.append(el);
    return { input, el };
  }

  const reverse = toggle('reverse', (on) => ({ reverse: on }));
  const type = toggle('typeAnswer', (on) => ({ type: on }));

  const sr = option('srScript');
  const scriptId = 'opt-sr-script';
  const scripts = /** @type {string[]} */ (sr.values).map((value) => {
    const input = h('input', { type: 'radio', name: scriptId, value });
    input.addEventListener('change', () => app.update(() => ({ srScript: /** @type {any} */ (value) })));
    return input;
  });
  const script = h(
    'div',
    { class: 'opt' },
    h('span', { id: scriptId, class: 'opt-label' }, sr.label),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': scriptId }, ...scripts.map((input, i) => h('label', null, input, h('span', null, SCRIPT_LABEL[sr.values[i]] ?? sr.values[i])))),
    help(sr.label, sr.help),
  );
  root.append(script);

  return {
    /** @param {import('./app.js').View} view */
    update({ config }) {
      reverse.input.checked = config.reverse;
      type.input.checked = config.reverse && config.type;
      type.input.disabled = !config.reverse;
      type.el.classList.toggle('is-disabled', !config.reverse);
      script.hidden = !usesSerbian(config);
      for (const input of scripts) input.checked = input.value === config.srScript;
    },
  };
}
