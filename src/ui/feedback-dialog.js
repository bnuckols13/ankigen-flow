// @ts-check
// The feedback dialog (SPEC §5): the message, prefilled with the quote; an optional category and email; a
// honeypot; the privacy note. Client limits and the POST are in feedback/client.js. ui/feedback.js loads
// this module on first use, with the English texts the dialog shows (kept here, out of the first page load;
// data/ui translates them with the page's other texts).

import { APP_VERSION, FEEDBACK_ENDPOINT, SITE_URL } from '../config.js';
import { EMAIL, decide, fingerprint, loadState, payload, record, requestBody, saveState, send } from '../feedback/client.js';
import { SAME, encodeHash } from '../state.js';
import { bind, fillNodes, h, msg } from './dom.js';
import { addEnglish, plural, t } from './i18n.js';

/** @typedef {import('./feedback.js').ReportContext} ReportContext */

// ---------------------------------------------------------------- text

/** The values sent to the sheet; the labels are fb.category.<value>. */
export const CATEGORIES = /** @type {const} */ (['wrong-translation', 'typo', 'wrong-form', 'bad-example', 'suggestion', 'other']);

/** The dialog's English texts (see ui/strings.js). fb.privacy is docs/FEEDBACK.md's "Privacy note for the site". */
export const DIALOG_STRINGS = {
  'fb.title': 'Feedback',
  'fb.close': 'Close',
  'fb.about': 'About {word}',
  'fb.message': 'Message',
  'fb.category': 'Category',
  'fb.choose': 'Choose…',
  'fb.category.wrong-translation': 'Wrong translation',
  'fb.category.typo': 'Typo',
  'fb.category.wrong-form': 'Wrong form',
  'fb.category.bad-example': 'Bad example',
  'fb.category.suggestion': 'Suggestion',
  'fb.category.other': 'Other',
  'fb.email': 'Email',
  'fb.optional': '(optional)',
  'fb.emailHint': 'If you want us to get back to you, leave your email.',
  'fb.keys': '{shortcut} to send',
  'fb.cancel': 'Cancel',
  'fb.send': 'Send',
  'fb.sendAnyway': 'Send anyway',
  'fb.sending': 'Sending…',
  'fb.privacy':
    'Reports are stored in a private spreadsheet and used only to fix the vocabulary and, if you leave an email, to reply to you. We store a random ID kept in your browser to filter spam. No tracking, no analytics.',
  'fb.thanks': 'Thank you! Your report was sent.',
  'fb.garbage.letters': 'This has no words in it. Could you describe what’s wrong?',
  'fb.garbage.short': 'That’s very short. A few words about what’s wrong help us fix it.',
  'fb.garbage.repeated': 'This looks like repeated characters. Could you describe what’s wrong?',
  'fb.garbage.duplicate': 'You’ve already sent this report.',
  'fb.wait.gap': 'Please wait {time} before sending another report.',
  'fb.wait.burst': 'You’ve sent several reports in a few minutes. Please try again in {time}.',
  'fb.wait.daily': 'That’s a lot of reports in one day, thank you! You can send more in {time}.',
  'fb.error.network': 'Could not reach the report server. Check your connection and try again.',
  'fb.error.timeout': 'The report server did not answer in time. Please try again.',
  'fb.error.daily_cap': 'The report box is full for today. Please try again tomorrow.',
  'fb.error.client_cap': 'You’ve sent a lot of reports in the last few hours. Please try again later.',
  'fb.error.bad_email': 'Please check the email address, or leave it empty.',
  'fb.error.too_large': 'The message is too long. Please shorten it.',
  'fb.error.empty': 'Please write a message.',
  'fb.error.server': 'The report server had a problem. Please try again in a minute.',
  'fb.place.forward': 'forward card',
  'fb.place.reverse': 'reverse card',
  'fb.place.front': 'front',
  'fb.place.back': 'back',
  'fb.field.word': 'word',
  'fb.field.translation': 'translation',
  'fb.field.definition': 'definition',
  'fb.field.romanization': 'romanization',
  'fb.field.otherScript': 'other script',
  'fb.field.measureWord': 'measure word',
  'fb.field.hanja': 'hanja',
  'fb.field.forms': 'key forms',
  'fb.field.ipa': 'IPA',
  'fb.field.examples': 'examples',
  'fb.field.related': 'antonyms & related',
  'fb.field.etymology': 'etymology',
  'fb.field.pos': 'part of speech',
  'fb.field.register': 'register',
  'fb.field.emoji': 'emoji',
  'fb.field.conceptId': 'concept ID',
};

/** Waiting times, rounded up. */
export const DIALOG_PLURALS = {
  seconds: { one: '{n} second', other: '{n} seconds' },
  minutes: { one: '{n} minute', other: '{n} minutes' },
  hours: { one: '{n} hour', other: '{n} hours' },
};

addEnglish(DIALOG_STRINGS, DIALOG_PLURALS);

const ERRORS = new Set(['network', 'timeout', 'daily_cap', 'client_cap', 'bad_email', 'too_large', 'empty']);

/** "12 seconds", "3 minutes", "5 hours", rounded up. @param {number} ms */
function duration(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return plural('seconds', s);
  if (s < 3600) return plural('minutes', Math.ceil(s / 60));
  return plural('hours', Math.ceil(s / 3600));
}

/** @param {{ reason: 'gap' | 'burst' | 'daily', waitMs: number }} limit */
export const waitText = ({ reason, waitMs }) => t(`fb.wait.${reason}`, { time: duration(waitMs) });

/** Errors from send() in feedback/client.js and from feedback/Code.gs. @param {string} error */
export const sendErrorText = (error) => t(`fb.error.${ERRORS.has(error) ? error : 'server'}`);

/** How the dialog names the field a selection came from: the note type's field → fb.field.<name>. */
const FIELD_LABELS = /** @type {Record<string, string>} */ ({
  Word: 'word', WordRuby: 'word', TypeTarget: 'word', Disambig: 'word', Translation: 'translation',
  Romanization: 'romanization', OtherScript: 'otherScript', MeasureWord: 'measureWord', Hanja: 'hanja',
  Forms: 'forms', IPA: 'ipa', Examples: 'examples', Related: 'related', Etymology: 'etymology',
  POS: 'pos', Register: 'register', Emoji: 'emoji', ConceptId: 'conceptId',
});

/**
 * Where a report points: "forward card, back, examples".
 * @param {ReportContext} context @param {boolean} same same-language mode (the translation is a definition)
 */
export function placeText({ direction, side, field }, same) {
  const name = field === 'Translation' && same ? 'definition' : field ? FIELD_LABELS[field] : '';
  const label = name ? t(`fb.field.${name}`) : (field ?? '');
  const parts = [direction === 'forward' || direction === 'reverse' ? t(`fb.place.${direction}`) : direction, side === 'front' || side === 'back' ? t(`fb.place.${side}`) : side, label];
  return parts.filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- dialog

/**
 * @param {string} id @param {string} label the key of its text @param {HTMLElement} control
 * @param {{ optional?: boolean, hint?: HTMLElement }} [opts]
 */
function field(id, label, control, { optional = false, hint } = {}) {
  return h('div', { class: 'fb-field' }, h('label', { for: id }, msg(label), optional && h('span', { class: 'fb-opt' }, ' ', msg('fb.optional'))), control, hint);
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
    h('option', { value: '' }, msg('fb.choose')),
    ...CATEGORIES.map((value) => h('option', { value }, msg(`fb.category.${value}`))),
  );
  const email = h('input', { id: 'fb-email', name: 'email', type: 'email', maxlength: '254', autocomplete: 'email', 'aria-describedby': 'fb-email-hint' });
  const honeypot = h('input', { name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' });
  const status = h('p', { class: 'fb-status', role: 'status' });
  /** Send, or Send anyway after a warning. */
  let sendKey = 'fb.send';
  const sendButton = h('button', { type: 'submit', class: 'button primary' });
  bind(sendButton, (button) => (button.textContent = t(sendKey)));
  /** @param {'fb.send' | 'fb.sendAnyway'} key */
  const sendText = (key) => {
    sendKey = key;
    sendButton.textContent = t(key);
  };
  const close = () => dialog.close();
  const form = h(
    'form',
    { class: 'fb-form', novalidate: true },
    h('div', { class: 'fb-head' }, h('h2', { id: 'fb-title' }, msg('fb.title')), h('button', { type: 'button', class: 'fb-x', 'aria-label': msg('fb.close'), onclick: close }, '×')),
    about,
    field('fb-message', 'fb.message', message),
    field('fb-category', 'fb.category', category, { optional: true }),
    field('fb-email', 'fb.email', email, { optional: true, hint: h('p', { class: 'fb-hint', id: 'fb-email-hint' }, msg('fb.emailHint')) }),
    h('div', { class: 'fb-hp', 'aria-hidden': 'true' }, h('label', null, 'Leave this empty ', honeypot)),
    status,
    h(
      'div',
      { class: 'fb-actions' },
      h('span', { class: 'fb-keys' }, msg('fb.keys', { shortcut })),
      h('button', { type: 'button', class: 'button', onclick: close }, msg('fb.cancel')),
      sendButton,
    ),
    h('p', { class: 'fb-privacy' }, msg('fb.privacy')),
  );
  const thanksClose = h('button', { type: 'button', class: 'button primary', onclick: close }, msg('fb.close'));
  const thanks = h('div', { class: 'fb-done', hidden: true }, h('p', { class: 'fb-thanks', role: 'status' }, msg('fb.thanks')), thanksClose);
  const dialog = h('dialog', { class: 'fb', id: 'feedback', 'aria-labelledby': 'fb-title' }, form, thanks);
  document.body.append(dialog);

  /** "About вода · forward card, back, examples" @param {ReportContext | null} c */
  function aboutLine(c) {
    if (!c?.word && !c?.conceptId) return [];
    const { config, ctx } = app.view();
    const where = placeText(c, config.know === SAME);
    const word = h('b', { lang: ctx?.learn.tag ?? null }, c.word || c.conceptId || '');
    return [...fillNodes(t('fb.about'), { word }), where ? ` · ${where}` : ''];
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
    sendText('fb.send');
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
      sendText('fb.sendAnyway');
      return say(t(`fb.garbage.${decision.reason}`), message);
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
      say(t('fb.sending'));
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
    sendText('fb.send');
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
