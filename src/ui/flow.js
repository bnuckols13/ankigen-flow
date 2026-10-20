// @ts-check
// Step 6: the flow drills (docs/FLOW.md). Switches for the spoken word, ear, shadow and reflex cards and the
// drill cues, the shadow card's slow pass, and the voice the learner speaks as. The texts are English only:
// they live here, not in ui/strings.js, so the translation checker and data/ui are untouched.

import { SPEEDS } from '../deck/flow.js';
import { debounce, h } from './dom.js';
import { help } from './popover.js';

export const FLOW_UI = {
  title: 'Flow drills',
  note: 'From the Mimic Method: the ear and the mouth before the page. Each drill adds cards. Turn on what you will practise out loud.',
  audio: 'Speak the word',
  audioHelp:
    'Plays the word with your device’s text-to-speech on the front of forward cards and on the back of reverse cards, article included. Anki desktop, AnkiDroid and AnkiMobile all read {{tts}} tags with the voices installed on the device.',
  ear: 'Ear cards',
  earHelp:
    'A third card per word: you hear it, and see its IPA if that row is on, before you ever see it spelled. Say it back, then flip. A spelling pronunciation never forms, because the sound comes first.',
  shadow: 'Shadow cards',
  shadowHelp:
    'A card for every word that has an example: the sentence plays at the slow speed, then at full speed, with no text. Shadow it live, melody first, then the words. The sentence and its translation wait on the back.',
  speed: 'Slow pass',
  speedHelp: 'The speed of the first playing. Quarter speed is the Flow School drill. Some voices cannot go that slow and play at their slowest.',
  reflex: 'Reflex cards',
  reflexHelp:
    'A stimulus answered before thought: a noun asks for its article, a verb for a key form (I, preterite…), a noun in a language without articles for its plural or genitive. A bar drains in a moment and a half. The answer is on the back, spoken.',
  cues: 'Drill cues',
  cuesHelp:
    'A short cue on every question side, fixed per word: whisper it, pause, hold someone warm in mind, hum the melody first, say it with the face, stand up, quarter speed, or say it as your model.',
  voice: 'Speak as',
  voiceHelp:
    'The ego switch: name one native speaker whose voice you borrow, and every card reminds you to say it as that person. Pick someone with hours of clear video, and shadow only them.',
  voicePlaceholder: 'a native speaker you shadow',
  tts: 'The cards need a text-to-speech voice for the language you learn, installed on the device where you study.',
};

/**
 * @param {HTMLElement} root
 * @param {import('./app.js').App} app
 */
export function mountFlow(root, app) {
  /** @param {string} label @param {string} about @param {(on: boolean) => Partial<import('../state.js').Config>} change */
  function toggle(label, about, change) {
    const input = h('input', { type: 'checkbox', role: 'switch' });
    input.addEventListener('change', () => app.update(() => change(input.checked)));
    const el = h('div', { class: 'opt' }, h('label', { class: 'switch' }, input, h('span', null, label)), help(label, about));
    root.append(el);
    return { input, el };
  }

  root.append(h('p', { class: 'step-note' }, FLOW_UI.note));
  const audio = toggle(FLOW_UI.audio, FLOW_UI.audioHelp, (on) => ({ audio: on }));
  const ear = toggle(FLOW_UI.ear, FLOW_UI.earHelp, (on) => ({ ear: on }));
  const shadow = toggle(FLOW_UI.shadow, FLOW_UI.shadowHelp, (on) => ({ shadow: on }));

  const speedId = 'opt-flow-speed';
  const speeds = SPEEDS.map((value) => {
    const input = h('input', { type: 'radio', name: speedId, value: String(value) });
    input.addEventListener('change', () => app.update(() => ({ speed: value })));
    return input;
  });
  const speed = h(
    'div',
    { class: 'opt opt-sub' },
    h('span', { id: speedId, class: 'opt-label' }, FLOW_UI.speed),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': speedId }, ...speeds.map((input, i) => h('label', null, input, h('span', null, `${SPEEDS[i]}×`)))),
    help(FLOW_UI.speed, FLOW_UI.speedHelp),
  );
  root.append(speed);

  const reflex = toggle(FLOW_UI.reflex, FLOW_UI.reflexHelp, (on) => ({ reflex: on }));
  const cues = toggle(FLOW_UI.cues, FLOW_UI.cuesHelp, (on) => ({ cues: on }));

  const voiceId = 'opt-flow-voice';
  const voiceInput = h('input', { type: 'text', id: voiceId, class: 'text', placeholder: FLOW_UI.voicePlaceholder, autocomplete: 'off', spellcheck: 'false' });
  const setVoice = debounce(() => app.update(() => ({ voice: voiceInput.value })), 250);
  voiceInput.addEventListener('input', setVoice);
  voiceInput.addEventListener('change', () => app.update(() => ({ voice: voiceInput.value })));
  root.append(h('div', { class: 'opt' }, h('label', { class: 'opt-label', for: voiceId }, FLOW_UI.voice), voiceInput, help(FLOW_UI.voice, FLOW_UI.voiceHelp)));
  root.append(h('p', { class: 'step-note flow-tts' }, FLOW_UI.tts));

  return {
    /** @param {import('./app.js').View} view */
    update({ config }) {
      audio.input.checked = config.audio;
      ear.input.checked = config.ear;
      shadow.input.checked = config.shadow;
      reflex.input.checked = config.reflex;
      cues.input.checked = config.cues;
      speed.classList.toggle('is-disabled', !config.shadow);
      for (const input of speeds) {
        input.checked = Number(input.value) === config.speed;
        input.disabled = !config.shadow;
      }
      // Keep what is being typed: the model trims and clips it only when the field loses focus.
      if (document.activeElement !== voiceInput && voiceInput.value !== config.voice) voiceInput.value = config.voice;
    },
  };
}
