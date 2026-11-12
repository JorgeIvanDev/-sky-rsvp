-- Server-only event chat append, with room membership and message bounds.
-- Apply after 006. The trusted backend authenticates the guest session and
-- resolves p_actor_member_id; never accept it from untrusted client input.
-- Deliberately no EXECUTE grant to anon or authenticated.
create or replace function public.cnidaria_event_chat_post(
  p_invite_id uuid,
  p_actor_member_id uuid,
  p_body text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message_id uuid;
begin
  if p_invite_id is null or p_actor_member_id is null
     or p_body is null
     or char_length(btrim(p_body)) not between 1 and 2000 then
    return null;
  end if;

  -- Reject revoked, missing, and cross-room authors before writing.
  if not exists (
    select 1 from public.cnidaria_event_room_members m
    where m.invite_id = p_invite_id
      and m.member_id = p_actor_member_id
      and m.revoked_at is null
  ) then
    return null;
  end if;

  insert into public.cnidaria_event_messages(invite_id, author_id, body)
  values (p_invite_id, p_actor_member_id, btrim(p_body))
  returning message_id into v_message_id;
  return v_message_id;
end;
$$;
revoke all on function public.cnidaria_event_chat_post(uuid,uuid,text)
  from public, anon, authenticated;
-- Reads must independently enforce room membership and revocation.
-- Server should also apply request rate limits and audit abuse.
-- No changes to existing invitations, RSVPs, or host dashboards.
