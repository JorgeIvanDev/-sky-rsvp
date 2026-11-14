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
