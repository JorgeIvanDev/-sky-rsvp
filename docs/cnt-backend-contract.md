# CNT backend contracts — iteration 3

The Supabase project has four RLS-enabled tables: `cnt_wallet_links`, `cnt_activity_proofs`, `cnt_reward_entries`, `cnt_meeting_checkins`.

Authenticated users have **SELECT-only** access to their own records. No client write grants or policies exist. Trusted service-side verification must populate records. A `verified_at` wallet field is reserved for a future cryptographic signature challenge; inserting an address is **not** wallet verification.

## Trusted ingestion design

1. Receive an authenticated toss/challenge/event/meeting event from a trusted service, not a browser button.
2. Check actor identity, event type, timestamp, motion/meeting attestations, and whether the event was already awarded.
3. In one server-side database transaction, mark proof verified and create a unique reward entry. Check daily limits and global supply under lock to prevent race conditions.
4. Only then expose a new balance. Never accept client-submitted `amount` or `verification_state`.

The standalone `meeting-checkin.html` interface is **simulation only**. It deliberately uses checkboxes instead of pretending GPS or Bluetooth are verified. Production check-in needs a real authenticated session, opt-in location, proximity protocol, abuse prevention, consent, privacy retention, dispute handling, and contract review before any BSV escrow.

## Security verification
New CNT tables have RLS enabled and user-scoped read policies. No authenticated/anon INSERT/UPDATE/DELETE grants. Existing non-CNT advisor findings were left untouched.
