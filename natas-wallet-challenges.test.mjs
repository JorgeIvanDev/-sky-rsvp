import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./supabase/migrations/20261112235000_natas_wallet_challenges.sql',import.meta.url),'utf8');
for (const fragment of [
  'nonce_hash text primary key',
  'enable row level security',
  'revoke all on public.natas_wallet_challenges from public, anon, authenticated',
  'security definer',
  "set search_path = ''",
  'delete from public.natas_wallet_challenges c',
  'returning c.player_id, c.wallet_address, c.origin, c.challenge_hash, c.expires_at',
  'grant execute on function public.natas_consume_wallet_challenge(text) to service_role'
]) assert.ok(sql.includes(fragment),fragment);
assert.ok(!/grant\s+(?:select|insert|delete|execute)\s+on\s+[^;]+\s+to\s+(?:anon|authenticated)/i.test(sql));
console.log('Natas nonce SQL permission and atomic consumption structural checks passed');
