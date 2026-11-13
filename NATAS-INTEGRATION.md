# Natas agent integration contract

This repository includes a **read-only player snapshot and response module**. It is NOT an authenticated endpoint or a live AI integration.

## Trusted boundary
1. Verify a one-time wallet login challenge on a trusted backend, with nonce expiration, replay protection, domain binding and cryptographic signature verification.
2. Resolve wallet ownership to a stable internal player ID. Do not accept player IDs, ranks, or addresses from browser input as authorization.
3. Query only the authenticated player's allowed data, using server-side database authorization and RLS. Restrict group rankings and invitation records by membership.
4. Call `buildPlayerSnapshot(authenticatedSession, authorizedGameData)` **server-side**. Then pass its limited result to `respondToPlayerQuestion`.
5. Never put private keys, seed phrases, raw auth tokens, invite secrets, or arbitrary database rows in a model prompt.
6. For generative AI, use a protected backend, strict tool allowlists, input limits, rate limits, and minimal response data. Treat model output as untrusted presentation, not authorization.
7. Drafting challenges is separate from sending; require an explicit user confirmation and an authenticated server-side action.
8. No transfers, signing, wagers, or autonomous wallet actions.

## Validation
Run `node natas-player-tools.test.mjs`. This covers session refusal, cross-player mismatch, invalid rank, and read-only outputs.

## Parallel game roadmap
Continue motion catch/bounce replay tests, persistent Hall of Fame with one qualifying personal best per player, secure direct challenges, and per-invitation Turkey Hall. Keep legacy RSVP and free invitations working. Do not use synthetic scores as real leaderboard data.
