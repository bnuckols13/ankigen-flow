#!/usr/bin/env node
// Build an .apkg in Node from a configuration hash, the same format as the site's address bar.
// For testing imports in Anki (docs/ANKI_CHECKLIST.md) and for reproducing a user's deck.
//
//   node tools/apkg.mjs '#v1&l=ja&k=ru&m=core-1&r=1' [--data tests/fixtures/data] [--out tmp] [--now <ms>]
//
// --data  read concepts and language files from another directory (meta always comes from data/meta)
// --out   output directory (default tmp/, which git ignores)
// --now   fixed export clock in milliseconds; two runs with the same --now give identical files
import fs from 'node:fs';
import path from 'node:path';
import { createLoader, safeDataDir } from '../src/data/loader.js';
import { decodeHash, SAME } from '../src/state.js';
import { apkgFileName, buildApkg, deckName } from '../src/deck/apkg.js';
import { buildDeck } from '../src/deck/deck.js';
import { cardOrds } from '../src/deck/render.js';
import { loadSqlJs } from './lib/sqljs.mjs';

const ROOT = new URL('../', import.meta.url);

/** @param {string} p */
const read = (p) => {
  try {
    return fs.readFileSync(new URL(p, ROOT), 'utf8');
  } catch {
    return null; // a missing file is "no data", as over HTTP
  }
};

const args = process.argv.slice(2);
/** @param {string} name */
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const hash = args.find((a) => a.startsWith('#') || a.startsWith('v1&'));
const usage = "usage: node tools/apkg.mjs '#v1&l=<learn>&k=<know or =>&m=<modules>[&r=1…]' [--data <dir>] [--out <dir>] [--now <ms>]";

const dataDir = opt('--data') ? safeDataDir(/** @type {string} */ (opt('--data'))) : null;
if (!hash || (opt('--data') && !dataDir)) {
  console.error(usage);
  process.exit(2);
}
const loader = createLoader({
  fetchJson: async (p) => {
    const text = read(p);
    return text === null ? null : JSON.parse(text);
  },
  fetchText: async (p) => read(p),
  dataDir,
});
const meta = await loader.getMeta();
const config = decodeHash(hash, meta);
if (!config?.learn || !config.know || !config.modules.length) {
  console.error(`The hash needs a learning language (l), a known language or "=" (k) and modules (m).\n${usage}`);
  process.exit(2);
}
const concepts = await loader.getConcepts();
const learnData = await loader.getLanguage(config.learn);
const knowData = config.know === SAME ? learnData : await loader.getLanguage(config.know);
const deck = buildDeck({ config, meta, concepts, learnData, knowData, css: (await loader.getCardCss()) ?? '' });

const bytes = await buildApkg({ SQL: await loadSqlJs(), config, meta, deck, now: opt('--now') ? Number(opt('--now')) : Date.now() });
const out = path.join(opt('--out') ?? 'tmp', apkgFileName(config, meta));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, bytes);
const cards = deck.notes.reduce((n, note) => n + cardOrds(deck.noteType, note.fields).length, 0);
console.log(`${out}: ${deckName(config, meta)}, ${deck.notes.length} notes, ${cards} cards, ${(bytes.length / 1024).toFixed(0)} KB`);
