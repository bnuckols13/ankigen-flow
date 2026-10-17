// sql.js for Node, from the same vendored files the page uses. vendor/sql-wasm.js is a classic script that
// exports itself through CommonJS when `module` exists; package.json "type": "module" would make Node load
// it as an ES module (without that export), so it is evaluated in a CommonJS wrapper here.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const VENDOR = new URL('../../vendor/', import.meta.url);

/** @type {Promise<any> | null} */
let sql = null;

/** The initialized sql.js module (cached). */
export function loadSqlJs() {
  sql ??= (() => {
    const file = fileURLToPath(new URL('sql-wasm.js', VENDOR));
    const module = { exports: /** @type {any} */ ({}) };
    const wrapper = vm.runInThisContext(`(function (module, exports, require, __filename, __dirname) {${fs.readFileSync(file, 'utf8')}\n})`, { filename: file });
    wrapper(module, module.exports, createRequire(file), file, path.dirname(file));
    return module.exports({ wasmBinary: fs.readFileSync(new URL('sql-wasm.wasm', VENDOR)) });
  })();
  return sql;
}
