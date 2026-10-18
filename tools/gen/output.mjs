// @ts-check
// Read a unit's JSON object from the model's reply (tools/gen/batch.mjs).

/**
 * The reply is one JSON object, perhaps in a code fence. Sometimes the model writes the object, then
 * "Wait — correcting …" and the corrected object: then the last object that parses is the answer.
 * @param {string} raw
 * @returns {any}
 */
export function parseOutput(raw) {
  const s = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(s);
  } catch {
    for (const text of topLevelObjects(s).reverse()) {
      try {
        return JSON.parse(text);
      } catch {
        // an object in the prose, or cut off: try the one before
      }
    }
    throw new Error('no JSON object found');
  }
}

/**
 * The {…} spans at the top level of a text. Braces inside JSON strings don't count; quotes in the prose
 * between objects don't open strings.
 * @param {string} s
 */
function topLevelObjects(s) {
  /** @type {string[]} */
  const spans = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = depth > 0;
    } else if (ch === '{') {
      if (depth++ === 0) start = i;
    } else if (ch === '}' && depth > 0) {
      if (--depth === 0) spans.push(s.slice(start, i + 1));
    }
  }
  return spans;
}
