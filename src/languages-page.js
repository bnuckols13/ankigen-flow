// @ts-check
// The languages page (languages.html, SPEC §4): the languages AnkiGen makes decks in, each named in the
// interface language, with the card rows only some languages have and a link that starts a deck in it; and
// "Request a language", which opens the feedback dialog with the New language category chosen. The list is in
// the page's HTML, in English (for crawlers, and without scripts); this module translates it.

import { createLoader } from './data/loader.js';
import { loadConfig } from './state.js';
import { mountFeedback } from './ui/feedback.js';
import { fieldText, language, languageName, plural, t } from './ui/i18n.js';
import { localStore, startPage } from './ui/page.js';

/** @typedef {import('./state.js').FieldDef} FieldDef */

/** @param {string} id */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {any} meta */
const head = (meta) => ({ title: t('langs.title'), description: plural('langsDescription', meta.languages.active.length) });

/** The rows of the field table that only some languages have, among them this one. @param {FieldDef[]} defs @param {string} code */
const extrasOf = (defs, code) => defs.filter((def) => !def.fixed && Array.isArray(def.langs) && def.langs.includes(code));

async function main() {
  const loader = createLoader();
  const storage = localStore();
  const page = await startPage({ loader, storage, head });
  const { meta } = page;
  const registry = meta.languages.languages;

  // A request carries the visitor's last deck, if any, as reports from the app do.
  const config = loadConfig({ storage }, meta);
  const feedback = mountFeedback({ app: { meta, view: () => ({ config }) }, storage });
  byId('request-language').addEventListener('click', () => feedback.open(null, { useSelection: false, category: 'new-language' }));

  function render() {
    for (const li of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#language-list [data-code]'))) {
      const code = /** @type {string} */ (li.dataset.code);
      const reg = registry[code];
      const name = /** @type {HTMLElement} */ (li.querySelector('.lang-name'));
      name.textContent = languageName(code, reg.name);
      name.hidden = name.textContent === reg.native;
      const extras = extrasOf(meta.fields.fields, code).map((def) => fieldText(def, false).label);
      /** @type {HTMLElement} */ (li.querySelector('.lang-extras')).textContent = t('langs.extras', { fields: extras.join(' · ') });
    }
  }
  render();

  page.mountMenu(byId('locale'), () => {
    render();
    const url = new URL(location.href);
    url.searchParams.set('lang', language());
    history.replaceState(null, '', url);
  });
}

main()
  .catch((error) => console.error(error)) // the list stays as the HTML has it, in English
  .finally(() => document.documentElement.classList.add('ready')); // shows the texts and the footer (see languages.html)
