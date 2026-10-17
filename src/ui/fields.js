// @ts-check
// Step 4: the card field table (SPEC §3). Only rows that apply to the chosen languages are shown, each with
// its placements (Off / Front / Back, or With the word / On) and a "?" from fields.json. The Examples row
// also has the 0–3 slider. Rows are rebuilt only when the set of rows changes, so focus is kept.

import { isFieldShown, mode, placementOf, withPlacement } from '../state.js';
import { h } from './dom.js';
import { count } from './format.js';
import { help } from './popover.js';

/** @typedef {import('../state.js').Placement} Placement */
/** @typedef {import('../state.js').FieldDef} FieldDef */

/** @type {Record<Placement, string>} */
const PLACEMENT_LABEL = { off: 'Off', front: 'Front', back: 'Back', on: 'On', word: 'With the word' };

/** Wording for the two fixed rows. @type {Record<string, string>} */
const FIXED = { front: 'Always on the front', back: 'Always on the back' };

/**
 * @param {HTMLElement} root
 * @param {import('./app.js').App} app
 */
export function mountFields(root, app) {
  const { meta } = app;
  let shape = '';
  /** @type {{ def: FieldDef, radios: HTMLInputElement[] }[]} */
  let rows = [];
  /** @type {{ range: HTMLInputElement, out: HTMLOutputElement } | null} */
  let slider = null;

  /** @param {FieldDef} def @param {import('../state.js').Config} config */
  function row(def, config) {
    const labelId = `field-${def.id}`;
    const label = mode(config) === 'same' && def.labelSame ? def.labelSame : def.label;
    const name = h('div', { class: 'f-name' }, h('span', { id: labelId }, label), help(label, def.help));
    if (def.fixed) return { el: h('div', { class: 'f-row' }, name, h('div', { class: 'f-fixed' }, FIXED[def.default] ?? def.default)), radios: [] };
    const radios = def.placements.map((p) => {
      const input = h('input', { type: 'radio', name: labelId, value: p });
      input.addEventListener('change', () => app.update((c) => withPlacement(c, meta, def.id, p)));
      return input;
    });
    const seg = h(
      'div',
      { class: 'seg', role: 'radiogroup', 'aria-labelledby': labelId },
      ...radios.map((input, i) => h('label', null, input, h('span', null, PLACEMENT_LABEL[def.placements[i]]))),
    );
    const el = h('div', { class: 'f-row' }, name, seg);
    if (def.count) {
      const range = h('input', { type: 'range', min: def.count.min, max: def.count.max, step: 1, 'aria-label': 'Number of examples' });
      const out = h('output', { class: 'f-count' });
      range.addEventListener('input', () => app.update(() => ({ examples: Number(range.value) })));
      el.append(h('div', { class: 'f-slider' }, range, out));
      slider = { range, out };
    }
    return { el, radios };
  }

  /** @param {import('../state.js').Config} config */
  function build(config) {
    slider = null;
    const defs = /** @type {FieldDef[]} */ (meta.fields.fields).filter((def) => isFieldShown(def, config));
    const built = defs.map((def) => ({ def, ...row(def, config) }));
    rows = built.map(({ def, radios }) => ({ def, radios }));
    root.replaceChildren(...built.map((r) => r.el));
  }

  return {
    /** @param {import('./app.js').View} view */
    update({ config }) {
      const next = `${config.learn}|${mode(config)}`;
      if (next !== shape) {
        shape = next;
        build(config);
      }
      const examplesOn = placementOf(meta, config, 'examples') !== 'off';
      for (const { def, radios } of rows) {
        const current = placementOf(meta, config, def.id);
        for (const input of radios) input.checked = input.value === current;
        // Example translations only matter while there are examples.
        if (def.id === 'exampleTranslations') for (const input of radios) input.disabled = !examplesOn || config.examples === 0;
      }
      if (slider) {
        slider.range.value = String(config.examples);
        slider.range.disabled = !examplesOn;
        slider.range.setAttribute('aria-valuetext', count(config.examples, 'example'));
        slider.out.textContent = count(config.examples, 'example');
      }
    },
  };
}
