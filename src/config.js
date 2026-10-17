// @ts-check
// Every external URL and environment value the app uses. Asset paths elsewhere stay relative:
// GitHub Pages serves the site under /ankigen/.

/** Keep in sync with package.json "version" (a test checks it). */
export const APP_VERSION = '0.1.0';

export const SITE_URL = 'https://xenohunter.github.io/ankigen/';
export const REPO_URL = 'https://github.com/xenohunter/ankigen';
export const PATREON_URL = 'https://www.patreon.com/cw/blisstweeting';

/** Apps Script web app (docs/FEEDBACK.md). Public by design: the script enforces its own limits. */
export const FEEDBACK_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbyyz5eLFkjHU2NUg5CgILLnt-8zYWKGJODuws0sFeeJh7NKuWOUMF2LwNnqIRQR9xU/exec';
