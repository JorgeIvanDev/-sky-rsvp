-- Private-beta host ownership binding and inbox read, server-only.
-- Apply after 001-004; do not expose cnidaria_internal through PostgREST.
-- Host bindings MUST be provisioned only by a trusted organizer-authenticated
-- server operation, never from an invite link or client-supplied host id.
create table if not exists public.cnidaria_beta_hosts (
  invite_id uuid primary key references public.cnidaria_invites(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists cnidaria_beta_hosts_user_idx
  on public.cnidaria_beta_hosts(host_user_id);
alter table public.cnidaria_beta_hosts enable row level security;
alter table public.cnidaria_beta_hosts force row level security;
revoke all on public.cnidaria_beta_hosts from public, anon, authenticated;

-- The ownership predicate is part of the SAME statement that reads receipts.
-- The caller supplies p_host_user_id only from cryptographically verified auth.
-- This SECURITY INVOKER function needs a dedicated, least-privilege backend
-- database role with explicitly reviewed table SELECT grants (not web roles).
create or replace function cnidaria_internal.read_beta_host_inbox(
  p_host_user_id uuid, p_invite_id uuid, p_limit integer
) returns table(receipt_id uuid, choice text, saved_at timestamptz)
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_host_user_id is null or p_invite_id is null or
     p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'Inbox unavailable' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.cnidaria_beta_hosts h
    join public.cnidaria_invites i on i.id = h.invite_id
    where h.invite_id = p_invite_id and h.host_user_id = p_host_user_id
  ) then
    raise exception 'Inbox unavailable' using errcode = 'P0001';
  end if;
  return query
    select r.id, r.choice, r.submitted_at
    from public.cnidaria_beta_rsvp_receipts r
    join public.cnidaria_beta_hosts h on h.invite_id = r.invite_id
    where r.invite_id = p_invite_id and h.host_user_id = p_host_user_id
    order by r.submitted_at desc, r.id desc
    limit p_limit;
end;
$$;
revoke all on function cnidaria_internal.read_beta_host_inbox(uuid,uuid,integer)
  from public, anon, authenticated;
-- No grants to web roles and no automatic trusted-role grants.
