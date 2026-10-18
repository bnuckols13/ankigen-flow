// The page's static module graph: every module reachable from src/main.js through static imports (the first
// load; dynamic import() calls are not followed).
import fs from 'node:fs';

const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+'([^']+)'|^\s*import\s+'([^']+)'/gm;
const ROOT = new URL('../../', import.meta.url);

/** Repo-relative path → source, for every module the entry statically imports, the entry included. @param {string} [entry] */
export function staticGraph(entry = 'src/main.js') {
  /** @type {Map<string, string>} */
  const seen = new Map();
  const visit = (/** @type {URL} */ url) => {
    const file = url.href.slice(ROOT.href.length);
    if (seen.has(file)) return;
    const source = fs.readFileSync(url, 'utf8');
    seen.set(file, source);
    for (const m of source.matchAll(STATIC_IMPORT)) visit(new URL(m[1] ?? m[2], url));
  };
  visit(new URL(entry, ROOT));
  return seen;
}
