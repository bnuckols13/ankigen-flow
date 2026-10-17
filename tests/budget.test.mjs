// ARCHITECTURE §1: the page's initial JS stays within 60 KB gzipped. sql.js, fflate and the packager are
// loaded only on download, so they must not be reachable through static imports from src/main.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const BUDGET = 60 * 1024;
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+'([^']+)'|^\s*import\s+'([^']+)'/gm;

/** Every module reachable from `entry` through static imports. @param {URL} entry */
function staticGraph(entry) {
  const seen = new Map();
  const visit = (/** @type {URL} */ url) => {
    if (seen.has(url.href)) return;
    const source = fs.readFileSync(url, 'utf8');
    seen.set(url.href, source);
    for (const m of source.matchAll(STATIC_IMPORT)) visit(new URL(m[1] ?? m[2], url));
  };
  visit(entry);
  return seen;
}

test('initial JS: within 60 KB gzipped, without the download-only modules', () => {
  const graph = staticGraph(new URL('../src/main.js', import.meta.url));
  const files = [...graph.keys()].map((href) => href.replace(/^.*\/ankigen\//, ''));
  for (const lazy of ['src/deck/apkg.js', 'vendor/fflate.js', 'vendor/sql-wasm.js']) assert.ok(!files.includes(lazy), `${lazy} is loaded up front`);
  const gzipped = [...graph.values()].reduce((sum, source) => sum + zlib.gzipSync(source).length, 0);
  assert.ok(gzipped <= BUDGET, `initial JS is ${(gzipped / 1024).toFixed(1)} KB gzipped (budget 60 KB)`);
});
