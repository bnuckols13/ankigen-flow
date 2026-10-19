// @ts-check
// Bootstrap: pick the interface language and load it with the meta files, mount the steps, the preview, the
// word list and the feedback dialog, keep the config in the URL hash (and the interface language in ?lang=)
// and in localStorage, and re-render on every change. ?data=<dir> reads the vocabulary from another directory
// (tests/fixtures/data while developing; meta always comes from data/meta).

import { createLoader, safeDataDir } from './data/loader.js';
import { langTag } from './deck/fields.js';
import { decodeHash, encodeHash, loadConfig, saveConfig } from './state.js';
import { createApp } from './ui/app.js';
import { deckSize } from './ui/copy.js';
import { bind, debounce, fillNodes, h, icon, msg, relabel } from './ui/dom.js';
import { mountDownload } from './ui/download.js';
import { mountFeedback } from './ui/feedback.js';
import { mountFields } from './ui/fields.js';
import { LANGUAGE_KEY, UI_LANGUAGES, languageTag, pickLanguage, plural, t, useLanguage } from './ui/i18n.js';
import { mountLanguages } from './ui/languages.js';
import { mountModules } from './ui/modules.js';
import { mountOptions } from './ui/options.js';
import { help } from './ui/popover.js';
import { mountPreview } from './ui/preview.js';
import { mountSteps, shownSteps } from './ui/steps.js';

/** @typedef {import('./ui/app.js').App} App */
/** @typedef {import('./ui/app.js').View} View */
/** @typedef {import('./ui/i18n.js').Translation} Translation */
/** @typedef {ReturnType<typeof import('./ui/sidebar.js').mountCardList>} ListPart */

/** @param {string} id */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @param {Element} root @param {string} selector */
const inside = (root, selector) => /** @type {HTMLElement} */ (root.querySelector(selector));

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null; // storage disabled: the URL hash still holds the config
  }
}

/** @param {Storage | null} storage @param {string} key */
function stored(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Switch the page's texts to a language: the strings, the lang attribute, the title and description.
 * @param {any} meta @param {string} code @param {Translation | null} translation
 */
function useTexts(meta, code, translation) {
  const reg = meta.languages.languages[code];
  useLanguage(code, { tag: code === 'en' ? 'en' : langTag(reg, code, 'cyrl'), locale: reg?.locale ?? code }, translation);
  const languages = meta.languages.active.length;
  document.documentElement.lang = languageTag();
  document.title = plural('title', languages);
  document.querySelector('meta[name="description"]')?.setAttribute('content', plural('description', languages));
}

/**
 * The texts of index.html follow the language: data-t="key" names a text of ui/strings.js (its {placeholders}
 * are the elements marked data-part), data-plural="key" one counted by the number of languages.
 * @param {any} meta
 */
function bindPage(meta) {
  for (const el of document.querySelectorAll('[data-t]')) {
    const key = /** @type {string} */ (/** @type {HTMLElement} */ (el).dataset.t);
    const parts = Object.fromEntries([...el.querySelectorAll('[data-part]')].map((p) => [/** @type {HTMLElement} */ (p).dataset.part, p]));
    if (Object.keys(parts).length) bind(el, (node) => node.replaceChildren(...fillNodes(t(key), parts)));
    else bind(el, (node) => (node.textContent = t(key)));
  }
  for (const el of document.querySelectorAll('[data-plural]')) {
    const key = /** @type {string} */ (/** @type {HTMLElement} */ (el).dataset.plural);
    bind(el, (node) => (node.textContent = plural(key, meta.languages.active.length)));
  }
}

/**
 * The config lives in the URL hash and the interface language in ?lang= (replaceState, so neither fills the
 * history), and the config in localStorage too. Editing the hash by hand, or going back to a shared link,
 * loads that config. The address is written once there is a config or the language was chosen.
 * @param {App} app @param {any} meta @param {Storage | null} storage
 */
function syncUrl(app, meta, storage) {
  let named = new URLSearchParams(location.search).has('lang');
  const write = () => {
    const config = app.store.get();
    if (!config.learn && !named) return;
    const address = app.address(location.href);
    if (address !== location.href) history.replaceState(null, '', address);
    if (config.learn) saveConfig(storage, config, meta);
  };
  app.store.subscribe(debounce(write, 150));
  write();
  window.addEventListener('hashchange', () => {
    const config = decodeHash(location.hash, meta);
    if (config && encodeHash(config, meta) !== encodeHash(app.store.get(), meta)) app.store.set(config);
  });
  return {
    /** The user chose a language: the address names it from now on. */
    named() {
      named = true;
      write();
    },
  };
}

async function main() {
  const params = new URLSearchParams(location.search);
  const dataDir = safeDataDir(params.get('data'));
  const loader = createLoader({ dataDir });
  const storage = localStore();
  const wanted = pickLanguage({ param: params.get('lang'), saved: stored(storage, LANGUAGE_KEY), browser: navigator.languages ?? [navigator.language] });
  const [meta, loaded] = await Promise.all([loader.getMeta(), wanted === 'en' ? null : loader.getUiTexts(wanted)]);
  // A translation that could not load leaves the page in English.
  const translation = loaded?.ui ? loaded : null;
  useTexts(meta, translation ? wanted : 'en', translation);
  bindPage(meta);
  const app = createApp({ loader, meta, initial: loadConfig({ hash: location.hash, storage }, meta) });

  if (dataDir) document.body.prepend(h('p', { class: 'dev-banner' }, `Test data from ${dataDir}`));
  byId('draft-help').replaceWith(help(msg('head.draftTopic'), [msg('head.draftHelp1'), msg('head.draftHelp2')]));
  // After the first download the support links stay in sight (ui/support.js loads then).
  /** @type {Promise<{ stick: () => void }> | null} */
  let support = null;
  const stickSupport = () => {
    support ??= import('./ui/support.js').then((m) => m.mountSupport(byId('head-support')));
    support.then((s) => s.stick(), () => (support = null));
  };

  const steps = mountSteps({
    learn: byId('step-learn'),
    know: byId('step-know'),
    modules: byId('step-modules'),
    fields: byId('step-fields'),
    options: byId('step-options'),
    download: byId('step-download'),
    share: byId('step-share'),
  });
  const languages = mountLanguages(
    { learn: byId('learn-chips'), know: byId('know-chips'), learnStatus: byId('learn-status'), knowStatus: byId('know-status') },
    app,
  );
  const modules = mountModules(byId('modules'), byId('modules-summary'), app);
  const fields = mountFields(byId('fields'), app);
  const options = mountOptions(byId('options'), app);
  const download = mountDownload(byId('download'), app, { onSaved: stickSupport });
  const feedback = mountFeedback({ app, storage });

  // The Share block loads when it first appears.
  /** @type {{ update: () => void } | null} */
  let share = null;
  let shareLoading = false;
  const shareBlock = {
    /** @param {View} view */
    update({ config }) {
      if (share) share.update();
      else if (!shareLoading && shownSteps(config).share) {
        shareLoading = true;
        import('./ui/share.js').then(
          (m) => {
            share = m.mountShare(byId('share'), app);
            share.update();
          },
          () => (shareLoading = false), // offline: the next render tries again
        );
      }
    },
  };

  // The preview and the word list: a sticky column beside the steps on wide screens; on phones each opens
  // as a sheet from the bar at the bottom, and a word picked in the list opens the preview over it.
  const wide = window.matchMedia('(min-width: 60rem)');
  const previewSheet = /** @type {HTMLDialogElement} */ (byId('preview-dialog'));
  const cardsSheet = /** @type {HTMLDialogElement} */ (byId('cards-dialog'));
  const cardsPanel = byId('cards-panel');
  const reports = { report: feedback.open, frames: feedback.frames };
  const panel = mountPreview(inside(byId('preview-panel'), '.pv'), app, { id: 'panel', isActive: () => wide.matches, ...reports });
  const sheet = mountPreview(inside(previewSheet, '.pv'), app, { id: 'sheet', isActive: () => previewSheet.open, ...reports });
  const openPreview = () => {
    previewSheet.showModal();
    sheet.show();
  };
  // The word lists (ui/sidebar.js with its search) load once the deck has modules: until its words arrive
  // there is nothing to list.
  /** @type {Promise<{ side: ListPart, sheet: ListPart }> | null} */
  let lists = null;
  const loadLists = () => {
    lists ??= import('./ui/sidebar.js').then(({ mountCardList }) => ({
      side: mountCardList(inside(cardsPanel, '.cl'), app, { isActive: () => wide.matches && !cardsPanel.hidden, report: feedback.open }),
      sheet: mountCardList(inside(cardsSheet, '.cl'), app, { isActive: () => cardsSheet.open, report: feedback.open, onPick: openPreview }),
    }));
    lists.catch(() => (lists = null)); // offline: the next render tries again
    return lists;
  };
  const side = {
    /** @param {View} view */
    update({ config }) {
      cardsPanel.hidden = !config.learn || !config.know || !config.modules.length;
      if (!config.modules.length && !lists) return;
      loadLists().then((list) => {
        list.side.update(app.view());
        list.sheet.update(app.view());
      }, () => {});
    },
  };

  const bar = byId('mobile-bar');
  const openCards = byId('open-cards');
  const barCount = byId('mobile-count');
  openCards.prepend(icon('list'));
  const mobileBar = {
    /** @param {View} view */
    update({ config, ready, notes, cards }) {
      bar.hidden = !config.learn || !config.know;
      const size = ready && config.modules.length && notes.length ? deckSize(notes.length, cards) : '';
      openCards.hidden = !size;
      barCount.textContent = size;
      openCards.setAttribute('aria-label', t('list.open', { size }));
    },
  };
  byId('open-preview').addEventListener('click', openPreview);
  byId('close-preview').addEventListener('click', () => previewSheet.close());
  openCards.addEventListener('click', () => {
    cardsSheet.showModal();
    loadLists().then(({ sheet }) => sheet.show(), () => {});
  });
  byId('close-cards').addEventListener('click', () => cardsSheet.close());
  wide.addEventListener('change', () => {
    if (wide.matches) {
      previewSheet.close();
      cardsSheet.close();
    }
    panel.show();
    lists?.then(({ side }) => side.show(), () => {});
  });

  const parts = [steps, languages, modules, fields, options, download, shareBlock, side, panel, sheet, mobileBar];
  const render = (/** @type {View} */ view) => {
    for (const part of parts) part.update(view);
  };
  app.subscribe(render);
  render(app.view());
  const url = syncUrl(app, meta, storage);

  /** Switch the page to another interface language, and remember it. @param {string} code */
  async function choose(code) {
    const next = code === 'en' ? null : await loader.getUiTexts(code);
    if (next && !next.ui) throw new Error(`could not load the ${code} texts`); // the page stays as it is
    useTexts(meta, code, next);
    relabel();
    render(app.view());
    try {
      storage?.setItem(LANGUAGE_KEY, code);
    } catch {
      // storage disabled: the address still names the language
    }
    url.named();
  }
  // The language menu comes right after the first render; its place in the header is kept for it.
  const registry = meta.languages.languages;
  const choices = UI_LANGUAGES.filter((code) => registry[code]).map((code) => ({
    code,
    native: registry[code].native,
    name: registry[code].name,
    country: registry[code].country,
    tag: langTag(registry[code], code, 'cyrl'),
  }));
  import('./ui/locale.js').then(({ mountLocale }) => mountLocale(byId('locale'), { choices, choose }), () => {});
}

main()
  .catch((error) => {
    console.error(error);
    byId('steps').prepend(h('p', { class: 'fatal', role: 'alert' }, t('fatal')));
  })
  .finally(() => document.documentElement.classList.add('ready')); // shows the texts and the footer (see index.html)
