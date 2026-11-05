# Atomic one-attempt challenge consumption (design only)

Status: **not implemented or enabled**. This document defines the next server-side security milestone; it does not authorize public RPCs or assert production readiness.

## Trust boundaries and invariants

- Browser motion signals, accessibility actions, and client-side `evidenceVerified` are **untrusted claims**. The server must independently verify evidence and bind it to an authenticated or securely invitation-bound recipient.
- A challenge belongs to exactly one invitation, recipient, and server-generated unpredictable nonce. Store only a cryptographic digest of the nonce where practical. Never log raw tokens.
- Each challenge permits **at most one submitted attempt**, whether successful or unsuccessful. A retry of the same request must not create a second attempt. A concurrent request must not win twice.
- Expiry, cancellation, recipient/invitation mismatch, malformed evidence, and exhausted attempts fail closed. The invitation reveal remains locked unless verified participation succeeds.
- An accessible alternative must involve meaningful user participation with equivalent one-attempt accounting; merely selecting an accessibility checkbox must not unlock the reveal.
- Privileged database routines remain inaccessible to anonymous/public roles. No client-provided role or result flag may grant authority.

## Proposed transactional operation

Use a trusted server endpoint with narrowly scoped database credentials. Before a transaction, authenticate the recipient or validate a recipient-bound capability, apply distributed rate limits per recipient/invitation/device-risk bucket, validate schema and evidence provenance, and check replay-resistant signed evidence (including invitation, challenge, method, nonce, expiry, and verifier version).

Within **one database transaction**:
1. Lock the exact challenge row (`SELECT ... FOR UPDATE`) or use a conditional `UPDATE ... WHERE consumed_at IS NULL AND attempt_count = 0 ... RETURNING`.
2. Recheck server time, recipient/invitation binding, cancellation, nonce digest, expiry, and attempt budget **inside** the transaction.
3. Persist consumption and the one attempt even for a validly submitted failed challenge; store a bounded result and a stable idempotency key. Make the unique constraint on challenge ID/attempt number enforce at-most-once independently of application code.
4. For verified successful participation only, persist a server-authorized unlock in the same transaction; otherwise keep it locked.
5. Commit before returning a minimal result. On conflict, return already-consumed/locked without retrying a new attempt.

Keep errors generic to callers; retain bounded, privacy-conscious security telemetry. Decide whether invalid unauthenticated traffic consumes attempts only after abuse modeling; it must never unlock.

## Verification gates before any public activation

- Two simultaneous submissions against the same challenge: exactly one attempt row, at most one unlock.
- Two distinct idempotency keys and repeated identical key: neither can consume twice; repeat returns the original bounded result.
- Expired/revoked nonce, wrong recipient/invitation, tampered evidence, forged verifier signature, replayed evidence, missing fields, and unexpected database rollback all fail closed.
- Concurrent attempts across multiple server instances and process restarts behave identically.
- Test the accessibility route and phone-toss route against the same budget and binding rules.
- Verify row-level security and database grants against anonymous/authenticated/public roles; specifically ensure privileged RSVP RPCs remain revoked.
- Load-test distributed throttling, audit retention limits, and denial-of-service behavior. Require independent security review and passing integration CI before release.

## Optional CNT research boundary

CNT is a **nontransferable, off-chain participation-point hypothesis only**. Do not issue tokens, integrate wallets, promise income, or enable exchange or payment flows. Model duplicate identities, invitation farming, automated challenge completion, RSVP/attendance fraud, collusion, replay, chargeable operational cost, privacy, and regulatory classification. Any eventual points prototype requires bounded per-recipient/per-event issuance, revocation and audit controls, abuse monitoring, cost caps, and legal review. No reward may be inferred from a client-side event alone.
