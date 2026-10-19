// @ts-check
// Bootstrap: pick the interface language and load it with the meta files, mount the steps, the preview, the
// word list and the feedback dialog, keep the config in the URL hash (and the interface language in ?lang=)
// and in localStorage, and re-render on every change. ?data=<dir> reads the vocabulary from another directory
// (tests/fixtures/data while developing; meta always comes from data/meta).

import { createLoader, safeDataDir } from './data/loader.js';
import { decodeHash, encodeHash, loadConfig, saveConfig } from './state.js';
import { createApp } from './ui/app.js';
import { deckSize } from './ui/copy.js';
import { debounce, h, icon, msg } from './ui/dom.js';
import { mountDownload } from './ui/download.js';
import { mountFeedback } from './ui/feedback.js';
import { mountFields } from './ui/fields.js';
import { plural, t } from './ui/i18n.js';
import { mountLanguages } from './ui/languages.js';
import { mountModules } from './ui/modules.js';
import { mountOptions } from './ui/options.js';
import { localStore, startPage } from './ui/page.js';
import { help } from './ui/popover.js';
import { mountPreview } from './ui/preview.js';
import { mountSteps, shownSteps } from './ui/steps.js';

/** @typedef {import('./ui/app.js').App} App */
/** @typedef {import('./ui/app.js').View} View */
/** @typedef {ReturnType<typeof import('./ui/sidebar.js').mountCardList>} ListPart */

/** @param {string} id */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @param {Element} root @param {string} selector */
const inside = (root, selector) => /** @type {HTMLElement} */ (root.querySelector(selector));

/** @param {any} meta */
const head = (meta) => ({ title: plural('title', meta.languages.active.length), description: plural('description', meta.languages.active.length) });

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
  const page = await startPage({ loader, storage, head });
  const { meta } = page;
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
  // "Reset all" asks first (ui/reset.js, loaded on the first click), then reloads the page with the defaults.
  const onReset = () => void import('./ui/reset.js').then((m) => m.askReset(storage), () => {});
  const shared = { frames: feedback.frames, onReset };
  const panel = mountPreview(inside(byId('preview-panel'), '.pv'), app, { id: 'panel', isActive: () => wide.matches, ...shared });
  const sheet = mountPreview(inside(previewSheet, '.pv'), app, { id: 'sheet', isActive: () => previewSheet.open, ...shared });
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

  // The language menu comes right after the first render; its place in the header is kept for it.
  page.mountMenu(byId('locale'), () => {
    render(app.view());
    url.named();
  });
}

main()
  .catch((error) => {
    console.error(error);
    byId('steps').prepend(h('p', { class: 'fatal', role: 'alert' }, t('fatal')));
  })
  .finally(() => document.documentElement.classList.add('ready')); // shows the texts and the footer (see index.html)
