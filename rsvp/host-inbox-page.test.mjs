import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../host-inbox.html', import.meta.url), 'utf8');

test('private inbox page wires trusted controller without exposing Supabase or persistent credentials', () => {
  assert.match(html, /createHostInboxController/);
  assert.match(html, /controller\.refresh\(invite\.value\.trim\(\)\)/);
  assert.match(html, /getAccessToken:async\(\)=>token\.value\.trim\(\)/);
  assert.match(html, /type="password"/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /controller\.clear\(\);token\.value=''/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|service_role|supabase\.co|\/rest\/v1|\/rpc\//i);
  assert.match(html, /name="referrer" content="no-referrer"/);
});

test('host inbox is an additive route preserving existing invitation entry point', () => {
  assert.match(html, /<title>CNIDARIA · Private host inbox<\/title>/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-label="RSVP totals"/);
});
