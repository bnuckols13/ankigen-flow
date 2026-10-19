// @ts-check
// "Reset all" in the preview: after an "Are you sure?" dialog, the deck's settings go back to the defaults.
// The page forgets the saved config and reloads without one in the address, so nothing chosen or loaded is
// kept. The interface language stays (?lang= and its own saved choice), and so does the feedback client's
// state, which is not a setting. main.js loads this module on the first click.

import { STORAGE_KEY } from '../state.js';
import { h, msg } from './dom.js';

/** @type {HTMLDialogElement | null} */
let dialog = null;

/** @param {Storage | null} storage */
function reset(storage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // storage disabled: nothing was saved
  }
  const url = new URL(location.href);
  url.hash = '';
  history.replaceState(null, '', url);
  location.reload();
}

/** Ask, and reset if the user agrees. @param {Storage | null} storage */
export function askReset(storage) {
  if (!dialog) {
    const cancel = h('button', { type: 'button', class: 'button', autofocus: true, onclick: () => dialog?.close() }, msg('reset.cancel'));
    const confirm = h('button', { type: 'button', class: 'button danger', onclick: () => reset(storage) }, msg('reset.button'));
    dialog = h(
      'dialog',
      { class: 'confirm', closedby: 'any', 'aria-labelledby': 'reset-title', 'aria-describedby': 'reset-text' },
      h('h2', { id: 'reset-title' }, msg('reset.title')),
      h('p', { id: 'reset-text' }, msg('reset.text')),
      h('div', { class: 'confirm-actions' }, cancel, confirm),
    );
    document.body.append(dialog);
  }
  dialog.showModal();
}
