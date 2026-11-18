# CNIDARIA — next-chat rescue handoff

**Read this before changing code.** Repo: `JorgeIvanDev/-sky-rsvp` · Live: https://jorgeivandev.github.io/-sky-rsvp/ · Supabase project: `hwkxuczipnaqzhbnaurw`.

## Soul and product promise
CNIDARIA is a playful, scrappy, social **phone-motion game that brings people together**: play, challenge someone, reconnect, send a personal invitation, show up in real life. The emotional core is **“I miss you”** and a challenge as an excuse to connect. The mascot **Natas** is the oddball squid/coffee-cup friend. Keep the **original CNIDARIA logo** and the new **cinematic black-and-neon-green, Matrix-like code-rain opening**; the user loves this opening. Relevant assets: `assets/cnidaria-original-logo.svg`, `assets/cnidaria-jellyfish-green.svg`, `assets/natas-gauntlet-preview.svg`. Preserve the playful humor, luminous nautical/analog-green visual character, and mobile-first, Apple-simple navigation. Do not bury normal actions under nested screens. Game-first, not wallet-first. Motto: **designed obsolescence, obsoleted**.

## What went wrong — candidly
- The user opened the app on iPhone/Safari and couldn't find prior invitations, archives, scores or leaders. We repeatedly guessed “not signed in” without proving the cause.
- `index.html` routes ordinary entry to `title.html`; Start Game enters the toss screen. Google sign-in and challenge archives live separately in `direct-challenge.html`. Events/RSVP and direct challenges are separate experiences; **do not claim a unified account dashboard exists**.
- We sent the user down multiple page paths, confusing the experience instead of tracing the actual route. A new “SIGN IN · MY CHALLENGES & ARCHIVES” link was added to `title.html` (commit `f82f3a0d`), but its mobile behavior and OAuth return flow have **not** been physically verified.
- Hall of Fame showed “Loading scores…” on the user's device. Backend inspection found **54 score records and 15 grouped players** at that time; data existed. `index.html` queries `public.cnidaria_leaderboard` through the Supabase REST API; a visibility/pageshow retry fix was pushed (commit `7129f949`). This is **not proof** the user's browser issue was fixed.
- Some earlier motion tests failed because expectations disagreed with fractional browser timestamps. Test edits were pushed, but past claims of “fixed” preceded complete verification. Do not equate a commit, green Pages deploy, or database query with successful user experience.
- Existing archive/removed preferences in direct challenges are stored **per browser/device**; don't promise cross-device archive synchronization.
- The `index.html` “ENGINE BUILD · loading” text is a **separate indicator** from leaderboard “Loading scores…”. Identify which one the user sees.

## Current evidence and limitations
- At handoff check, Pages deployment for `7129f949` succeeded, as did several targeted regression workflows (RSVP security, wallet/RSVP, motion replay, production RSVP smoke). Check **current** GitHub Actions, including failures; don't cherry-pick green runs.
- Database view `public.cnidaria_leaderboard` exists; its results are aggregated by lowercase nickname. This is an **unverified sensor-reported** leaderboard, not verified identity-based records. Do not invent scores or players.
- We have **not** completed an interactive Safari/iPhone OAuth login, two-phone end-to-end challenge, or signed-in event/archive verification. Never say those are working without testing.
- `cnidaria-motion-core.mjs` has conservative catch-*like* pattern checks, including post-impact observation. A motion trace cannot prove a human hand catch. Test safely; don't encourage throwing a phone.

## Fix in this order
1. **Reproduce and observe**: inspect `title.html`, `index.html`, `direct-challenge.html`, events/RSVP routes, browser console/network errors, OAuth redirect URLs, Supabase REST responses and relevant RLS. Determine what the user actually sees. Request one screenshot or diagnostic only if tools cannot establish it.
2. **Make one obvious start**: preserve the cinematic intro; after it, show **Play**, **My Invitations**, **Hall of Fame**, and **Sign in / My Account** with visible signed-in state. No forced game attempt to view invitations. Do not expose a fake combined inbox; clearly distinguish direct challenges and event invitations until unified.
3. **Fix login and identity**: verify Google OAuth redirect back, session persistence, error states and sign-out; check Safari privacy/storage behavior. Never silently create a new identity or lose existing records.
4. **Fix scores**: test anonymous leaderboard GET, response shape, errors, timeout, foreground return and cached pages; show a clear error/retry, never permanent “Loading.” Check score submission separately. Preserve all existing 54+ records; no seed/fake data.
5. **Fix invitation visibility**: trace existing Thanksgiving/event RSVP links, direct challenges, archives and host views, including ownership/RLS and cross-device behavior. Preserve live data and URLs. If archives are local-only, label that honestly or implement safe server-side persistence.
6. **Verify end to end**: automated tests + deployment + real Safari/iPhone behavior + two-account/two-device challenge/RSVP flow. Report each as **verified**, **unverified**, or **blocked**. Do not claim a fix from CI alone.
7. Only then expand Natas, Hall of Fame groups, Hunt, wallet/BSV, chat or new features.

## Engineering rules
- **No hallucinated progress.** Inspect before editing; name exact failures, commits, tests and links. “Committed” ≠ “deployed” ≠ “works on iPhone.”
- Preserve existing scores, Thanksgiving invitations, Google identities, links and Supabase data. No destructive migrations, mass deletions, fake leaderboard entries or weakened RLS to make UI appear functional.
- Run focused tests, then broad regressions, inspect GitHub Actions and verify deployed pages. Check mobile Safari and in-app webview separately where possible.
- Keep changes coherent, safe and reversible. Prefer a tiny working vertical slice over 20 unfinished features.
- Communicate simply: **what was broken → what changed → what was actually tested → what remains**.

## Copy/paste kickoff for next chat
> Continue CNIDARIA from `JorgeIvanDev/-sky-rsvp`. First read `README.md` and `docs/NEXT-CHAT-HANDOFF.md`. Preserve the amazing cinematic green Natas opening, original logo and CNIDARIA spirit: a funny, loving, social phone-toss challenge that brings people together. Stop adding features until you reproduce and fix the actual iPhone/Safari problems: login/identity unclear, previous invitations and archives hard to find, Hall of Fame stuck loading. Inspect GitHub, Supabase, deployed routes and Actions; make the UX Apple-simple with Play, Invitations, Leaders and Account. Protect all existing invitations and scores. Commit real fixes and tests, verify deployment and actual user flows; never claim “working” merely because code was pushed. Give me links and a short honest verified/unverified report. Start by investigating, not guessing.
