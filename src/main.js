// @ts-check
// Bootstrap: load the meta files, mount the steps and the preview, keep the config in the URL hash and in
// localStorage, and re-render on every change. ?data=<dir> reads the vocabulary from another directory
// (tests/fixtures/data while developing; meta always comes from data/meta).

import { createLoader, safeDataDir } from './data/loader.js';
import { decodeHash, encodeHash, loadConfig, saveConfig } from './state.js';
import { createApp } from './ui/app.js';
import { DRAFT_HELP } from './ui/copy.js';
import { debounce, h } from './ui/dom.js';
import { mountDownload } from './ui/download.js';
import { mountFields } from './ui/fields.js';
import { deckSize } from './ui/format.js';
import { mountLanguages } from './ui/languages.js';
import { mountModules } from './ui/modules.js';
import { mountOptions } from './ui/options.js';
import { help } from './ui/popover.js';
import { mountPreview } from './ui/preview.js';
import { mountSteps } from './ui/steps.js';

/** @typedef {import('./ui/app.js').App} App */
/** @typedef {import('./ui/app.js').View} View */

/** @param {string} id */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

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
  byId('draft').append(help('the draft vocabulary', DRAFT_HELP));

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

  // The preview: a sticky panel on wide screens; on phones a sheet opened from the bar at the bottom.
  const wide = window.matchMedia('(min-width: 60rem)');
  const dialog = /** @type {HTMLDialogElement} */ (byId('preview-dialog'));
  const panel = mountPreview(/** @type {HTMLElement} */ (byId('preview-panel').querySelector('.pv')), app, { id: 'panel', isActive: () => wide.matches });
  const sheet = mountPreview(/** @type {HTMLElement} */ (dialog.querySelector('.pv')), app, { id: 'sheet', isActive: () => dialog.open });
  const bar = byId('mobile-bar');
  const barCount = byId('mobile-count');
  const mobileBar = {
    /** @param {View} view */
    update({ config, ready, notes, cards }) {
      bar.hidden = !config.learn || !config.know;
      barCount.textContent = ready && config.modules.length ? deckSize(notes.length, cards) : '';
    },
  };
  byId('open-preview').addEventListener('click', () => {
    dialog.showModal();
    sheet.show();
  });
  byId('close-preview').addEventListener('click', () => dialog.close());
  wide.addEventListener('change', () => {
    if (wide.matches && dialog.open) dialog.close();
    panel.show();
  });

  const parts = [steps, languages, modules, fields, options, download, panel, sheet, mobileBar];
  const render = (/** @type {View} */ view) => {
    for (const part of parts) part.update(view);
  };
  app.subscribe(render);
  render(app.view());
  syncUrl(app, meta, storage);
}

main().catch((error) => {
  console.error(error);
  byId('steps').prepend(
    h('p', { class: 'fatal', role: 'alert' }, 'AnkiGen could not load its word lists. Check your connection and reload the page.'),
  );
});
