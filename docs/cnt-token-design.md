# CNT · Unified CNIDARIA reward prototype

Status: simulated accounting only. **Not an issued BSV token, real escrow, live GPS verifier, or production reward backend.**

- One fungible CNT balance per player across toss, direct challenge, event attendance, and Lock to Meet.
- Illustrative reward schedule: toss 2 (3/day), direct challenge 5 (2/day), event attendance 8 (1/day), verified meet 12 (1/day). **Not final tokenomics.**
- Proposed illustrative supply ceiling: 21,000,000 CNT. This is a placeholder inspired by Bitcoin/ORDI, not a finalized economic promise.
- Awards require trusted proof IDs and server-side verification before any real minting. The browser demo does not prove activities; its buttons are simulations.
- Idempotency key includes activity, proof and player. Real backend needs atomic unique constraints, authentication, anti-Sybil limits, and transactional supply enforcement.
- Lock to Meet prototype simulates deposits, requires both participants, two distinct verification signals and both check-ins. Location and Bluetooth are spoofable. A production implementation requires privacy controls, proximity attestation design, disputes, cancellation, timeout/refund, audited BSV contract, and legal review.
- Never collect private keys or automatically forfeit money based only on device location.
- Existing CNIDARIA toss gates and RSVP flows are untouched by this prototype.
- Try the standalone lab at /cnt-lab.html.

## Iteration 2
- CNT Lab stores a demo ledger in browser localStorage and validates totals on reload. This is not a secure server ledger; users can edit local data.
- Demo proof records have explicit player/activity/proof/day/evidence structure and idempotency checks. The `demo_attestation` is intentionally untrusted and cannot authorize real token issuance.
- Meeting cancellation returns simulated deposits to participants who deposited, before check-in. Expiration requires manual review rather than automatic confiscation.
- Real next step: authenticated server event ingestion with trusted event verification and atomic database constraints.
