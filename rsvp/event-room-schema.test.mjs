import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/006_event_room_foundation.sql', import.meta.url), 'utf8');
const tables = ['cnidaria_event_rooms','cnidaria_event_room_members','cnidaria_event_potluck_items','cnidaria_event_messages'];

test('each event table has forced RLS and no browser-role grants', () => {
  for (const table of tables) {
    assert.match(sql, new RegExp('create table if not exists public\\.' + table + '\\b', 'i'));
    assert.match(sql, new RegExp('alter table public\\.' + table + ' enable row level security;', 'i'));
    assert.match(sql, new RegExp('alter table public\\.' + table + ' force row level security;', 'i'));
    assert.match(sql, new RegExp('revoke all on public\\.' + table + ' from public, anon, authenticated;', 'i'));
  }
  assert.doesNotMatch(sql, /create\s+policy|grant\s+(?:all|select|insert|update|delete|execute)\s+on/i);
});

test('potluck claims and messages cannot cross invitation boundaries', () => {
  assert.match(sql, /primary key \(invite_id,item_id\)/);
  assert.match(sql, /primary key \(invite_id,message_id\)/);
  assert.match(sql, /foreign key \(invite_id,claimed_by\)[\s\S]*?references public\.cnidaria_event_room_members\(invite_id,member_id\)/);
  assert.match(sql, /foreign key \(invite_id,author_id\)[\s\S]*?references public\.cnidaria_event_room_members\(invite_id,member_id\)/);
  assert.match(sql, /unique \(invite_id,session_subject\)/);
});

test('event rooms are invite-scoped and cascade on deletion without RSVP schema changes', () => {
  assert.match(sql, /invite_id uuid primary key references public\.cnidaria_invites\(id\) on delete cascade/);
  assert.doesNotMatch(sql, /alter table public\.cnidaria_(?:invites|invite_replies|beta_rsvp_receipts)/i);
  assert.match(sql, /revoked_at timestamptz/);
});
