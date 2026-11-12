import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/007_hall_of_fame_foundation.sql', import.meta.url), 'utf8');
const tables = ['cnidaria_players','cnidaria_challenge_groups','cnidaria_group_members','cnidaria_toss_records'];
const views = ['cnidaria_global_personal_bests','cnidaria_group_personal_bests'];

test('player, group, membership and toss tables fail closed', () => {
  for (const table of tables) {
    assert.match(sql, new RegExp('create table if not exists public\\.' + table + '\\b', 'i'));
    assert.match(sql, new RegExp('alter table public\\.' + table + ' enable row level security;', 'i'));
    assert.match(sql, new RegExp('alter table public\\.' + table + ' force row level security;', 'i'));
    assert.match(sql, new RegExp('revoke all on public\\.' + table + ' from public, anon, authenticated;', 'i'));
  }
  for (const view of views) {
    assert.match(sql, new RegExp('create or replace view public\\.' + view, 'i'));
    assert.match(sql, new RegExp('revoke all on public\\.' + view + ' from public, anon, authenticated;', 'i'));
  }
  assert.match(sql, /with \(security_invoker = true\)/);
  assert.doesNotMatch(sql, /create\s+policy|grant\s+(?:all|select|insert|update|delete|execute)\s+on/i);
});

test('global Hall of Fame keeps exactly one eligible personal best per player', () => {
  assert.match(sql, /select distinct on \(r\.player_id\)/);
  assert.match(sql, /where r\.eligible_for_ranking = true/);
  assert.match(sql, /order by r\.player_id, r\.height_cm desc, r\.recorded_at asc, r\.record_id asc/);
  assert.match(sql, /eligible_for_ranking boolean not null default false/);
  assert.match(sql, /check \(not hand_catch_verified\)/);
});

test('group board reuses the global best, filters revoked members and requires group-scoped membership', () => {
  assert.match(sql, /primary key \(group_id, player_id\)/);
  assert.match(sql, /join public\.cnidaria_global_personal_bests b on b\.player_id = m\.player_id/);
  assert.match(sql, /where m\.revoked_at is null/);
  assert.match(sql, /m\.group_id, b\.player_id, b\.record_id/);
});

test('migration leaves all RSVP and Thanksgiving invitation structures untouched', () => {
  assert.doesNotMatch(sql, /alter table public\.cnidaria_(?:invites|beta_rsvp_receipts|event_rooms|event_room_members)/i);
  assert.doesNotMatch(sql, /insert into public\./i);
});
