import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const title = readFileSync(new URL('../title.html', import.meta.url), 'utf8');

test('cinematic launch transfers to a top-level document after preview', () => {
  assert.match(title, /const destination=next===/);
  assert.match(title, /if\(!previewLoaded\)\{location\.replace\(destination\);return\}/);
  assert.match(title, /location\.replace\(destination)\s*\},next===/);
  assert.doesNotMatch(title, /preview\.style\.pointerEvents='auto'/);
  assert.doesNotMatch(title, /preview\.focus\(\)/);
});

test('cinematic original artwork and primary links remain present', () => {
  assert.match(title, /assets\/cnidaria-original-logo\.svg/);
  assert.match(title, /assets\/cnidaria-jellyfish-green\.svg/);
  for (const id of ['start', 'account-entry', 'leaderboard-entry', 'invitations-entry']) {
    assert.match(title, new RegExp('id="' + id + '"'));
  }
});
