# In-app RSVP submission and organizer inbox — security gate

Status: **design / test gate only**. No production endpoint, public Supabase RPC, recipient identity verification, or inbox is enabled by this document.

## Immediate product requirement
The recipient taps **I'm in / Maybe / Can't make it** inside the invitation; the response is submitted in-app and appears in the organizer's private inbox without copying, sharing, or manually sending text. The UI must never say “sent” until the server confirms a durable write. The existing challenge reveal and two-panel illustrations stay unchanged.

## Trust boundaries and threat model
- **Public invitation URL is not organizer authority.** Treat invite URLs and recipient reply capabilities as bearer secrets. Use high-entropy opaque recipient-specific tokens; hash at rest; never put organizer secrets or private RSVP lists into URLs, analytics, browser logs, or client bundles.
- **Recipient binding:** validate an invitation-scoped recipient capability or authenticated recipient on the trusted server. A recipient may only submit/update their own RSVP. Do not trust a client-supplied `recipientId`, `ownerId`, `challengePassed`, or role.
- **Challenge gate:** require a server-recorded one-attempt challenge unlock bound to the same invitation and recipient before accepting RSVP. The 5-foot beginner toss is a UI difficulty setting, not evidence of successful participation. Accessibility participation uses the same one-attempt accounting.
- **Organizer inbox:** require independent organizer authentication or verified organizer capability and check invite ownership server-side on every read. Never expose raw recipient secrets, private attendance data, or an unbounded list to anonymous clients. Paginate, minimize fields, and enforce retention/deletion.
- **Abuse:** distributed per-capability, per-invite, and risk-adjusted IP rate limits before database writes; body-size limits; CAPTCHA/risk challenge as needed; generic error responses; bounded telemetry without raw secrets. Defend against invitation enumeration, spam, forged submissions, token replay, leaked links, and organizer scraping.
- **Replay and idempotency:** require an opaque idempotency key bound to recipient/invite/action; use database uniqueness and a transaction to return the same durable outcome on retries. Different keys must not create multiple recipient rows. A deliberate changed RSVP must be an authorized update, not a second recipient.
- **CSRF / browser protections:** same-site cookies when applicable, Origin verification, CSRF tokens for cookie-authenticated writes, strict CORS, no credentialed wildcard origins, and no secrets in GET mutation routes.
- **No unsafe RPC:** `cnidaria_create_invite`, `cnidaria_reply`, and `cnidaria_get_replies` remain revoked from PUBLIC, anon and authenticated. Only a reviewed server-side route may use privileged credentials, never a client bundle.

## Minimum vertical-slice API contract (not implemented)
1. `POST /api/invitations/:id/rsvp`: server verifies recipient capability, challenge unlock, rate limits, allowed choice, idempotency; transactionally upserts one reply for that recipient; returns only `{status:'saved', choice, updatedAt}` after commit. No recipient enumeration.
2. `GET /api/organizer/invitations/:id/replies?cursor=...`: independently verify organizer and invite ownership; return a bounded page and aggregate counts, no secrets; cursor is tamper-resistant and scoped to the invite.
3. Client displays `Sending…` until server success, then `Response sent`; network failure offers a safe retry with the same idempotency key. Never fall back to clipboard/share as the primary flow.

## Tests required before enabling
- Unauthenticated, wrong recipient, wrong invite, expired/revoked capability, unconsumed/failed challenge all denied.
- Fifty concurrent identical and distinct-key RSVP submissions result in one recipient row and consistent idempotent replies.
- Changing a choice updates only that recipient, with server time and no cross-recipient overwrite.
- Unauthorized organizer inbox reads denied, even with a valid public invite link; pagination cannot cross invitations.
- Distributed rate-limit exhaustion and malformed/oversized requests fail closed; no raw secrets in errors/logs.
- Verify SQL grants and RLS **against a live isolated database**, not static text alone; confirm no PUBLIC/anon/authenticated EXECUTE on privileged functions.
- Validate 5-foot starting target and accessible alternative UX without bypassing server-verified challenge participation.

Release is blocked until trusted-server identity/capability issuance, server-side challenge verification, rate limiting, transactional persistence, and isolated integration tests are implemented and reviewed.
