# PostgreSQL atomic consumption: review-only transaction sketch

**Status: NOT deployed.** This is a security review artifact, not a migration or callable public RPC. Do not grant EXECUTE to `anon`, `authenticated`, or `PUBLIC`. The application must use a trusted, narrowly privileged backend after authenticating and rate-limiting a recipient, and verifying signed participation evidence outside the browser.

## Schema invariants (proposed)

- `challenge_id` is unique, random, and bound immutably to `invitation_id` and `recipient_id`.
- `attempts.challenge_id` has a **UNIQUE** constraint. It must not be possible to insert a second attempt even when two server instances race.
- `unlocks.challenge_id` has a **UNIQUE** constraint; its recipient and invitation must be derived from the locked challenge row, never from client input.
- A consumed challenge is immutable. Use database privileges/triggers to prevent resetting `consumed_at`, replacing a nonce digest, or changing ownership.
- `nonce_digest` is compared using a server-generated nonce and safe digest verification. Avoid logging credentials, nonce values, raw evidence, or identifying motion telemetry.

## Transaction pseudocode (not executable SQL)

```text
BEGIN;
  SELECT challenge FOR UPDATE WHERE id = trusted_challenge_id;
  IF missing, consumed, revoked, expired (database clock), wrong invitation,
     wrong recipient, nonce mismatch THEN ROLLBACK; deny;
  END IF;

  -- A verified submitted attempt, including a failed participation result,
  -- consumes the sole attempt budget.
  INSERT attempt(challenge_id, result, evidence_digest, server_verifier_version)
    VALUES (locked.id, trusted_verification_result, trusted_digest, version);
  UPDATE challenge SET consumed_at = database_clock WHERE id = locked.id;

  IF trusted_verification_result = 'passed' THEN
    INSERT unlock(challenge_id, invitation_id, recipient_id)
      VALUES (locked.id, locked.invitation_id, locked.recipient_id);
  END IF;
COMMIT;
```

Do not let client `passed`, `evidenceVerified`, `role`, or accessibility flags substitute for trusted verification. Never unlock after a transaction failure. For repeated requests, return a bounded already-consumed response; idempotency-key lookup must not disclose another recipient's outcome.

## Integration tests required before implementation is activated

1. Race 50 submissions across **two distinct database connections and two server processes**; exactly one attempt and no more than one unlock.
2. Run the same race with both matching and different idempotency keys; never issue a second attempt.
3. Force a transaction rollback after attempt insertion and before unlock; assert zero persisted attempts/unlocks, then verify a valid subsequent request can consume once.
4. Expire/revoke the challenge between preflight and row lock; the transaction rejects it.
5. Tamper recipient, invitation, nonce, signature, evidence method, expiry, and verifier version; no unlock.
6. Submit a failed valid attempt, then a successful one; the second is rejected.
7. Exercise phone toss and genuinely participatory accessible methods under identical server-side budgets.
8. Connect as `anon` and `authenticated` to verify direct table writes and privileged challenge RPC execution are denied.
9. Restart backend instances; retry an already consumed challenge; no replay or second unlock.
10. Simulate unavailable distributed rate limiter; fail closed rather than silently removing throttling.

## Rollout gate

Implement behind a disabled feature flag on a private branch, use an isolated test database, inspect grants/RLS, run concurrency and rollback tests in CI, obtain independent security review, and only then consider enabling a trusted backend endpoint. No token or CNT issuance is authorized by this document.
