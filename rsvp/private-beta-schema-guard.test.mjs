import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Structural guard only. PostgreSQL concurrency, RLS role and transaction tests
// remain mandatory before deploying the private-beta schema.
const sql = readFileSync(new URL('../supabase/002_private_beta_rsvp_storage.sql', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\r\n]*/g, '');
const tables = ['cnidaria_beta_recipients', 'cnidaria_beta_challenges', 'cnidaria_beta_rsvp_receipts'];
test('private beta RSVP tables remain fail-closed to browser roles', () => {
  for (const name of tables) {
    assert.match(sql, new RegExp('alter\\s+table\\s+public\\.' + name + '\\s+enable\\s+row\\s+level\\s+security\\s*;', 'i'));
    assert.match(sql, new RegExp('alter\\s+table\\s+public\\.' + name + '\\s+force\\s+row\\s+level\\s+security\\s*;', 'i'));
    assert.match(sql, new RegExp('revoke\\s+all\\s+on\\s+table\\s+public\\.' + name + '\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*;', 'i'));
  }
  assert.doesNotMatch(sql, /\bcreate\s+policy\b/i, 'no browser-readable beta policies before authorization review');
  assert.doesNotMatch(sql, /\bgrant\s+(?:all|select|insert|update|delete)\b/i, 'no new table grants');
  assert.doesNotMatch(sql, /\bcreate\s+(?:or\s+replace\s+)?function\b/i, 'no RPC introduced in storage migration');
});

test('one receipt and one consumed challenge per recipient remain enforced', () => {
  assert.match(sql, /unique\s*\(invite_id,\s*recipient_id\)/i);
  assert.match(sql, /unique\s*\(recipient_id,\s*idempotency_hash\)/i);
  assert.match(sql, /unique\s*\(challenge_id\)/i);
  assert.match(sql, /foreign\s+key\s*\(challenge_id,\s*recipient_id,\s*invite_id\)/i);
  assert.match(sql, /foreign\s+key\s*\(recipient_id,\s*invite_id\)/i);
});
