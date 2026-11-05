# CNIDARIA RSVP and participation security design (proposal only)

**Status:** design/threat model; not deployed or an authorization to enable public RPCs, rewards, or payments.

## Current safety boundary
- The RSVP SQL prototype revokes public execution of privileged `cnidaria_*` functions and direct access to RSVP tables. Keep it that way until a reviewed server API exists.
- `challenge-policy.mjs` is an in-memory policy evaluator, not an identity, motion, attendance, or bot verifier. A client-provided `evidenceVerified: true` is **never** trustworthy.
- A single attempt per issued challenge is required for personal and creator invitations. Accessibility modes must involve genuine participation and must not bypass the attempt ledger.

## Proposed server-controlled state machine
1. **Issue:** Authenticate/authorize the invitation recipient; bind an unpredictable nonce to invitation ID, recipient identity, challenge mode, issued/expiry timestamps, and a server-side challenge ID. Persist only a digest of the nonce where feasible. Rate-limit issuance by authenticated identity, invitation, network/device signals (privacy-preserving), and creator.
2. **Begin:** In a database transaction, lock the challenge row; reject expired, wrong-recipient, already-started, or consumed records; atomically transition `issued -> attempted` and increment attempts from 0 to 1 **before** evaluating evidence. Duplicate or concurrent begin requests fail closed. Never reset the counter on a failed attempt or a client reconnect.
3. **Verify:** Accept only bounded, fresh, challenge-bound evidence verified by trusted server logic. Browser accelerometer signals alone cannot prove a genuine throw or a human. Offer an accessible participation mode with its own server-verifiable interaction, same recipient binding, one-attempt budget, and abuse protections. Do not force unsafe physical tossing.
4. **Consume:** Atomically transition `attempted -> passed` or `attempted -> failed`; bind the resulting short-lived unlock to the same recipient and invitation. A passed challenge grants only the scoped invitation reveal, not privileged RSVP RPC access.
5. **RSVP:** Use a separate authenticated, rate-limited server endpoint, scoped authorization, input validation, audit trails without sensitive payloads, and idempotency keys. Keep privileged database functions inaccessible to anonymous/authenticated direct RPC calls.

## Threats and required verification
| Threat | Control | Regression / integration test |
| --- | --- | --- |
| Concurrent double submission | Transactional row lock or compare-and-swap, unique challenge identity | Two parallel begins: exactly one succeeds; one attempt recorded |
| Replay after success/failure | Terminal state and nonce binding | Reused nonce or unlock fails; failed attempt cannot restart |
| Cross-recipient or cross-invitation reuse | Bind challenge, evidence, unlock and RSVP scope | Swapped recipient/invite IDs rejected |
| Bot and sybil farming | Identity-aware issuance quotas, graduated friction, abuse monitoring | Burst across IP/recipient/invite throttled; distributed limits persist across instances |
| Forged motion, clock, or attendance | Trusted verifier, server timestamps, bounded evidence | Client `evidenceVerified`, timestamps, or self-reported attendance never suffice |
| Accessible-mode bypass | Equal one-attempt ledger and verifiable participation | Mode switching cannot reset attempts; legitimate accessible path works |
| Data leakage and enumeration | Generic public errors, short retention, least privilege | No recipient details in URLs/logs; unauthorized lookups reveal nothing |
| Privilege escalation | Explicit RPC revocations, RLS, least-privilege server credentials | Database integration verifies grants for public/anon/authenticated |
| Broken CI | Required job visibility, tests executed on actual commit | Workflow runs and logs inspected; failure blocks promotion |

## Optional CNT participation points: research-only
“Mining” is a metaphor for meaningful community participation, **not** proof-of-work, income, or a promised token. Prototype only with off-chain, nontransferable, noncash points, if at all.

- Candidate eligible events: one unique recipient's verified challenge attempt; a verified RSVP; creator event attendance or a meaningful interaction. Each must be explicitly defined and independently verifiable. Do not reward repeated refreshes, retries, self-referrals, or client-reported attendance.
- Bound rewards by recipient, invitation, creator, event, and time period; cap total issuance, add creator-specific quotas and anomaly review. A single action must have a stable idempotency key and immutable audit reference; corrections should be reversible ledger entries.
- Threats: bots, sybil identities, colluding creators/recipients, replayed evidence, fraudulent attendance, privacy-invasive analytics, and incentive-driven unsafe phone tossing.
- Tests before any reward prototype: parallel double-credit, duplicate event delivery, forged attendance, creator collusion simulations, quota exhaustion, reversal, retention/deletion, and privacy-safe aggregate reporting.
- **No** token issuance, wallets, transfers, exchange listings, redeemability, monetary representations, or reward promises without verified controls, economic modeling and legal/regulatory review.

## Release gates
Do not expose the challenge unlock or RSVP mutation publicly until transaction/concurrency integration tests, abuse-limit tests, real CI results, authorization review, and privacy review pass. Preserve the existing reveal UI and two-panel illustrations; this document changes no production behavior.
