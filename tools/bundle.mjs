#!/usr/bin/env node
// Build the site for GitHub Pages (ARCHITECTURE §3, §12): the page, its code and styles, data/meta, the SEO
// files, and the data bundles under bundles/<data version>/:
//   meta.json      languages, modules, fields, labels and version, as src/data/loader.js reads them
//   concepts.json  { module: { id: concept } } in module tree order, without the authors' notes
//   <code>.json    one per language with data: all its layers, { lang, ex, ipa, etym }, keyed by concept ID
//
//   node tools/bundle.mjs [--site _site] [--data data] [--meta <data>/meta]
//
// --site  output directory (default _site/, which git ignores). It is replaced as a whole, so the tool
//         refuses a directory it did not build.
// --data  read concepts and layers from another directory (e.g. tests/fixtures/data); --meta defaults to data/meta
// Same data, same bytes. Preview the result with: python3 -m http.server -d _site 8000
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** What the site is made of, relative to the repository root. Everything else (docs, tools, tests, .env) stays out. */
export const SITE_FILES = ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'og-image.png', 'favicon.svg', 'apple-touch-icon.png', 'css', 'src', 'vendor'];
const LAYERS = ['lang', 'ex', 'ipa', 'etym'];
/** Written into every site this tool builds; a directory without it is never replaced. */
const MARKER = '.ankigen-site';

/** @param {string} file */
function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * The bundles of a data directory: their data version and { file name: JSON text }.
 * @param {string} dataDir @param {string} metaDir
 */
export function makeBundles(dataDir, metaDir) {
  /** @type {Record<string, any>} */
  const meta = {};
  for (const name of ['languages', 'modules', 'fields', 'labels', 'version']) {
    meta[name] = readJson(path.join(metaDir, `${name}.json`));
    if (!meta[name]) throw new Error(`missing ${path.join(metaDir, `${name}.json`)}`);
  }
  if (!meta.version.data) throw new Error('version.json has no data version');
  const modules = meta.modules.categories.flatMap((/** @type {any} */ cat) => cat.modules.map((/** @type {any} */ m) => m.id));

  /** @type {Record<string, Record<string, any>>} */
  const concepts = {};
  for (const module of modules) {
    const file = readJson(path.join(dataDir, 'concepts', `${module}.json`));
    if (file) concepts[module] = Object.fromEntries(Object.entries(file).map(([id, { note, ...concept }]) => [id, concept]));
  }

  /** @type {Record<string, unknown>} */
  const files = { 'meta.json': meta, 'concepts.json': concepts };
  for (const code of Object.keys(meta.languages.languages)) {
    /** @type {Record<string, Record<string, unknown>>} */
    const bundle = {};
    for (const layer of LAYERS) {
      bundle[layer] = {};
      for (const module of modules) Object.assign(bundle[layer], readJson(path.join(dataDir, layer, code, `${module}.json`)));
    }
    if (LAYERS.some((layer) => Object.keys(bundle[layer]).length)) files[`${code}.json`] = bundle;
  }
  return {
    version: /** @type {string} */ (meta.version.data),
    files: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, JSON.stringify(value)])),
  };
}

/** @param {string} siteDir */
function checkReplaceable(siteDir) {
  const root = path.relative(siteDir, ROOT);
  if (!root.startsWith('..') && !path.isAbsolute(root)) throw new Error(`refusing to replace ${siteDir}: it contains the repository`);
  if (fs.existsSync(siteDir) && fs.readdirSync(siteDir).length && !fs.existsSync(path.join(siteDir, MARKER))) {
    throw new Error(`refusing to replace ${siteDir}: it is not empty and was not built by tools/bundle.mjs`);
  }
}

/**
 * @param {{ siteDir: string, dataDir: string, metaDir: string }} dirs absolute paths
 */
export function buildSite({ siteDir, dataDir, metaDir }) {
  checkReplaceable(siteDir);
  const { version, files } = makeBundles(dataDir, metaDir);
  fs.rmSync(siteDir, { recursive: true, force: true });
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, MARKER), 'Built by tools/bundle.mjs; the next build replaces this whole directory.\n');
  for (const entry of SITE_FILES) {
    const from = path.join(ROOT, entry);
    if (!fs.existsSync(from)) throw new Error(`missing ${entry}`);
    fs.cpSync(from, path.join(siteDir, entry), { recursive: true });
  }
  fs.cpSync(metaDir, path.join(siteDir, 'data', 'meta'), { recursive: true });
  const bundleDir = path.join(siteDir, 'bundles', version);
  fs.mkdirSync(bundleDir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(bundleDir, name), text);
  return { version, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  /** @param {string} name @param {string} fallback */
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const dataDir = path.resolve(opt('--data', 'data'));
  const dirs = { siteDir: path.resolve(opt('--site', '_site')), dataDir, metaDir: path.resolve(opt('--meta', path.join(ROOT, 'data', 'meta'))) };
  try {
    const { version, files } = buildSite(dirs);
    const kb = (/** @type {number} */ n) => `${Math.round(n / 1024).toLocaleString('en-US')} KB`;
    const sizes = Object.entries(files).map(([name, text]) => `${name} ${kb(Buffer.byteLength(text))} (${kb(zlib.gzipSync(text).length)} gzipped)`);
    console.log(`${path.relative(process.cwd(), dirs.siteDir) || '.'}: data ${version}, from ${path.relative(process.cwd(), dataDir) || '.'}\n  ${sizes.join('\n  ')}`);
  } catch (error) {
    console.error(`tools/bundle.mjs: ${/** @type {Error} */ (error).message}`);
    process.exit(1);
  }
}
