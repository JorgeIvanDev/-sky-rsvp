# Gauntlet ↔ original toss engine integration audit

## Verified code locations
- `index.html`: original motion engine with `motion(e)`, `beginImpactReview`, `complete`, flight watchdog, spin tracking and post-impact verification diagnostics.
- `tests/engine-sanity.js`: guards for freefall, consecutive impact, gentle settle, rebound and sensor gaps.
- `tests/motion-regression.js`: synthetic and recorded soft-catch trace replay.
- `tests/labeled-catch-replay.test.mjs`: warns that a detected impact alone cannot verify a hand catch; incomplete traces remain unverified.
- `direct-challenge.html`: authenticated two-player invite, status, manual beta score and safe motion diagnostic. **Not yet connected** to original engine.

## Integration boundaries
1. Extract original motion state machine into a shared browser module without silently altering its thresholds.
2. Preserve full sensor-trace quality diagnostics and label any derived airtime as *estimated*.
3. Never treat an impact spike as a verified hand catch; post-impact motion alone cannot prove who caught the phone.
4. Provide a safe, non-throwing simulator for development; require explicit user consent for physical testing.
5. Do not claim anti-cheat or server-verifiable physical tosses from client-supplied milliseconds. Backend must continue to validate identity, challenge membership, duplicate submissions and bounds.
6. Add deterministic replay tests before connecting motion results to challenge submissions.
7. Retain existing solo mode until cross-phone validation succeeds.

## Immediate user-visible improvement
The Gauntlet now links to the **existing solo sensor engine** rather than implying it was discarded. This is navigation only, not sensor-to-backend integration.
