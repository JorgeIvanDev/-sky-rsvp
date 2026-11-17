# CNIDARIA Release Manager — evidence and release gates

Last audit: 2026-11-17, America/Chicago. This file is a handoff for the hourly build. Do not treat a successful Pages job as proof of a working mobile experience.

## Current verified findings

1. **CI is red despite a green Pages deployment.** Commit `a982bd1f` has a successful Pages job (run 44201287575), but failed Direct challenge regression (44201287822) and Motion regression tests (44201286744). Motion failure steps: shared replay, couch/350ms boundary, and browser engine syntax/alignment. The prior `b29266b3` revision also failed both test suites. Release status: **NOT QA-CLEARED**. Investigate the new fractional timestamp normalization change and test fixture expectations before adding more sensor features. Inspect the failing assertions/logs; do not weaken thresholds merely to make tests green.

2. **Top-level play is discoverable without authentication.** `direct-challenge.html` has a prominent `PLAY NOW` link to `./index.html` above sign-in, plus `CHALLENGE A FRIEND` anchor. The `#play` section is no longer hidden by default; `refresh()` explicitly keeps it visible when signed in with no accepted match. However, an unauthenticated player does not call `refresh()`, so the lower inline section retains multiplayer-oriented placeholder labels. The prominent top-level PLAY link is the reliable solo entry. Browser/iPhone interaction has **not** been independently verified.

3. **Two competing gameplay paths remain.** Top-level `PLAY NOW` navigates to `index.html`; lower `PLAY TOSS HERE` embeds `index.html` in an iframe. A frame may have different Safari motion permission behavior. This is **not** a shared extracted live state machine: the Gauntlet also retains a separate diagnostic engine under Advanced. Choose ONE obvious primary play path and preserve a clearly labeled fallback only if needed. Do not create more routes or intermediate menus.

4. **Result review is conservative but fragile.** Original engine saves a result in same-origin sessionStorage and posts a same-origin frame message. Gauntlet checks challenge ID, catchLike, unverified hand catch, 350ms coverage, timestamp, and airtime bounds before exposing a review button. No automatic challenge submission; do not claim motion proves a physical hand catch. Add tests for frame message origin/source/challenge mismatch, no active challenge, stale result, and iOS permission denial/retry. The result module is shared, but the live motion state machine is not yet shared.

5. **Release coverage gap fixed in this audit:** `gauntlet-solo-visibility.test.mjs` existed but was NOT included in the Direct challenge CI command or trigger paths. Updated `.github/workflows/direct-challenge-regression.yml` to run it and trigger on changes.

## Priority order for the build agent

- **P0** Resolve red Motion and Direct challenge CI on HEAD; inspect exact failed assertions, repair code/tests correctly, rerun checks, verify Pages revision. Do not call a green Pages deployment a release.
- **P0** Validate the first-time, logged-out journey: open Gauntlet → tap PLAY NOW → original game loads. Automated test for visible link and route; manually verify Safari motion permission with device before claiming mobile success.
- **P1** Simplify the landing page to two clear actions; push sign-in, diagnostics, preview, beta entry and advanced settings below/behind context. Avoid deleting existing invite or RSVP capabilities.
- **P1** Decide whether in-page iframe is viable on iPhone; if not, prefer reliable direct navigation rather than an unreliable embedded mode. One user-facing game, no duplicated score engine.
- **P2** Consolidate live motion engine carefully, with recorded-trace regression fixtures, and preserve conservative hand-catch uncertainty.

## Release reporting contract

Report separately: **commit landed**, **CI passed**, **Pages deployed**, **live URL checked**, **real iPhone tested**. Never imply a later stage from an earlier one. Include SHA and concrete blockers. No modifications to unrelated Supabase tables or live challenges.
