// ARCHITECTURE §1: the page's initial JS stays within 60 KB gzipped. sql.js, fflate and the packager are
// loaded only on download, and the feedback dialog with its client on first use (or when the browser is
// idle), so they must not be reachable through static imports from src/main.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { staticGraph } from './helpers/modules.mjs';

const BUDGET = 60 * 1024;

test('initial JS: within 60 KB gzipped, without the download-only modules', () => {
  const graph = staticGraph();
  const files = [...graph.keys()];
  const lazy = ['src/deck/apkg.js', 'vendor/fflate.js', 'vendor/sql-wasm.js', 'src/ui/feedback-dialog.js', 'src/feedback/client.js'];
  for (const file of lazy) assert.ok(!files.includes(file), `${file} is loaded up front`);
  const gzipped = [...graph.values()].reduce((sum, source) => sum + zlib.gzipSync(source).length, 0);
  assert.ok(gzipped <= BUDGET, `initial JS is ${(gzipped / 1024).toFixed(1)} KB gzipped (budget 60 KB)`);
});
