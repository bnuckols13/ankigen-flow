// @ts-check
// Step 6: the summary and the Download button. sql.js and the packager (deck/apkg.js with fflate) load on
// first use, and are prefetched while the browser is idle once this step appears.

import { buildDeck } from '../deck/deck.js';
import { apkgFileName, deckName } from '../deck/names.js';
import { UPDATE_HELP, downloadedText } from './copy.js';
import { h, whenIdle } from './dom.js';
import { deckSize } from './format.js';
import { help } from './popover.js';

/** @type {Promise<any> | null} */
let sql = null;

/** The initialized sql.js module: vendor/sql-wasm.js is a classic script that defines initSqlJs. */
function loadSql() {
  sql ??= new Promise((resolve, reject) => {
    const script = h('script', { src: 'vendor/sql-wasm.js' });
    script.addEventListener('load', () => resolve(/** @type {any} */ (window).initSqlJs({ locateFile: (/** @type {string} */ f) => `vendor/${f}` })));
    script.addEventListener('error', () => reject(new Error('could not load vendor/sql-wasm.js')));
    document.head.append(script);
  });
  sql.catch(() => (sql = null)); // a later click retries
  return sql;
}

const loadPackager = () => import('../deck/apkg.js');

/** Hand the bytes to the browser as a file download. @param {Uint8Array} bytes @param {string} name */
function save(bytes, name) {
  const url = URL.createObjectURL(new Blob([/** @type {BlobPart} */ (bytes)], { type: 'application/octet-stream' }));
  const link = h('a', { href: url, download: name, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @param {HTMLElement} root
 * @param {import('./app.js').App} app
 */
export function mountDownload(root, app) {
  const deck = h('dd');
  const size = h('dd');
  const file = h('dd', { class: 'dl-file' });
  const button = h('button', { type: 'button', class: 'button primary' }, 'Download deck');
  const status = h('p', { class: 'dl-status', role: 'status' });
  const updateHelp = h(
    'div',
    null,
    h('p', null, h('strong', null, UPDATE_HELP.title)),
    h('p', null, UPDATE_HELP.intro),
    h('ul', null, ...UPDATE_HELP.points.map((p) => h('li', null, p))),
  );
  root.append(
    h('dl', { class: 'dl-summary' }, h('dt', null, 'Deck'), deck, h('dt', null, 'Size'), size, h('dt', null, 'File'), file),
    h('div', { class: 'dl-actions' }, button, h('span', { class: 'dl-help' }, 'Updating a deck later', help('updating a deck', updateHelp))),
    status,
  );

  let busy = false;
  let prefetched = false;

  button.addEventListener('click', async () => {
    const input = app.deckInput();
    if (!input || busy) return;
    if (!globalThis.crypto?.subtle) {
      // Note IDs are SHA-256 hashes, and browsers offer crypto.subtle only on HTTPS and localhost.
      status.textContent = 'Downloading needs a secure connection: open the page over https:// (or localhost).';
      return;
    }
    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.textContent = 'Building your deck…';
    try {
      const [SQL, { buildApkg }] = await Promise.all([loadSql(), loadPackager()]);
      const bytes = await buildApkg({ SQL, config: input.config, meta: input.meta, deck: buildDeck(input) });
      const name = apkgFileName(input.config, input.meta);
      save(bytes, name);
      status.textContent = downloadedText(name);
    } catch (error) {
      status.textContent = `Could not build the deck (${error instanceof Error ? error.message : error}). Please try again.`;
    } finally {
      busy = false;
      button.removeAttribute('aria-busy');
      button.disabled = !app.view().notes.length;
    }
  });

  return {
    /** @param {import('./app.js').View} view */
    update(view) {
      const { config, ready, notes, cards } = view;
      if (!config.learn || !config.know) return;
      deck.textContent = deckName(config, app.meta);
      size.textContent = ready ? deckSize(notes.length, cards) : 'Loading…';
      file.textContent = apkgFileName(config, app.meta);
      if (!busy) button.disabled = !ready || !notes.length;
      if (!prefetched && config.modules.length) {
        prefetched = true;
        whenIdle(() => {
          loadSql().catch(() => {});
          loadPackager().catch(() => {});
        });
      }
    },
  };
}
