-- CNIDARIA invitation RSVP prototype, Supabase PostgreSQL.
-- Baseline schema. Fail closed: no public RPC grants until a reviewed, abuse-protected API exists.
-- SECURITY: public response links are bearer capabilities, NOT verified identities.
create extension if not exists pgcrypto;
create table if not exists public.cnidaria_invites (
 id uuid primary key default gen_random_uuid(),
 owner_secret_hash text not null,
 title text not null check (char_length(title) between 1 and 90),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '30 days'),
 constraint expires_soon check (expires_at<=created_at+interval '90 days')
);
create table if not exists public.cnidaria_invite_replies (
 id uuid primary key default gen_random_uuid(),
 invite_id uuid not null references public.cnidaria_invites(id) on delete cascade,
 reply_secret_hash text not null,
 choice text not null check (choice in ('yes','maybe','no')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(invite_id,reply_secret_hash)
);
alter table public.cnidaria_invites enable row level security;
alter table public.cnidaria_invite_replies enable row level security;
revoke all on public.cnidaria_invites from anon,authenticated;
revoke all on public.cnidaria_invite_replies from anon,authenticated;
-- Database functions are the only API; avoid exposing raw tables.
create or replace function public.cnidaria_create_invite(p_title text,p_owner_secret text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if char_length(coalesce(p_title,'')) not between 1 and 90 or
    p_owner_secret !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invite'; end if;
 insert into public.cnidaria_invites(title,owner_secret_hash)
 values (p_title,encode(extensions.digest(p_owner_secret,'sha256'),'hex'))
 returning id into v_id;
 return v_id;
end $$;
create or replace function public.cnidaria_reply(p_invite_id uuid,p_reply_secret text,p_choice text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_reply_secret !~ '^[a-f0-9]{64}$' or p_choice not in ('yes','maybe','no') then
 raise exception 'Invalid response'; end if;
 if not exists(select 1 from public.cnidaria_invites where id=p_invite_id and expires_at>now()) then
 raise exception 'Invitation expired or missing'; end if;
 insert into public.cnidaria_invite_replies(invite_id,reply_secret_hash,choice)
 values(p_invite_id,encode(extensions.digest(p_reply_secret,'sha256'),'hex'),p_choice)
 on conflict(invite_id,reply_secret_hash) do update set choice=excluded.choice,updated_at=now();
end $$;
create or replace function public.cnidaria_get_replies(p_invite_id uuid,p_owner_secret text)
returns table(choice text,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.cnidaria_invites i where i.id=p_invite_id
 and i.owner_secret_hash=encode(extensions.digest(p_owner_secret,'sha256'),'hex')) then
 raise exception 'Invalid organizer access'; end if;
 return query select r.choice,r.created_at,r.updated_at from public.cnidaria_invite_replies r
 where r.invite_id=p_invite_id order by r.created_at desc limit 500;
end $$;
revoke all on function public.cnidaria_create_invite(text,text) from public;
revoke all on function public.cnidaria_reply(uuid,text,text) from public;
revoke all on function public.cnidaria_get_replies(uuid,text) from public;
-- Intentionally DO NOT grant EXECUTE to anon or authenticated.
-- This revocation also closes earlier deployments that used permissive grants.
revoke execute on function public.cnidaria_create_invite(text,text) from anon,authenticated;
revoke execute on function public.cnidaria_reply(uuid,text,text) from anon,authenticated;
revoke execute on function public.cnidaria_get_replies(uuid,text) from anon,authenticated;
-- Before production: add server-side rate limiting / CAPTCHA, abuse monitoring,
-- retention/deletion policy, and avoid revealing private meetup data in URL.
