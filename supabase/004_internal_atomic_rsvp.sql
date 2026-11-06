-- Trusted-server-only atomic RSVP write. NOT a public Supabase RPC.
-- Apply after 001-003 in an isolated database; requires live integration review.
-- Caller must be a dedicated backend DB role with narrowly reviewed table access.
-- Do not expose this schema in PostgREST or grant EXECUTE to web roles.
create schema if not exists cnidaria_internal;
revoke all on schema cnidaria_internal from public, anon, authenticated;

create or replace function cnidaria_internal.submit_beta_rsvp(
  p_user_id uuid, p_invite_id uuid, p_recipient_id uuid,
  p_challenge_id uuid, p_idempotency_hash text, p_choice text
) returns table (receipt_id uuid, saved_choice text, saved_at timestamptz)
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  v_recipient public.cnidaria_beta_recipients%rowtype;
  v_challenge public.cnidaria_beta_challenges%rowtype;
  v_receipt public.cnidaria_beta_rsvp_receipts%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_invite_id is null or p_recipient_id is null
     or p_challenge_id is null or p_idempotency_hash !~ '^[a-f0-9]{64}$'
     or p_choice not in ('yes','maybe','no') then
    raise exception 'RSVP unavailable' using errcode = 'P0001';
  end if;

  -- Serialize all attempts for this recipient, including competing keys.
  select * into v_recipient from public.cnidaria_beta_recipients
    where id = p_recipient_id and invite_id = p_invite_id
      and user_id = p_user_id and revoked_at is null
    for update;
  if not found then
    raise exception 'RSVP unavailable' using errcode = 'P0001';
  end if;

  -- A retry may return the original receipt, but cannot change its choice.
  select * into v_receipt from public.cnidaria_beta_rsvp_receipts
    where invite_id = p_invite_id and recipient_id = p_recipient_id;
  if found then
    if v_receipt.idempotency_hash = p_idempotency_hash
       and v_receipt.challenge_id = p_challenge_id
       and v_receipt.choice = p_choice then
      return query select v_receipt.id, v_receipt.choice, v_receipt.submitted_at;
      return;
    end if;
    raise exception 'RSVP already recorded' using errcode = 'P0001';
  end if;

  select * into v_challenge from public.cnidaria_beta_challenges
    where id = p_challenge_id and recipient_id = p_recipient_id
      and invite_id = p_invite_id for update;
  if not found or v_challenge.revoked_at is not null
     or v_challenge.consumed_at is not null
     or v_challenge.verified_at is null
     or v_challenge.verified_at > v_now
     or v_challenge.expires_at <= v_now then
    raise exception 'RSVP unavailable' using errcode = 'P0001';
  end if;

  update public.cnidaria_beta_challenges
    set consumed_at = v_now where id = p_challenge_id;
  insert into public.cnidaria_beta_rsvp_receipts
    (invite_id, recipient_id, challenge_id, idempotency_hash, choice, submitted_at)
    values (p_invite_id, p_recipient_id, p_challenge_id,
            p_idempotency_hash, p_choice, v_now)
    returning * into v_receipt;
  return query select v_receipt.id, v_receipt.choice, v_receipt.submitted_at;
end;
$$;
-- PostgreSQL grants EXECUTE to PUBLIC on new functions by default.
revoke all on function cnidaria_internal.submit_beta_rsvp(uuid,uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
-- No EXECUTE grant here. Provision only a dedicated trusted backend role
-- after verifying its identity binding, rate limits and live DB tests.
