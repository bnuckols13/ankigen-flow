// @ts-check
// Step 4: the card field table (SPEC §3). Only rows that apply to the chosen languages are shown, each with
// its placements (Off / Front / Back, or With the word / On) and a "?" from fields.json. The Examples row
// also has the 0–3 slider. The rows marked "more" in fields.json are under "More…", closed until the user opens
// it (or one of them is on); closed, its summary names the rows that are on. Rows are rebuilt only when the set
// of rows (or the interface language) changes, so focus is kept.

import { isFieldShown, mode, placementOf, withPlacement } from '../state.js';
import { h } from './dom.js';
import { fieldText, languageEpoch, plural, t } from './i18n.js';
import { help } from './popover.js';

/** @typedef {import('../state.js').Placement} Placement */
/** @typedef {import('../state.js').FieldDef} FieldDef */

/** Wording for the two fixed rows. @type {Record<string, string>} */
const FIXED = { front: 'fields.alwaysFront', back: 'fields.alwaysBack' };

/**
 * @param {HTMLElement} root
 * @param {import('./app.js').App} app
 */
export function mountFields(root, app) {
  const { meta } = app;
  let shape = '';
  /** @type {{ def: FieldDef, label: string, radios: HTMLInputElement[] }[]} */
  let rows = [];
  /** @type {{ range: HTMLInputElement, out: HTMLOutputElement } | null} */
  let slider = null;
  /** The "More…" rows that are on, in its summary. @type {HTMLElement | null} */
  let moreOn = null;
  /** Whether "More…" is open; decided at the first build, then the user's. @type {boolean | null} */
  let moreOpen = null;

  /** @param {FieldDef} def @param {import('../state.js').Config} config */
  function row(def, config) {
    const labelId = `field-${def.id}`;
    const { label, help: about } = fieldText(def, mode(config) === 'same');
    const name = h('div', { class: 'f-name' }, h('span', { id: labelId }, label), help(label, about));
    if (def.fixed) return { el: h('div', { class: 'f-row' }, name, h('div', { class: 'f-fixed' }, t(FIXED[def.default] ?? def.default))), label, radios: [] };
    const radios = def.placements.map((p) => {
      const input = h('input', { type: 'radio', name: labelId, value: p });
      input.addEventListener('change', () => app.update((c) => withPlacement(c, meta, def.id, p)));
      return input;
    });
    const seg = h(
      'div',
      { class: 'seg', role: 'radiogroup', 'aria-labelledby': labelId },
      ...radios.map((input, i) => h('label', null, input, h('span', null, t(`placement.${def.placements[i]}`)))),
    );
    const el = h('div', { class: 'f-row' }, name, seg);
    if (def.count) {
      const range = h('input', { type: 'range', min: def.count.min, max: def.count.max, step: 1, 'aria-label': t('fields.examples') });
      const out = h('output', { class: 'f-count' });
      range.addEventListener('input', () => app.update(() => ({ examples: Number(range.value) })));
      el.append(h('div', { class: 'f-slider' }, range, out));
      slider = { range, out };
    }
    return { el, label, radios };
  }

  /** @param {import('../state.js').Config} config */
  function build(config) {
    slider = null;
    const defs = /** @type {FieldDef[]} */ (meta.fields.fields).filter((def) => isFieldShown(def, config));
    const built = defs.map((def) => ({ def, ...row(def, config) }));
    rows = built.map(({ def, label, radios }) => ({ def, label, radios }));
    const more = built.filter((r) => r.def.more);
    moreOn = null;
    if (!more.length) {
      root.replaceChildren(...built.map((r) => r.el));
      return;
    }
    moreOpen ??= more.some((r) => placementOf(meta, config, r.def.id) !== 'off');
    moreOn = h('span', { class: 'f-more-on' });
    const details = h('details', { class: 'f-more', open: moreOpen }, h('summary', null, h('span', null, t('fields.more')), ' ', moreOn), ...more.map((r) => r.el));
    details.addEventListener('toggle', () => (moreOpen = details.open));
    root.replaceChildren(...built.filter((r) => !r.def.more).map((r) => r.el), details);
  }

  return {
    /** @param {import('./app.js').View} view */
    update({ config }) {
      const next = `${config.learn}|${mode(config)}|${languageEpoch()}`;
      if (next !== shape) {
        shape = next;
        build(config);
      }
      const examplesOn = placementOf(meta, config, 'examples') !== 'off';
      /** @type {string[]} */
      const on = [];
      for (const { def, label, radios } of rows) {
        const current = placementOf(meta, config, def.id);
        for (const input of radios) input.checked = input.value === current;
        // Example translations only matter while there are examples.
        if (def.id === 'exampleTranslations') for (const input of radios) input.disabled = !examplesOn || config.examples === 0;
        if (def.more && current !== 'off') on.push(label);
      }
      if (moreOn) moreOn.textContent = on.join(' · ');
      if (slider) {
        const examples = plural('example', config.examples);
        slider.range.value = String(config.examples);
        slider.range.disabled = !examplesOn;
        slider.range.setAttribute('aria-valuetext', examples);
        slider.out.textContent = examples;
      }
    },
  };
}
