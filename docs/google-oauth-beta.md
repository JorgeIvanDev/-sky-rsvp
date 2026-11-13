# CNIDARIA Google OAuth login (beta)

App uses Supabase OAuth authorize endpoint with provider=google and redirect_to pointing to the CNIDARIA GitHub Pages multiplayer-beta.html URL. Callback parses returned implicit-flow tokens, checks a per-tab state marker, clears URL fragment, persists session locally, refreshes expired access tokens and restores pending invitation after Google sign-in.

**Provider setup still required**: In Supabase project hwkxuczipnaqzhbnaurw, Authentication → Providers → Google: enable Google and configure Google Cloud OAuth client ID/secret. Google Cloud authorized redirect URI: https://hwkxuczipnaqzhbnaurw.supabase.co/auth/v1/callback . Supabase Authentication → URL Configuration: allow https://jorgeivandev.github.io/-sky-rsvp/multiplayer-beta.html and any callback query parameters needed for state. Do not change La Tortolita Farms Site URL merely to fix this app. Never commit OAuth client secret to GitHub.

Limitations: browser-based OAuth implicit token callback; use PKCE with a supported auth client before production. Stored tokens are accessible to same-origin JS and must be protected from XSS. Google sign-in is not verified end-to-end until provider configured and two real accounts test it. No BSV transfers, physical presence verification or real CNT minting.
