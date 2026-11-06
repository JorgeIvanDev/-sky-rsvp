import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/003_beta_recipient_revocation.sql', import.meta.url), 'utf8');
test('revocation is stored on the recipient record', () =>
  assert.match(sql, /alter table public\.cnidaria_beta_recipients\s+add column if not exists revoked_at timestamptz/i));
test('revoked recipients excluded from active index', () =>
  assert.match(sql, /where revoked_at is null/i));
test('no client grants or exposed function', () => {
  assert.doesNotMatch(sql, /\bgrant\s+/i);
  assert.doesNotMatch(sql, /create\s+(or replace\s+)?function/i);
  assert.match(sql, /revoke all on table public\.cnidaria_beta_recipients from public, anon, authenticated/i);
});
test('RLS remains forced', () => assert.match(sql, /force row level security/i));
