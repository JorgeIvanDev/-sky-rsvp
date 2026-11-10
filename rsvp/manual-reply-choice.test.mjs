import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('manual invitation reply requires an explicit choice', () => {
  assert.match(html, /function replyText\(\)\{if\(!incoming\|\|!chosenReply\)return '';/);
  assert.doesNotMatch(html, /if\(!chosenReply\)chooseReply\('yes'\)/);
  assert.match(html, /Choose a response first\./);
  assert.match(html, /Choose a response first\./);
});

test('prototype does not claim manual replies are delivered as in-app RSVPs', () => {
  assert.match(html, /Secure in-app RSVP is not available yet/);
  assert.match(html, /No RSVP has been transmitted by this page/);
});
