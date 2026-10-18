// @ts-check
// Bootstrap: load the meta files, mount the steps, the preview, the word list and the feedback dialog, keep
// the config in the URL hash and in localStorage, and re-render on every change. ?data=<dir> reads the
// vocabulary from another directory (tests/fixtures/data while developing; meta always comes from data/meta).

import { APP_VERSION } from './config.js';
import { createLoader, safeDataDir } from './data/loader.js';
import { decodeHash, encodeHash, loadConfig, saveConfig } from './state.js';
import { createApp } from './ui/app.js';
import { DRAFT_HELP } from './ui/copy.js';
import { debounce, h, icon } from './ui/dom.js';
import { mountDownload } from './ui/download.js';
import { mountFeedback } from './ui/feedback.js';
import { mountFields } from './ui/fields.js';
import { deckSize } from './ui/format.js';
import { mountLanguages } from './ui/languages.js';
import { mountModules } from './ui/modules.js';
import { mountOptions } from './ui/options.js';
import { help } from './ui/popover.js';
import { mountPreview } from './ui/preview.js';
import { mountCardList } from './ui/sidebar.js';
import { mountSteps } from './ui/steps.js';

/** @typedef {import('./ui/app.js').App} App */
/** @typedef {import('./ui/app.js').View} View */

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

/**
 * The config lives in the URL hash (replaceState, so it does not fill the history) and in localStorage.
 * Editing the hash by hand, or going back to a shared link, loads that config.
 * @param {App} app @param {any} meta @param {Storage | null} storage
 */
function syncUrl(app, meta, storage) {
  const write = () => {
    const config = app.store.get();
    if (!config.learn) return;
    const hash = encodeHash(config, meta);
    if (hash !== location.hash) history.replaceState(null, '', hash);
    saveConfig(storage, config, meta);
  };
  app.store.subscribe(debounce(write, 150));
  write();
  window.addEventListener('hashchange', () => {
    const config = decodeHash(location.hash, meta);
    if (config && encodeHash(config, meta) !== encodeHash(app.store.get(), meta)) app.store.set(config);
  });
}

async function main() {
  const dataDir = safeDataDir(new URLSearchParams(location.search).get('data'));
  const loader = createLoader({ dataDir });
  const meta = await loader.getMeta();
  const storage = localStore();
  const app = createApp({ loader, meta, initial: loadConfig({ hash: location.hash, storage }, meta) });

  if (dataDir) document.body.prepend(h('p', { class: 'dev-banner' }, `Test data from ${dataDir}`));
  byId('draft-help').replaceWith(help('the draft vocabulary', DRAFT_HELP));

  const steps = mountSteps({
    learn: byId('step-learn'),
    know: byId('step-know'),
    modules: byId('step-modules'),
    fields: byId('step-fields'),
    options: byId('step-options'),
    download: byId('step-download'),
  });
  const languages = mountLanguages(
    { learn: byId('learn-chips'), know: byId('know-chips'), learnStatus: byId('learn-status'), knowStatus: byId('know-status') },
    app,
  );
  const modules = mountModules(byId('modules'), byId('modules-summary'), app);
  const fields = mountFields(byId('fields'), app);
  const options = mountOptions(byId('options'), app);
  const download = mountDownload(byId('download'), app);
  const feedback = mountFeedback({ app, storage });

  // The preview and the word list: a sticky column beside the steps on wide screens; on phones each opens
  // as a sheet from the bar at the bottom, and a word picked in the list opens the preview over it.
  const wide = window.matchMedia('(min-width: 60rem)');
  const previewSheet = /** @type {HTMLDialogElement} */ (byId('preview-dialog'));
  const cardsSheet = /** @type {HTMLDialogElement} */ (byId('cards-dialog'));
  const cardsPanel = byId('cards-panel');
  const reports = { onFrame: feedback.watch, report: feedback.open };
  const panel = mountPreview(inside(byId('preview-panel'), '.pv'), app, { id: 'panel', isActive: () => wide.matches, ...reports });
  const sheet = mountPreview(inside(previewSheet, '.pv'), app, { id: 'sheet', isActive: () => previewSheet.open, ...reports });
  const openPreview = () => {
    previewSheet.showModal();
    sheet.show();
  };
  const sideList = mountCardList(inside(cardsPanel, '.cl'), app, { isActive: () => wide.matches && !cardsPanel.hidden, report: feedback.open });
  const sheetList = mountCardList(inside(cardsSheet, '.cl'), app, { isActive: () => cardsSheet.open, report: feedback.open, onPick: openPreview });
  const side = {
    /** @param {View} view */
    update({ config }) {
      cardsPanel.hidden = !config.learn || !config.know || !config.modules.length;
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
      openCards.setAttribute('aria-label', `Word list: ${size}`);
    },
  };
  byId('open-preview').addEventListener('click', openPreview);
  byId('close-preview').addEventListener('click', () => previewSheet.close());
  openCards.addEventListener('click', () => {
    cardsSheet.showModal();
    sheetList.show();
  });
  byId('close-cards').addEventListener('click', () => cardsSheet.close());
  wide.addEventListener('change', () => {
    if (wide.matches) {
      previewSheet.close();
      cardsSheet.close();
    }
    panel.show();
    sideList.show();
  });

  const parts = [steps, languages, modules, fields, options, download, side, panel, sheet, sideList, sheetList, mobileBar];
  const render = (/** @type {View} */ view) => {
    for (const part of parts) part.update(view);
  };
  app.subscribe(render);
  render(app.view());
  syncUrl(app, meta, storage);
  byId('versions').textContent = `Data ${meta.version.data} · App ${APP_VERSION}`;
}

main()
  .catch((error) => {
    console.error(error);
    byId('steps').prepend(
      h('p', { class: 'fatal', role: 'alert' }, 'AnkiGen could not load its word lists. Check your connection and reload the page.'),
    );
  })
  .finally(() => document.documentElement.classList.add('ready')); // shows the footer (see index.html)
