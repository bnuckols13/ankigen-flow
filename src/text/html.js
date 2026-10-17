// @ts-check
// Minimal HTML helpers for card fields. Data text is always escaped; only our own tags are emitted.

/** @type {Record<string, string>} */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {string} text */
export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** @type {Record<string, string>} */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/**
 * Plain text of an HTML fragment produced by this app, the way Anki strips a field for the sort
 * field and checksum: tags removed, entities decoded.
 * @param {string} html
 */
export function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name) => ENTITIES[name]);
}
