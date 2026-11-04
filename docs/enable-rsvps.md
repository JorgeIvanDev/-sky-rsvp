# CNIDARIA RSVP rollout status

## Verified in Supabase
- `public.cnidaria_invites` and `public.cnidaria_invite_replies` exist and have RLS enabled.
- `cnidaria_create_invite`, `cnidaria_reply`, and `cnidaria_get_replies` exist.
- On 2026-11-03, EXECUTE was revoked from both `anon` and `authenticated` on all three functions. A follow-up permission query confirmed **false** for all six role/function checks.
- This is an intentional safety lockdown: do not re-enable these RPCs without tested authorization, anti-abuse controls and a documented rollout.

## What is not live yet
- The invitation web page is **not connected** to the RSVP database.
- Automatic RSVP recording and organizer counts have not been end-to-end tested.
- Link holders are not verified individuals; no CNT awards should be based on RSVP counts.
- Do not expose a Supabase secret/service-role key or wallet private key in browser code.

## Next work
1. Review privileged-function permissions and threat model.
2. Design a server-side abuse-control layer before enabling writes.
3. Wire recipient RSVP and organizer counts into the invitation UI.
4. Run functional, negative-permission, abuse and mobile tests before rollout.

## Guides
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api

## Previous setup
The migration in [supabase/001_invitation_rsvps.sql](../supabase/001_invitation_rsvps.sql) has already been run manually. Both tables were confirmed in Table Editor. Do not rerun it or regrant public function execution as part of setup.
