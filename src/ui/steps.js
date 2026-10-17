// @ts-check
// Progressive steps (SPEC §4): each step appears once the previous one has a choice, and stays editable.

import { prefersReducedMotion } from './dom.js';

/** @typedef {'learn' | 'know' | 'modules' | 'fields' | 'options' | 'download'} Step */

/** Which steps are shown for a config. Pure. @param {import('../state.js').Config} config @returns {Record<Step, boolean>} */
export function shownSteps(config) {
  const know = Boolean(config.learn);
  const modules = know && Boolean(config.know);
  const rest = modules && config.modules.length > 0;
  return { learn: true, know, modules, fields: rest, options: rest, download: rest };
}

/** Steps worth scrolling to when they appear: the next choice after a language. */
const SCROLL_TO = new Set(['know', 'modules']);
/** Only the one-column layout scrolls: on wide screens the next step's heading is already in sight. */
const narrow = () => window.matchMedia('(max-width: 59.99rem)').matches;

/**
 * @param {Record<Step, HTMLElement>} sections
 */
export function mountSteps(sections) {
  let first = true;
  return {
    /** @param {import('./app.js').View} view */
    update({ config }) {
      const shown = shownSteps(config);
      for (const [step, el] of /** @type {[Step, HTMLElement][]} */ (Object.entries(sections))) {
        const appearing = el.hidden && shown[step];
        el.hidden = !shown[step];
        // On phones a step revealed by the user's own choice starts low on the screen: bring it into view.
        if (appearing && !first && SCROLL_TO.has(step) && narrow() && el.getBoundingClientRect().top > window.innerHeight * 0.6) {
          el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
        }
      }
      first = false;
    },
  };
}
