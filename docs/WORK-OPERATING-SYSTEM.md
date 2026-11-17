# CNIDARIA engineering operating system

Use this document at the start of every automated or interactive engineering run. The objective is a working, safe, tested user journey—not more pages or inflated commit counts.

## 1. Inspect before editing
- Read `README.md`, `docs/REPOSITORY-GUIDE.md`, `docs/CNIDARIA_SOUL_AND_HANDOFF.md` and the relevant audit.
- Inspect the latest main branch and recent commits. Hourly automation may have changed files since the last run.
- Search existing pages, modules, migrations, tests and docs for the requested behavior.
- Classify each related feature as **shipped**, **implemented but unverified**, **prototype**, **foundation**, or **planned**. Never conflate these.
- Identify the one missing integration or bug. Do not create a parallel UI/service without explaining why the existing one cannot be extended.

## 2. Select the smallest high-value vertical slice
A slice must move the real user journey: invite → understand → accept → play → compare → connect.
Prefer fixing broken links, missing authorization, duplicate submissions, sensor uncertainty, iPhone compatibility, and data integrity over decorative screens.
Do not change approved intro artwork, timing, or established public URLs unless explicitly requested.

## 3. Change safely
- Fresh-fetch each file and SHA immediately before editing; never overwrite concurrent automation changes.
- Preserve real user data, existing invitation tokens, authentication, Supabase RLS and farm tables.
- Keep demo-only effects out of real challenge records. Avoid claiming motion proves a hand catch.
- Add or update a regression test for each behavioral change, ideally failing before the fix.
- Keep commits focused and descriptive.

## 4. Verify
- Run `node --test *.test.mjs tests/*.test.mjs` where a checkout is available.
- Check relevant GitHub Actions, Pages deployment and live URL separately.
- Distinguish static/code review, automated tests, browser checks and real iPhone/two-account testing.
- Never claim tests ran or a live page was viewed without actual evidence.
- If verification is unavailable, say exactly what is unverified and supply a reproducible manual test.

## 5. Report using this format
**Existing:** What already existed, with file references.
**Changed:** Exact files and behavior.
**Evidence:** Commit SHA; tests and deploy result (or not run).
**Risk:** Specific unresolved limitation.
**Next:** One concrete next integration, not a fresh duplicate.

## 6. Definition of done
- Existing flow reused; no accidental regressions.
- Permission, error, retry, expiry and reduced-motion states handled as applicable.
- Relevant regression coverage exists and passes (or failures explicitly reported).
- Backend authorization and client-side state are not confused.
- Mobile and two-account tests recorded when applicable.
- No unverified marketing claims about physical toss proof, live wallets or real-time multiplayer.
