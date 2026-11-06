# Event bring-list / potluck signup — approved feature

## Purpose
Help people gather, not build a marketplace. An event organizer can enable a shared "What to bring" list alongside optional private event chat. Thanksgiving is a primary example; also supports BBQs, parties, tailgates and family events.

## Interaction
- Host creates needed items with title, category, optional target quantity/unit and notes (e.g., "Drinks — 24 cans").
- Verified accepted RSVP guests may opt in and claim an item or add an item they will bring; show display name and quantities to event participants only.
- Each item shows requested quantity, committed quantity, remaining quantity, and participant claims. Multiple guests can contribute toward the same item; no duplicate all-or-nothing locking.
- Guests can edit or withdraw only their own claims. Host may moderate/edit requests and resolve conflicts.
- Display "Still needed", "Covered", and "Overcommitted" based on quantities. Never promise real-world delivery based on a claim.
- Keep a pinned "What to bring" tab/card next to event chat, not buried in messages. Notify opt-in participants of relevant changes, with rate limiting.
- No payment, purchasing, location tracking or contact-list access needed.

## Secure implementation
- Reuse server-verified invitation membership and authorization from docs/event-group-chat-security.md. RSVP accepted alone must not silently publish identity; guest explicitly opts into participant-visible list.
- Tables (proposal): event_supply_items(id, invite_id, title, category, quantity_needed, unit, created_by, updated_at); event_supply_claims(id, item_id, participant_user_id, quantity_committed, note, updated_at).
- Restrict SELECT to authorized participants and host; INSERT/UPDATE/DELETE via server-enforced ownership and RSVP checks. Never trust user_id/host flags/accepted status from browser.
- Transactions prevent conflicting updates and negative or absurd quantities. Bound item count, input lengths and rate of edits. Render text safely.
- When RSVP is withdrawn or membership revoked, revoke edit/read privileges immediately; define whether historical claims are removed or marked unassigned.
- Protect minors and participant privacy; never show phone/email addresses.

## Acceptance tests
1. Accepted opt-in guest can view and claim items for their own event.
2. Declined, uninvited, and cross-event users cannot read or change claims.
3. Two guests can contribute partial quantities without overwriting one another.
4. Guest cannot edit another guest's claim, but can retract their own.
5. Host can manage requested items only for owned events.
6. Withdrawal/removal revokes list access and resolves commitments safely.
7. Rapid duplicate requests, forged IDs, HTML, and huge quantities fail safely.
8. List remains usable without enabling group chat; it is an optional event module.

## Build order
After secure RSVP/host inbox, implement event membership authorization, then optional event chat and bring-list. Favor a shared authorization foundation; do not enable insecure public Supabase RPCs. This document is a product specification, not a live feature.
