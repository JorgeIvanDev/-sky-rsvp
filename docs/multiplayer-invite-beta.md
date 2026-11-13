# CNIDARIA multiplayer invite beta — November 2026
Implemented database RPCs: cnt_create_meeting, cnt_join_meeting, cnt_respond_meeting, cnt_checkin_meeting. Functions require auth.uid(), scope actions to participants, reject expired meetings, and enforce unique meeting membership. Invite tokens are random UUIDs stored server-side and supplied as URL bearer tokens. Treat links as secrets. The check-in action is explicitly self-reported and MUST NOT be treated as verified proximity or proof for financial rewards.

Frontend multiplayer-beta.html uses email OTP and Supabase publishable key to call RPCs, polls meeting statuses every 12 seconds, and shows shareable invitation links. This is polling, not WebSocket Realtime. Auth token refresh, rate limiting, user testing, real proximity, actual toss proof verification, CNT issuance, and BSV signature verification remain pending. Do not turn on monetary settlement.

Security: all tables RLS-enabled; public function execution revoked from anon/PUBLIC, explicitly granted to authenticated. Further adversarial two-user testing required before production.
