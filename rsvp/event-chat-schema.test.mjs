import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/009_private_event_chat_post.sql', import.meta.url), 'utf8');
test('chat append is server-only, scoped, and rejects revoked authors', () => {
  assert.match(sql, /function public\.cnidaria_event_chat_post\(/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /m\.invite_id\s*=\s*p_invite_id/i);
  assert.match(sql, /m\.member_id\s*=\s*p_actor_member_id/i);
  assert.match(sql, /m\.revoked_at is null/i);
  assert.match(sql, /char_length\(btrim\(p_body\)\) not between 1 and 2000/i);
  assert.match(sql, /insert into public\.cnidaria_event_messages\(invite_id, author_id, body\)/i);
  assert.match(sql, /revoke all on function public\.cnidaria_event_chat_post\(uuid,uuid,text\)\s+from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+execute\s+on\s+function/i);
});
test('migration does not rewrite existing RSVP or invite data', () => {
  assert.doesNotMatch(sql, /\b(?:alter|drop|truncate|update|delete from)\s+(?:table\s+)?public\.cnidaria_(?:invites|rsvps)/i);
});
