// @ts-check
// The feedback dialog (SPEC §5): the message, prefilled with the quote; an optional category and email; a
// honeypot; the privacy note. Client limits and the POST are in feedback/client.js. ui/feedback.js loads
// this module on first use, with the text the dialog shows (kept here, out of the first page load).

import { APP_VERSION, FEEDBACK_ENDPOINT, SITE_URL } from '../config.js';
import { EMAIL, decide, fingerprint, loadState, payload, record, requestBody, saveState, send } from '../feedback/client.js';
import { SAME, encodeHash } from '../state.js';
import { count } from './format.js';
import { h } from './dom.js';

/** @typedef {import('./feedback.js').ReportContext} ReportContext */

// ---------------------------------------------------------------- text

/** [value sent to the sheet, label] */
export const CATEGORIES = /** @type {const} */ ([
  ['wrong-translation', 'Wrong translation'],
  ['typo', 'Typo'],
  ['wrong-form', 'Wrong form'],
  ['bad-example', 'Bad example'],
  ['suggestion', 'Suggestion'],
  ['other', 'Other'],
]);

/** docs/FEEDBACK.md, "Privacy note for the site". */
export const PRIVACY_NOTE =
  'Reports are stored in a private spreadsheet and used only to fix the vocabulary and, if you leave an email, to reply to you. We store a random ID kept in your browser to filter spam. No tracking, no analytics.';

const EMAIL_HINT = 'If you want us to get back to you, leave your email.';
const THANKS = 'Thank you! Your report was sent.';

/** @type {Record<import('../feedback/client.js').Garbage, string>} */
export const GARBAGE_HINTS = {
  letters: 'This has no words in it. Could you describe what’s wrong?',
  short: 'That’s very short. A few words about what’s wrong help us fix it.',
  repeated: 'This looks like repeated characters. Could you describe what’s wrong?',
  duplicate: 'You’ve already sent this report.',
};

/** "12 seconds", "3 minutes", "5 hours", rounded up. @param {number} ms */
function duration(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return count(s, 'second');
  if (s < 3600) return count(Math.ceil(s / 60), 'minute');
  return count(Math.ceil(s / 3600), 'hour');
}

/** @param {{ reason: 'gap' | 'burst' | 'daily', waitMs: number }} limit */
export function waitText({ reason, waitMs }) {
  if (reason === 'gap') return `Please wait ${duration(waitMs)} before sending another report.`;
  if (reason === 'burst') return `You’ve sent several reports in a few minutes. Please try again in ${duration(waitMs)}.`;
  return `That’s a lot of reports in one day, thank you! You can send more in ${duration(waitMs)}.`;
}

/** Errors from send() in feedback/client.js and from feedback/Code.gs. @param {string} error */
export function sendErrorText(error) {
  switch (error) {
    case 'network':
      return 'Could not reach the report server. Check your connection and try again.';
    case 'timeout':
      return 'The report server did not answer in time. Please try again.';
    case 'daily_cap':
      return 'The report box is full for today. Please try again tomorrow.';
    case 'client_cap':
      return 'You’ve sent a lot of reports in the last few hours. Please try again later.';
    case 'bad_email':
      return 'Please check the email address, or leave it empty.';
    case 'too_large':
      return 'The message is too long. Please shorten it.';
    case 'empty':
      return 'Please write a message.';
    default:
      return 'The report server had a problem. Please try again in a minute.';
  }
}

/** How the dialog names the field a selection came from. */
const FIELD_LABELS = /** @type {Record<string, string>} */ ({
  Word: 'word', WordRuby: 'word', TypeTarget: 'word', Disambig: 'word', Translation: 'translation',
  Romanization: 'romanization', OtherScript: 'other script', MeasureWord: 'measure word', Hanja: 'hanja',
  Forms: 'key forms', IPA: 'IPA', Examples: 'examples', Related: 'antonyms & related', Etymology: 'etymology',
  POS: 'part of speech', Register: 'register', Emoji: 'emoji', ConceptId: 'concept ID',
});

/**
 * Where a report points: "forward card, back, examples".
 * @param {ReportContext} context @param {boolean} same same-language mode (the translation is a definition)
 */
export function placeText({ direction, side, field }, same) {
  const label = field === 'Translation' && same ? 'definition' : field ? (FIELD_LABELS[field] ?? field) : '';
  return [direction && `${direction} card`, side, label].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- dialog

/**
 * @param {string} id @param {string} label @param {HTMLElement} control
 * @param {{ optional?: boolean, hint?: HTMLElement }} [opts]
 */
function field(id, label, control, { optional = false, hint } = {}) {
  return h('div', { class: 'fb-field' }, h('label', { for: id }, label, optional && h('span', { class: 'fb-opt' }, ' (optional)')), control, hint);
}

/**
 * @param {{ app: import('./app.js').App, storage: Storage | null, shortcut: string, onSent: (context: ReportContext | null) => void }} opts
 *   onSent: after a report went out (or was dropped silently)
 */
export function createDialog({ app, storage, shortcut, onSent }) {
  /** @type {ReportContext | null} */
  let context = null;
  /** the context of the draft in the dialog: reopening it for the same thing keeps what was typed */
  let draftKey = '';
  /** fingerprint of the report the user was warned about: sending it again means "Send anyway" */
  let confirmed = '';
  let sending = false;
  let sent = false;
  /** kept for the next report while the page is open (never stored) */
  let lastEmail = '';

  const about = h('p', { class: 'fb-about' });
  const message = h('textarea', { id: 'fb-message', name: 'message', rows: '5', maxlength: '4000', required: true });
  const category = h(
    'select',
    { id: 'fb-category', name: 'category' },
    h('option', { value: '' }, 'Choose…'),
    ...CATEGORIES.map(([value, label]) => h('option', { value }, label)),
  );
  const email = h('input', { id: 'fb-email', name: 'email', type: 'email', maxlength: '254', autocomplete: 'email', 'aria-describedby': 'fb-email-hint' });
  const honeypot = h('input', { name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' });
  const status = h('p', { class: 'fb-status', role: 'status' });
  const sendButton = h('button', { type: 'submit', class: 'button primary' }, 'Send');
  const close = () => dialog.close();
  const form = h(
    'form',
    { class: 'fb-form', novalidate: true },
    h('div', { class: 'fb-head' }, h('h2', { id: 'fb-title' }, 'Feedback'), h('button', { type: 'button', class: 'fb-x', 'aria-label': 'Close', onclick: close }, '×')),
    about,
    field('fb-message', 'Message', message),
    field('fb-category', 'Category', category, { optional: true }),
    field('fb-email', 'Email', email, { optional: true, hint: h('p', { class: 'fb-hint', id: 'fb-email-hint' }, EMAIL_HINT) }),
    h('div', { class: 'fb-hp', 'aria-hidden': 'true' }, h('label', null, 'Leave this empty ', honeypot)),
    status,
    h(
      'div',
      { class: 'fb-actions' },
      h('span', { class: 'fb-keys' }, `${shortcut} to send`),
      h('button', { type: 'button', class: 'button', onclick: close }, 'Cancel'),
      sendButton,
    ),
    h('p', { class: 'fb-privacy' }, PRIVACY_NOTE),
  );
  const thanksClose = h('button', { type: 'button', class: 'button primary', onclick: close }, 'Close');
  const thanks = h('div', { class: 'fb-done', hidden: true }, h('p', { class: 'fb-thanks', role: 'status' }, THANKS), thanksClose);
  const dialog = h('dialog', { class: 'fb', id: 'feedback', 'aria-labelledby': 'fb-title' }, form, thanks);
  document.body.append(dialog);

  /** "About вода · forward card, back, examples" @param {ReportContext | null} c */
  function aboutLine(c) {
    if (!c?.word && !c?.conceptId) return [];
    const { config, ctx } = app.view();
    const where = placeText(c, config.know === SAME);
    return ['About ', h('b', { lang: ctx?.learn.tag ?? null }, c.word || c.conceptId || ''), where ? ` · ${where}` : ''];
  }

  /** @param {string} text @param {HTMLElement} [focus] */
  function say(text, focus) {
    status.textContent = text;
    focus?.focus();
  }

  /** @param {ReportContext | null} next */
  function reset(next) {
    form.reset();
    email.value = lastEmail;
    message.value = next?.selectedText ? `“${next.selectedText}”\n` : '';
    const line = aboutLine(next);
    about.replaceChildren(...line);
    about.hidden = !line.length;
    say('');
    confirmed = '';
    sendButton.textContent = 'Send';
    form.hidden = false;
    thanks.hidden = true;
    sent = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    /** @type {import('../feedback/client.js').Report} */
    const report = {
      message: message.value.trim(),
      category: category.value,
      email: email.value.trim(),
      website: honeypot.value,
      selectedText: context?.selectedText ?? '',
      conceptId: context?.conceptId ?? '',
      direction: context?.direction ?? '',
      side: context?.side ?? '',
      field: context?.field ?? '',
    };
    if (!report.message) return say(sendErrorText('empty'), message);
    if (report.email && !EMAIL.test(report.email)) return say(sendErrorText('bad_email'), email);
    const now = Date.now();
    const state = loadState(storage);
    const decision = decide(state, report, now, { confirmed: confirmed === fingerprint(report) });
    if (decision.action === 'wait') return say(waitText(decision));
    if (decision.action === 'confirm') {
      confirmed = fingerprint(report);
      sendButton.textContent = 'Send anyway';
      return say(GARBAGE_HINTS[decision.reason], message);
    }
    if (decision.action === 'send') {
      const { config } = app.view();
      const env = {
        clientId: state.clientId,
        now: new Date(now),
        learning: config.learn ?? '',
        known: config.know ?? '',
        configUrl: SITE_URL + encodeHash(config, app.meta),
        appVersion: APP_VERSION,
        dataVersion: app.meta.version.data,
        browserLang: navigator.language ?? '',
      };
      sending = true;
      sendButton.disabled = true;
      say('Sending…');
      const result = await send(requestBody(payload(report, env)), { endpoint: FEEDBACK_ENDPOINT });
      sending = false;
      sendButton.disabled = false;
      if (!result.ok) return say(sendErrorText(result.error));
    }
    // Sent, or dropped after the garbage cutoff: both thank the user. Read the state again first: another
    // tab may have sent a report meanwhile.
    saveState(storage, record(loadState(storage), report, now, decision.garbage));
    lastEmail = report.email ?? '';
    say('');
    onSent(context);
    sent = true;
    form.hidden = true;
    thanks.hidden = false;
    thanksClose.focus();
  });

  message.addEventListener('input', () => {
    if (!confirmed) return;
    confirmed = '';
    sendButton.textContent = 'Send';
    say('');
  });
  // Ctrl/Cmd+Enter sends; the page's own shortcut handler must not see it.
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    sendButton.click();
  });

  return {
    isOpen: () => dialog.open,
    /** @param {ReportContext | null} next */
    show(next) {
      if (dialog.open) return;
      const key = JSON.stringify(next ?? {});
      if (sent || key !== draftKey) reset(next);
      draftKey = key;
      context = next;
      dialog.showModal();
      message.focus();
      message.setSelectionRange(message.value.length, message.value.length);
    },
  };
}

/** @typedef {ReturnType<typeof createDialog>} Dialog */
