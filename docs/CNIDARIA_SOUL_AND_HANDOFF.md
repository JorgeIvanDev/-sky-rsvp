# CNIDARIA — Soul, Vision & Build Handoff
Updated: 2026-11-17

## North star
CNIDARIA turns a playful physical action into human connection. Toss, catch, challenge a friend, unlock an invitation, and meet in real life. Game first; everything else grows from it. Make the experience child-simple, delightful, fast, and unmistakably playful, without hiding safety or privacy limitations.

## Names and identity
CNIDARIA is the project/game. NATAS is the original black coffee-cup/squid mascot and possible AI guide; natas.games is a potential identity. Do not casually rename the existing app or remove its original visual identity.

## Experience
1. Optional cinematic Three.js entry: black background, analog neon-green digital rain, floating Natas, START GAME and OPTIONS; graceful fallback for Safari, slow networks, reduced motion. Direct invitation/deep links bypass the intro.
2. Giant PLAY NOW and minimal friction; mobile-first.
3. Toss engine: explicit motion permission; safe open space, below door height, straight up and catch. Clear ACTIVATE LAUNCH ENGINE, retries, red failure screen. Use labeled real-device traces; distinguish hand catch from couch bounce and sensor uncertainty. Never claim an unverified score is physically verified.
4. Gauntlet: direct person-to-person challenges, score response, winner, shareable link, global and per-group Hall of Fame.
5. Invitations: challenge -> reveal invitation -> RSVP. Participation is required, winning is not. Event room/chat, items list, host controls, archive/delete, attendance.
6. Natas: recognizable floating helper, contextual hints, eventually wallet-aware functions with explicit permission.
7. Future optional extensions: wallet identity/CNT, lock-to-meet location co-presence, Hunt Mode, Gryd/Nektar. Modular; not required for core play.

## Design principles
- Fun before complexity; big readable buttons, very few steps, clear game state.
- Distinctive black/green retro-computer energy for intro, not an excuse for illegible screens.
- Multilingual including English and Spanish.
- Invitation links must reveal what is being invited to; no nickname-only dead ends.
- Preserve existing RSVP and challenge links, migrations and stored data.
- No false claims of verified motion, multiplayer, payments, live wallet or GPS functionality.
- Privacy and consent: no unnecessary location sharing, secret keys in client code, or hidden authentication traps.
- Safe use: never encourage dangerous throws; hand-catch inference is not proof.

## Existing implementation
Repository: JorgeIvanDev/-sky-rsvp, default branch main.
Site: https://jorgeivandev.github.io/-sky-rsvp/
Supabase project referenced in prior build notes: hwkxuczipnaqzhbnaurw (verify before modifying).
README.md maps motion core, direct-challenge, RSVP, Hunt, Natas and Supabase. Tests: node --test *.test.mjs tests/*.test.mjs.
There is an hourly CNIDARIA build automation; check recent commits and CI before new changes.

## Immediate priorities (verify current state first)
1. Three.js intro visibly loads on iPhone/Safari; loading, fallback, bypass and START behavior.
2. Labeled physical-device motion validation; false positives, retries and sensor permissions.
3. End-to-end two-phone Gauntlet with OAuth, nonce/expiry/replay checks, score exchange.
4. Invitation reveal -> RSVP and event-room authorization, chat/items.
5. Hall of Fame rankings and Natas integration.
6. Wallet/reward/location systems only after core reliability and authorization.

## Working agreement
Read this file and README before coding. Inspect actual main branch, recent commits, Actions, Supabase schema and deployment status. Separate shipped, prototype, tested and planned. Make integrated changes with tests, avoid breaking URLs and mobile behavior, and report what truly works versus what still needs a real-phone test.

## One-sentence product test
Can a person open a link, understand the challenge, play safely, and connect with someone else in under a minute?
