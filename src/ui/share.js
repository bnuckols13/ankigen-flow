// @ts-check
// The Share block under Download: copy the page's link, which carries the deck and the interface language, or
// share it with the system's share sheet (where the browser has one), on a few sites, or by email. main.js
// loads this module when the block first appears.

import { SHARE_SITES } from '../config.js';
import { bind, h, msg } from './dom.js';
import { fill, language, plural, t } from './i18n.js';
import { SITE_ICONS } from './share-icons.js';

const OWN_ICONS = {
  link: '<path d="M6.5 9.5l3-3M7.5 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M8.5 11.5l-1 1a2.5 2.5 0 0 1-3.5-3.5l1-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  check: '<path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  share: '<path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 8.5V13h9V8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  mail: '<rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M2.5 4.5 8 9l5.5-4.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>',
};

/** @param {string} svg @param {string} viewBox */
function glyph(svg, viewBox) {
  const span = h('span', { class: 'icon', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="${viewBox}" width="16" height="16" focusable="false">${svg}</svg>`;
  return span;
}
/** @param {keyof typeof OWN_ICONS} name */
const ownIcon = (name) => glyph(OWN_ICONS[name], '0 0 16 16');
/** @param {string} id */
const siteIcon = (id) => glyph(`<path fill="currentColor" d="${SITE_ICONS[id]}"/>`, '0 0 24 24');

/** Put text on the clipboard; false if the browser would not. @param {string} text */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // no Clipboard API (or no permission): the old way, through a selected text field
    const field = h('textarea', { readonly: true, class: 'sr-only' });
    field.value = text;
    document.body.append(field);
    field.select();
    const done = document.execCommand('copy');
    field.remove();
    return done;
  }
}

/**
 * @param {HTMLElement} root
 * @param {import('./app.js').App} app
 */
export function mountShare(root, app) {
  const url = () => app.address(location.href);
  const text = () => plural('lede', app.meta.languages.active.length);
  const status = h('p', { class: 'share-status', role: 'status' });
  /** The link was just copied: the button says so for a moment. */
  let copied = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const copyIcon = h('span', null, ownIcon('link'));
  const copyLabel = h('span');
  bind(copyLabel, (el) => (el.textContent = t(copied ? 'share.copied' : 'share.copy')));
  /** @param {boolean} on */
  const showCopied = (on) => {
    copied = on;
    copyIcon.replaceChildren(ownIcon(on ? 'check' : 'link'));
    copyLabel.textContent = t(on ? 'share.copied' : 'share.copy');
  };
  const copyButton = h('button', { type: 'button', class: 'button share-copy' }, copyIcon, copyLabel);
  copyButton.addEventListener('click', async () => {
    const done = await copy(url());
    clearTimeout(timer);
    showCopied(done);
    status.textContent = done ? '' : t('share.copyFailed');
    if (done) timer = setTimeout(() => showCopied(false), 2500);
  });

  const native = 'share' in navigator ? h('button', { type: 'button', class: 'button' }, ownIcon('share'), msg('share.more')) : null;
  native?.addEventListener('click', () => navigator.share({ title: 'AnkiGen', text: text(), url: url() }).catch(() => {}));

  const sites = SHARE_SITES.map((site) => {
    const link = h('a', { class: 'share-site', target: '_blank', rel: 'noopener', 'aria-label': msg('share.on', { site: site.name }), title: site.name }, siteIcon(site.id));
    return { site, link };
  });
  const email = h('a', { class: 'share-site', 'aria-label': msg('share.email'), title: msg('share.email') }, ownIcon('mail'));

  root.append(h('div', { class: 'share-row' }, copyButton, native, ...sites.map((s) => s.link), email), status);

  return {
    /** The links point at the page as it is now. */
    update() {
      const values = { url: encodeURIComponent(url()), text: encodeURIComponent(text()) };
      for (const { site, link } of sites) {
        link.hidden = Boolean(site.languages && !site.languages.includes(language()));
        link.href = fill(site.url, values);
      }
      email.href = `mailto:?subject=AnkiGen&body=${values.text}%0A%0A${values.url}`;
    },
  };
}
