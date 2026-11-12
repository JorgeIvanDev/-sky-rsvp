-- CNIDARIA event-room storage foundation. Apply after 005.
-- Deliberately server-only until invitation bearer tokens are exchanged for
-- scoped, revocable guest sessions by a trusted backend.
-- Never treat an inviteId alone as authorization to read a room.
create table if not exists public.cnidaria_event_rooms (
  invite_id uuid primary key references public.cnidaria_invites(id) on delete cascade,
  room_title text not null default 'Event room'
    check (char_length(btrim(room_title)) between 1 and 90),
  created_at timestamptz not null default now()
);
create table if not exists public.cnidaria_event_room_members (
  invite_id uuid not null references public.cnidaria_event_rooms(invite_id) on delete cascade,
  member_id uuid not null default gen_random_uuid(),
  -- Only a trusted backend may bind this to a verified session.
  session_subject text not null check (char_length(session_subject) between 16 and 200),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  revoked_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (invite_id,member_id),
  unique (invite_id,session_subject)
);
create table if not exists public.cnidaria_event_potluck_items (
  invite_id uuid not null references public.cnidaria_event_rooms(invite_id) on delete cascade,
  item_id uuid not null default gen_random_uuid(),
  item_name text not null check (char_length(btrim(item_name)) between 1 and 120),
  claimed_by uuid,
  created_at timestamptz not null default now(),
  primary key (invite_id,item_id),
  foreign key (invite_id,claimed_by)
    references public.cnidaria_event_room_members(invite_id,member_id)
);
create table if not exists public.cnidaria_event_messages (
  invite_id uuid not null references public.cnidaria_event_rooms(invite_id) on delete cascade,
  message_id uuid not null default gen_random_uuid(),
  author_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  primary key (invite_id,message_id),
  foreign key (invite_id,author_id)
    references public.cnidaria_event_room_members(invite_id,member_id)
);
create index if not exists cnidaria_event_messages_room_time_idx
  on public.cnidaria_event_messages(invite_id,created_at desc,message_id desc);
create index if not exists cnidaria_event_potluck_room_claim_idx
  on public.cnidaria_event_potluck_items(invite_id,claimed_by);
-- All four tables fail closed for direct browser/API access.
alter table public.cnidaria_event_rooms enable row level security;
alter table public.cnidaria_event_rooms force row level security;
alter table public.cnidaria_event_room_members enable row level security;
alter table public.cnidaria_event_room_members force row level security;
alter table public.cnidaria_event_potluck_items enable row level security;
alter table public.cnidaria_event_potluck_items force row level security;
alter table public.cnidaria_event_messages enable row level security;
alter table public.cnidaria_event_messages force row level security;
revoke all on public.cnidaria_event_rooms from public, anon, authenticated;
revoke all on public.cnidaria_event_room_members from public, anon, authenticated;
revoke all on public.cnidaria_event_potluck_items from public, anon, authenticated;
revoke all on public.cnidaria_event_messages from public, anon, authenticated;
-- No public RPCs, permissive policies, or seeded guests.
-- Trusted backend must verify session_subject, invite membership and revoked_at
-- on every read/write; claim/unclaim must be atomic and ownership-checked.
-- Preserve existing invite links: this migration does not alter RSVP tables.
