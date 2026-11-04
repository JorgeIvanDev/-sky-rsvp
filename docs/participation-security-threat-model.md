# CNIDARIA participation and RSVP security gate (design only)

Status: **not deployed**. This document is a threat model and acceptance-test plan, not permission to enable public RPCs, mint CNT, or advertise rewards.

## Current trust boundaries
- Browser challenge animations, toss sensors, local storage, URL fragments and encoded invitation payloads are **untrusted**. They cannot prove a human completed a challenge or protect private invitation details.
- A shared invitation link is a bearer capability, not a unique person. A device ID, IP address, browser fingerprint or RSVP secret alone is not an identity.
- The existing `cnidaria_create_invite`, `cnidaria_reply`, and `cnidaria_get_replies` SECURITY DEFINER functions remain unavailable to `anon` and `authenticated`; see `docs/enable-rsvps.md`. Never grant public EXECUTE as a shortcut.
- Server secrets and privileged database credentials belong only in a reviewed server environment. Never put them in static HTML, client JS, URLs, logs or analytics.

## Proposed minimum-privilege flow
1. A server endpoint validates a short-lived invite identifier and expiry, then issues a random, single-use, expiring attempt nonce. Enforce per-invite and per-origin abuse budgets without treating an IP as a person.
2. The server records attempt start and finalization atomically. A retry with the same nonce must not create a second attempt or reward. A challenge failure still consumes the attempt under the product's one-attempt rule. Accessible alternative tasks must require meaningful participation, not a one-click bypass; document accessibility and safety before rollout.
3. A server-controlled unlock authorization gates **server-stored** private invitation details. Client-side UI guards remain helpful but are not security boundaries. Do not send private details in Base64, HTML, JavaScript bundles or pre-unlock API responses.
4. RSVP writes pass through an authenticated/authorized server service with input limits, invitation expiry checks, per-invite quotas, idempotency keys and audit events. Organizer reads require a separate organizer capability or verified identity. Return minimal data; never expose reply secrets.
5. Keep personal invitations and creator invitations logically separated. Public creator destinations must use an allowlisted `https:` URL policy with explicit confirmation when leaving CNIDARIA; reject `javascript:`, `data:`, credentials-in-URL and local/internal addresses where server fetching is involved.
6. Record only minimal aggregated creator metrics with a retention period and small-group suppression. Do not treat event attendance, click counts, or a self-reported RSVP as proof of unique participation.

## Abuse cases and required negative tests
| Attack | Expected invariant |
| --- | --- |
| Replay an attempt nonce concurrently | Exactly one terminal attempt; no duplicate unlock or points |
| Modify client JS, local storage or challenge result | No server unlock without valid server-side evidence |
| Guess or enumerate invite IDs | Bounded attempts, indistinguishable errors and no private data leak |
| Reuse a link across many devices/accounts | No claim of unique recipient or unlimited participation credit |
| Spam RSVP updates or change choices rapidly | Rate limit, idempotency and bounded writes |
| Access organizer results with recipient capability | Denied with no counts or private responses leaked |
| Call privileged Supabase RPC as anon/authenticated | Permission denied for all three functions |
| Expired, revoked or already-used nonce | Denied without reactivation |
| Malformed, oversized or malicious creator URL | Rejected without redirect or server-side fetch |
| Retry after a timeout | Deterministic idempotent result, no double credit |
| Race two award workers | One unique award ledger row, no negative or unbounded balance |
| Delete user data | Participation data and derived metrics follow documented deletion policy |

## Optional CNT research: off-chain points only
CNT is a possible **proof-of-participation metaphor**, not proof-of-work, a cryptocurrency, money, yield, or guaranteed income. Do not deploy tokens, transfers, wallets, trading, exchange integrations, or redemption promises.

If prototyped later, use a nontransferable server-side points ledger with: a versioned eligibility policy; per-event and per-recipient caps; server-side verification of eligible events; unique award keys; reversal/correction entries; fraud review; transparent expiry/retention; and an explicit zero-value disclaimer. Challenge attempts alone should not earn points. RSVP/attendance and community actions require anti-bot and anti-sybil validation before counting; do not infer one person from one browser.

**Go/no-go:** no rewards activation until replay resistance, sybil controls, rate limits, operational cost limits, fraud monitoring, privacy/deletion, and legal/regulatory review are documented and tested. An accessible participation path must be reviewed without creating an exploitable bypass.

## Rollout checklist
- Add isolated server implementation and automated negative tests on a review branch.
- Test database privilege denials with both public roles in a disposable environment.
- Test concurrent replay, expiration, cancellation, retry, abusive volume, and mobile accessibility.
- Verify no secrets in frontend, CI logs or test fixtures.
- Obtain explicit security review before changing any production permissions.
- Deploy behind a disabled-by-default flag; monitor and retain a rollback path.
