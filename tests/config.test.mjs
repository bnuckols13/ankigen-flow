import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_VERSION, SITE_URL, FEEDBACK_ENDPOINT, REPO_URL, PATREON_URL, DATA_LICENSE_URL } from '../src/config.js';

test('APP_VERSION matches package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(APP_VERSION, pkg.version);
});

test('URLs are absolute https', () => {
  assert.match(SITE_URL, /^https:\/\/.+\/$/);
  for (const url of [REPO_URL, PATREON_URL, DATA_LICENSE_URL]) assert.match(url, /^https:\/\//);
  assert.match(FEEDBACK_ENDPOINT, /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);
});
