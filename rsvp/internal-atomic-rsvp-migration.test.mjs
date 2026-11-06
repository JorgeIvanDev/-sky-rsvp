import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/004_internal_atomic_rsvp.sql', import.meta.url), 'utf8');
test('internal RSVP migration has exactly one complete function body', () => {
  assert.equal((sql.match(/create or replace function cnidaria_internal\.submit_beta_rsvp\(/gi) || []).length, 1);
  assert.equal((sql.match(/\bend;\s*\$\$;/gi) || []).length, 1);
  assert.equal((sql.match(/\bas \$\$/gi) || []).length, 1);
  assert.match(sql, /p_idempotency_hash !~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(sql, /p_choice is null or p_choice not in \('yes','maybe','no'\)/);
});
test('internal RSVP function stays inaccessible to public web roles', () => {
  assert.match(sql, /language plpgsql security invoker/i);
  assert.match(sql, /revoke all on schema cnidaria_internal from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function cnidaria_internal\.submit_beta_rsvp\(uuid,uuid,uuid,uuid,text,text\)\s+from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /^\s*grant\s+/im);
});
test('recipient and challenge remain serialized and revocation checked', () => {
  assert.match(sql, /user_id = p_user_id and revoked_at is null/i);
  assert.equal((sql.match(/for update;/gi) || []).length, 2);
  assert.match(sql, /v_challenge\.consumed_at is not null/i);
});

test('expired invitations are rejected before retry receipt is returned', () => {
  const expiry = sql.indexOf('expires_at > v_now');
  const receipt = sql.indexOf('select * into v_receipt');
  const recipient = sql.indexOf('select * into v_recipient');
  assert.ok(expiry > 0, 'expiry gate must exist');
  assert.ok(expiry < recipient && expiry < receipt, 'expiry gate must precede both new submissions and retries');
  assert.match(sql, /from public\.cnidaria_invites\s+where id = p_invite_id and expires_at > v_now/i);
});

test('challenge proof cannot predate issuance or originate in the future', () => {
  assert.match(sql, /v_challenge\.issued_at > v_now/);
  assert.match(sql, /v_challenge\.verified_at < v_challenge\.issued_at/);
  assert.match(sql, /v_challenge\.verified_at > v_now/);
});
