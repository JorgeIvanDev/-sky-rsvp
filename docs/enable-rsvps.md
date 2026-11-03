# Enable CNIDARIA RSVPs (manual Supabase step)

The existing invitation site continues to work without this setup. The RSVP database feature is **not yet connected to the live page**.

1. Open your existing Supabase project at https://supabase.com/dashboard.
2. Open **SQL Editor** and create a new query.
3. Open [supabase/001_invitation_rsvps.sql](../supabase/001_invitation_rsvps.sql), copy the entire file, and paste it into the SQL Editor.
4. Review the SQL. Click **Run**. It creates two tables and three public RPC functions with restricted table access.
5. Verify both tables appear in **Table Editor**: `cnidaria_invites` and `cnidaria_invite_replies`.
6. Do not paste a service-role key, database password, or private wallet key into GitHub or the website.

**Not ready for public activation:** The SQL has not been executed or integration-tested against your Supabase project. Public RPCs still require server-side abuse prevention/rate limiting. Responses represent link holders, not verified individuals. No CNT awards should be based on these responses alone.

The future flow is: share invite link → recipient taps RSVP → database records it → organizer sees aggregate counts. Wallet setup comes later, only at verified token claim.
