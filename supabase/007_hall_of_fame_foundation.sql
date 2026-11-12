-- Persistent, fail-closed Hall of Fame storage. Apply after 006.
-- Trusted server must authenticate players and enforce score eligibility.
-- No score is verified as a hand catch solely from device sensors.
create table if not exists public.cnidaria_players (
  player_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.cnidaria_challenge_groups (
  group_id uuid primary key default gen_random_uuid(),
  group_name text not null check (char_length(btrim(group_name)) between 1 and 90),
  owner_player_id uuid not null references public.cnidaria_players(player_id),
  created_at timestamptz not null default now()
);
create table if not exists public.cnidaria_group_members (
  group_id uuid not null references public.cnidaria_challenge_groups(group_id) on delete cascade,
  player_id uuid not null references public.cnidaria_players(player_id) on delete cascade,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (group_id, player_id)
);
create table if not exists public.cnidaria_toss_records (
  record_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.cnidaria_players(player_id) on delete cascade,
  height_cm numeric(9,2) not null check (height_cm > 0 and height_cm <= 100000),
  recorded_at timestamptz not null default now(),
  source text not null default 'device_sensor'
    check (source in ('device_sensor','manual_import')),
  -- An eligibility decision is not a claim of physical hand-catch verification.
  eligible_for_ranking boolean not null default false,
  eligibility_reason text,
  hand_catch_verified boolean not null default false,
  check (not hand_catch_verified),
  check (not eligible_for_ranking or
    (eligibility_reason is not null and char_length(btrim(eligibility_reason)) between 1 and 200))
);
create index if not exists cnidaria_toss_best_idx
  on public.cnidaria_toss_records(player_id,height_cm desc,recorded_at asc,record_id);
create index if not exists cnidaria_group_member_player_idx
  on public.cnidaria_group_members(player_id,group_id);

-- Exactly one eligible personal best per player, deterministically breaking ties.
-- A qualifying record may appear in the global and every joined group's board.
-- Server must check active membership and group visibility before returning rows.
create or replace view public.cnidaria_global_personal_bests
with (security_invoker = true) as
select distinct on (r.player_id)
  r.player_id, r.record_id, r.height_cm, r.recorded_at, r.hand_catch_verified
from public.cnidaria_toss_records r
where r.eligible_for_ranking = true
order by r.player_id, r.height_cm desc, r.recorded_at asc, r.record_id asc;

create or replace view public.cnidaria_group_personal_bests
with (security_invoker = true) as
select m.group_id, b.player_id, b.record_id, b.height_cm, b.recorded_at,
       b.hand_catch_verified
from public.cnidaria_group_members m
join public.cnidaria_global_personal_bests b on b.player_id = m.player_id
where m.revoked_at is null;

-- All direct browser access fails closed; views do not bypass underlying RLS.
alter table public.cnidaria_players enable row level security;
alter table public.cnidaria_players force row level security;
alter table public.cnidaria_challenge_groups enable row level security;
alter table public.cnidaria_challenge_groups force row level security;
alter table public.cnidaria_group_members enable row level security;
alter table public.cnidaria_group_members force row level security;
alter table public.cnidaria_toss_records enable row level security;
alter table public.cnidaria_toss_records force row level security;
revoke all on public.cnidaria_players from public, anon, authenticated;
revoke all on public.cnidaria_challenge_groups from public, anon, authenticated;
revoke all on public.cnidaria_group_members from public, anon, authenticated;
revoke all on public.cnidaria_toss_records from public, anon, authenticated;
revoke all on public.cnidaria_global_personal_bests from public, anon, authenticated;
revoke all on public.cnidaria_group_personal_bests from public, anon, authenticated;
-- Do not grant web roles access or expose raw group membership publicly.
-- Existing RSVP, invite and event-room schemas are intentionally unchanged.
