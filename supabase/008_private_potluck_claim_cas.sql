-- Server-only, compare-and-swap potluck assignment. Apply after 006.
-- A trusted API MUST authenticate the caller, resolve their member_id from a
-- scoped session, and never accept actor_member_id directly from the browser.
-- No EXECUTE privilege is granted to anon/authenticated.
create or replace function public.cnidaria_potluck_claim_cas(
  p_invite_id uuid,
  p_item_id uuid,
  p_actor_member_id uuid,
  p_expected_claimed_by uuid,
  p_new_claimed_by uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_changed integer;
begin
  -- Only self-claim or unclaim is allowed; no stealing another guest's item.
  if p_new_claimed_by is distinct from p_actor_member_id
     and p_new_claimed_by is not null then
    return false;
  end if;
  -- Caller must be an active member of exactly this room.
  if not exists (
    select 1 from public.cnidaria_event_room_members m
    where m.invite_id = p_invite_id
      and m.member_id = p_actor_member_id
      and m.revoked_at is null
  ) then
    return false;
  end if;
  -- A guest can unclaim only their own item, never someone else's.
  if p_new_claimed_by is null
     and p_expected_claimed_by is distinct from p_actor_member_id then
    return false;
  end if;
  -- Claims require an unclaimed item. Unclaims require current ownership.
  if p_new_claimed_by is not null and p_expected_claimed_by is not null then
    return false;
  end if;
  update public.cnidaria_event_potluck_items i
     set claimed_by = p_new_claimed_by
   where i.invite_id = p_invite_id
     and i.item_id = p_item_id
     and i.claimed_by is not distinct from p_expected_claimed_by;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end;
$$;
revoke all on function public.cnidaria_potluck_claim_cas(uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
-- No new grants. Trusted server role needs explicit schema/table/function
-- privileges as appropriate. Existing RSVP and invitation links untouched.
