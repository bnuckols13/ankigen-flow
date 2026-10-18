// Reading a page's head in tests.

/** The content of the first <meta name|property="…">, or the href of the first <link rel="…">. @param {string} html @param {string} attr @param {string} value */
export function head(html, attr, value) {
  const tag = html.match(new RegExp(`<(?:meta|link)[^>]*${attr}="${value}"[^>]*>`))?.[0] ?? '';
  return tag.match(/(?:content|href)="([^"]*)"/)?.[1];
}
