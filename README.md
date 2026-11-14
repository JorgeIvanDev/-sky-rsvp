# CNIDARIA 🦑

**A pocket-sized phone-motion game, with challenges and events.**

CNIDARIA is an evolving browser-based experiment: play the original toss game, challenge a friend through the Gauntlet, and explore event invitations, Hunt Mode, and Natas. The project favors fast mobile interactions, explicit consent, and clear distinctions between prototypes and verified behavior.

## Try it

| Experience | Link | Status |
| --- | --- | --- |
| Original CNIDARIA | [Play](https://jorgeivandev.github.io/-sky-rsvp/) | Experimental motion game |
| Gauntlet | [Direct challenges](https://jorgeivandev.github.io/-sky-rsvp/direct-challenge.html) | Beta; Google sign-in and manual test scores |
| Hunt Mode | [Explore](https://jorgeivandev.github.io/-sky-rsvp/hunt-mode.html) | Prototype; local-only elements are not authoritative multiplayer |
| Natas | [Assistant prototype](https://jorgeivandev.github.io/-sky-rsvp/natas-assistant-prototype.html) | Experimental, not a fully deployed autonomous agent |

**Safety:** Keep your phone securely in hand while testing motion. Motion signals can indicate a *catch-like* pattern, not prove a hand catch. Beta scores must not be represented as independently verified competition results.

## Project map

- **Motion:** `cnidaria-motion-core.mjs`, `cnidaria-motion-core.test.mjs` — sensor trace collection and conservative replay checks.
- **Gauntlet:** `direct-challenge.html`, `direct-challenge.test.mjs`, `tests/direct-challenge-*.test.mjs` — invitations, response and test score submission.
- **Events/RSVP:** `rsvp/`, `host-inbox.html`, `host-live.html` — invitations and host tools. Existing links and data must remain compatible.
- **Hunt:** `hunt-*.mjs`, `hunt-mode.html` — checkpoints, local session preview and privacy-safe progress.
- **Natas:** `natas-*.mjs`, `natas-assistant-prototype.html` — agent foundations and safe read-only tool prototypes.
- **Backend:** `supabase/` — schema and service integration. Never put private keys in browser code.

## Tests and deployment

This repository uses Node's built-in test runner. Run all root and nested tests from a checkout:

```sh
node --test *.test.mjs tests/*.test.mjs
```

GitHub Actions also runs targeted motion, direct-challenge, RSVP security and Pages workflows. See [build status](https://github.com/JorgeIvanDev/-sky-rsvp/actions). A successful Pages deployment does **not** establish that physical phone testing or cross-device flows are complete.

## Roadmap

1. Validate real-phone motion traces against labeled hand-catch and couch-bounce cases.
2. Complete secure, reliable two-phone Gauntlet invitations and score exchange.
3. Harden Google OAuth, RSVP authorization, token expiry and replay protections.
4. Build privacy-preserving, per-event rooms and potluck/chat features.
5. Expand Hall of Fame, Hunt Mode and Natas with server-side authorization before claiming multiplayer or agent capabilities.

## Contributing

Keep changes small, include regression tests, preserve existing invitation URLs, and avoid publishing sensitive tokens, guest data or location traces. See `docs/` for project notes. This is an active prototype, not a production-certified game.
