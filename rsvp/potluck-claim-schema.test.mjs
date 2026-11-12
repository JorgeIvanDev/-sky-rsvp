import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/008_private_potluck_claim_cas.sql', import.meta.url), 'utf8');
test('server-only atomic claim/unclaim function has no browser grants', () => {
  assert.match(sql, /security invoker/i);
  assert.match(sql, /revoke all on function public\.cnidaria_potluck_claim_cas\([\s\S]*?from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+execute/i);
});
test('claim/unclaim validates room membership and revocation', () => {
  assert.match(sql, /m\.invite_id\s*=\s*p_invite_id/i);
  assert.match(sql, /m\.member_id\s*=\s*p_actor_member_id/i);
  assert.match(sql, /m\.revoked_at is null/i);
  assert.match(sql, /p_new_claimed_by is distinct from p_actor_member_id/i);
});
test('unclaim requires ownership and compare-and-swap prevents stealing/races', () => {
  assert.match(sql, /p_expected_claimed_by is distinct from p_actor_member_id/i);
  assert.match(sql, /p_new_claimed_by is not null and p_expected_claimed_by is not null/i);
  assert.match(sql, /i\.claimed_by is not distinct from p_expected_claimed_by/i);
  assert.match(sql, /i\.invite_id = p_invite_id/i);
  assert.match(sql, /i\.item_id = p_item_id/i);
  assert.match(sql, /get diagnostics v_changed = row_count/i);
  assert.match(sql, /return v_changed = 1/i);
});
