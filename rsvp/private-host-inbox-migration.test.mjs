import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/005_private_host_inbox.sql', import.meta.url), 'utf8');
test('host inbox binds verified host to invite in same receipt query', () => {
  assert.match(sql, /join public\.cnidaria_beta_hosts h on h\.invite_id = r\.invite_id/i);
  assert.match(sql, /r\.invite_id = p_invite_id and h\.host_user_id = p_host_user_id/i);
  assert.match(sql, /order by r\.submitted_at desc, r\.id desc/i);
  assert.match(sql, /p_limit < 1 or p_limit > 50/i);
});
test('host binding and inbox are never publicly executable', () => {
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all on public\.cnidaria_beta_hosts from public, anon, authenticated/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /revoke all on function cnidaria_internal\.read_beta_host_inbox\(uuid,uuid,integer\)\s+from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /\bgrant\s+(?:all|execute|select)\b/i);
});
