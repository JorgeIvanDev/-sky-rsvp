# Repository guide

The root keeps browser entry points and shared ES modules because GitHub Pages currently serves these paths directly. Moving or renaming them can break deployed URLs or imports, so cleanup is intentionally non-destructive.

## Layout

| Area | Purpose |
| --- | --- |
| `index.html` | Original game / homepage |
| `direct-challenge.html` | Gauntlet beta |
| `hunt-mode.html` | Hunt Mode prototype |
| `natas-assistant-prototype.html` | Natas prototype |
| `rsvp/`, `host-*.html` | Invitations and host interfaces |
| `supabase/` | Backend migrations and configuration |
| `tests/`, `*.test.mjs` | Regression tests |
| `.github/workflows/` | CI and Pages deployment |

## Cleanup rules

- Do not rename the repository or move public HTML entry points without redirect and link audits.
- Keep prototypes labeled; never claim server-backed multiplayer for local previews.
- Never commit credentials, guest PII, private wallet keys or precise child locations.
- Prefer grouping new test fixtures under `tests/` and new explanatory documents under `docs/`.
- Before merging, run `node --test *.test.mjs tests/*.test.mjs` and review Actions.

## Release checklist

- Motion and Gauntlet tests pass.
- RSVP/security regressions pass.
- Pages deployment passes.
- Existing event invitation links still resolve.
- Any backend/RLS changes are independently verified before release.
- Mobile device testing is recorded separately from automated tests.

## Verified feature inventory (2026-11-17)

Review before creating any new interface or service:

| Feature | Existing implementation | Boundary |
| --- | --- | --- |
| Cinematic title and invitation demo | `title.html`, `direct-challenge.html?preview=1` | Demo responses do not write to backend |
| Original solo toss engine | `index.html`, `cnidaria-motion-core.mjs` | Experimental; sensor readings do not prove a hand catch |
| Real direct challenge invitations | `direct-challenge.html`, Supabase challenge RPCs | Google auth, invitation preview, accept/decline, history and manual beta scoring exist |
| Challenge acceptance handoff | `direct-challenge.html` | Scrolls to existing play section after confirmed response; not equivalent to original engine integration |
| Event RSVP and host tools | `rsvp/`, `host-inbox.html`, `host-live.html` | Keep event invitation tokens and access controls intact |
| Meeting check-in | `meeting-checkin.html`, related backend | Verify current deployment and authorization before extending |
| Hall of Fame | `supabase/007_hall_of_fame_foundation.sql` | Foundation, not evidence of complete production rankings |
| Hunt Mode | `hunt-mode.html`, `hunt-*.mjs` | Prototype |
| Natas assistant/wallet | `natas-*.mjs`, `natas-assistant-prototype.html` | Foundations/prototypes, not autonomous agent or settled rewards |

**Do not rebuild:** invitation response UI, challenge creation/history, event RSVP, or the original sensor engine. The highest-value integration gap is connecting validated motion-engine outcomes to the existing Gauntlet score workflow, preserving conservative sensor uncertainty and server-side membership/duplicate protections. Before making that change, inspect `docs/gauntlet-engine-integration-audit.md`, existing tests, and the current Supabase contract. Do not automatically submit a toss result from an unverified impact.
