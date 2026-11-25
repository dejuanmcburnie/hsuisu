# headscale-signup

A thin, self-service device enrollment layer for [Headscale](https://github.com/juanfont/headscale), deployed
alongside [gurucomputing/headscale-ui](https://github.com/gurucomputing/headscale-ui).

## What this is (and isn't)

`headscale-ui` is a static admin SPA: an operator pastes a Headscale API key into their browser
(stored in `localStorage`) and uses it to manage users, nodes and ACLs. It has no concept of
public signup, and the API key it needs is too powerful to ever hand to an end user.

This service is a **separate, small app** that sits next to it:

- holds the Headscale API key **server-side only** (never sent to a browser)
- gates enrollment behind **email + domain-allowlisted OTP verification**
- on success, calls the Headscale REST API to create (or reuse) a Headscale user for that
  person and issue a short-lived, single-use pre-auth key
- shows the user the exact `tailscale up --login-server=... --authkey=...` command to run

`headscale-ui` is untouched — it keeps doing admin management. This app only ever does one
narrow thing: turn a verified email into a device enrollment key.

```
                 ┌───────────────┐        ┌────────────┐
  end user  ───▶ │ headscale-     │ ──API──▶│  headscale │
 (signup)        │ signup (this) │  key    │  (server)  │
                 └───────────────┘        └─────┬──────┘
                                                 │ REST API
                 ┌───────────────┐               │
  admin      ───▶│ headscale-ui  │───────────────┘
 (their own key) │ (unchanged)   │
                 └───────────────┘
```

## Enrollment flow

1. User visits `/signup`, enters their email.
2. If the domain is on `ALLOWED_EMAIL_DOMAINS`, a 6-digit code is emailed to them (10 min TTL,
   cooldown between resends, capped attempts).
3. User enters the code at `/verify`.
4. On success, the server:
   - resolves/creates a Headscale user named after the email's local part
   - requests a pre-auth key (default: single-use, non-ephemeral, 60-minute TTL)
   - renders the `tailscale up` command for the user to run on their device
5. The key is single-use and short-lived — re-running the flow issues a fresh one, so people can
   enroll more than one device.

Nothing here replaces Headscale's own OIDC login flow if you already use that; this is for
cases where you want a plain email-gated signup page instead (or in addition, on a different
device class).

## Setup

1. **Create a Headscale API key** for this service (on the Headscale server/container):
   ```
   headscale apikeys create --expiration 90d
   ```
   Store it only in this service's `.env` — never in `headscale-ui`, never in the browser.

2. **Copy and fill in the environment file:**
   ```
   cp .env.example .env
   ```
   At minimum set `HEADSCALE_URL`, `HEADSCALE_API_KEY`, `ALLOWED_EMAIL_DOMAINS`, the `SMTP_*`
   vars, and a random `SESSION_SECRET`.

3. **Run it:**
   - Standalone: `npm install && npm start`
   - Or via the example stack in `../docker-compose.yml`, which also runs `headscale` and
     `headscale-ui`: `docker compose up -d --build`

4. **Put a reverse proxy in front with TLS**, routing e.g.:
   - `enroll.example.com` → this service (public)
   - `admin.example.com` → `headscale-ui` (admin-only; consider an extra layer like basic auth,
     an IP allowlist, or your SSO proxy in front of it, since it has no auth of its own)
   - `headscale.example.com` → `headscale` itself

   Set `secure: true` on the session cookie by running with `NODE_ENV=production` once TLS is
   terminated in front of it (already the default in the provided `Dockerfile`).

## Headscale API version note

Headscale's REST API shape has changed across versions. This service resolves a numeric
Headscale user ID first (`GET`/`POST /api/v1/user`) and uses that ID for
`POST /api/v1/preauthkey`. If your server's `/swagger` page shows a different request/response
shape, [`src/headscaleClient.js`](src/headscaleClient.js) is the one file you should need to
adjust — everything else (OTP, rate limiting, email) is independent of it.

## Security notes

- The Headscale API key never leaves the server process; only short-lived, single-use
  pre-auth keys reach the end user.
- Email + domain allowlist is the gate. If your org's email isn't a trustworthy enough signal
  on its own (e.g. this will be internet-facing), add a CAPTCHA (e.g. Cloudflare Turnstile) in
  front of `/signup`, and/or put this behind SSO at the reverse-proxy layer.
- Rate limits are per-IP (`express-rate-limit`) and per-email (DB-tracked cooldown + max OTP
  attempts). Tune the limits in `.env` for your expected signup volume.
- All enrollments are logged to the audit file (email, Headscale user/key IDs, expiry) at
  `STORE_PATH` — the raw pre-auth key itself is never persisted, only its ID and expiry.
- Rotate `HEADSCALE_API_KEY` periodically (Headscale API keys expire; `headscale apikeys list`
  / `expire` to manage them) and keep `SESSION_SECRET` out of version control.
- Sessions (in-memory) and OTP/audit state (`STORE_PATH`, a JSON file) both assume a single
  instance. If you scale this service horizontally, switch to a shared session store (e.g.
  Redis) and a real database for the store — the JSON file in `src/store.js` is intentionally
  minimal and is the one place you'd swap in Postgres/SQLite-with-a-volume/etc.

## Environment variables

See [`.env.example`](.env.example) for the full list with defaults and comments.
