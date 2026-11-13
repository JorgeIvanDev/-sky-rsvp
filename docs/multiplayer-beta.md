# CNIDARIA multiplayer backend beta

Implemented in Supabase (project `hwkxuczipnaqzhbnaurw`):
- `cnt_shared_meetings`: authenticated owner can create and read own meetings; deadlines limited to 30 days.
- `cnt_meeting_members`: authenticated users can read their own membership only. Writes are server-only.
- `cnt_meeting_invite_tokens`: invitation token hashes are not accessible to browser roles.
- `cnt_activity_proofs`, `cnt_reward_entries`, `cnt_meeting_checkins`, `cnt_wallet_links`: existing protected read-only user data.

`multiplayer-beta.html` exercises email OTP sign-in and owner meeting creation through the public Supabase REST API, using a **publishable** key, never a secret/service key. It does not yet support invitations, accepting, check-in verification, or real CNT minting. Email OTP behavior depends on project Auth configuration. Session access token is held in tab-scoped sessionStorage; this beta does not yet implement refresh token rotation, so expired sessions require signing in again.

Future work:
1. Server-side invitation redemption and membership, with hashed high-entropy one-time invite tokens.
2. Server-authorized accept/decline and checked-in transitions, idempotent and scoped to meeting membership.
3. Realtime subscriptions and robust session refresh.
4. Verified toss events and transactional reward ledger. Wallet challenge-signature verification.
5. End-to-end two-account testing, rate limiting, abuse controls, privacy retention.

Do not advertise this beta as complete cross-device multiplayer until steps 1–3 are implemented and tested.
