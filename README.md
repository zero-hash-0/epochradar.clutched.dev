# Solana Airdrop Checker (Web MVP)

Connect a Solana wallet and run a read-only eligibility scan against configurable airdrop rules.

## Features

- Wallet connect (Phantom, Solflare)
- Read-only wallet profile fetch from Solana RPC
- Eligibility scoring engine with starter rules
- Accessible status tabs (`all`, `eligible`, `likely`, `not_eligible`, `unknown`)
- Safety UI to discourage phishing/seed phrase scams
- Supabase-backed admin API + `/admin` rules manager
- Discovery radar that scans Solana ecosystem feeds for new opportunities

## Quick start

```bash
cd "/Users/hectorruiz/Documents/New project/solana-airdrop-checker-web"
cp .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Config

- `SOLANA_RPC_URL`: server-side RPC for `/api/check`
- `NEXT_PUBLIC_SOLANA_RPC_URL`: client-side RPC for wallet adapter connection
- `SUPABASE_URL`: your Supabase project URL (optional, enables persistent admin)
- `SUPABASE_SERVICE_ROLE_KEY`: server key for admin API routes
- `NEXT_PUBLIC_PRO_UPGRADE_WALLET`: optional Solana address for the Pro Scan Solana Pay link
- `CRON_SECRET`: bearer secret for `/api/cron/discovery`
- `ADMIN_BASIC_USER`: username for `/admin` and `/api/admin/*` Basic Auth
- `ADMIN_BASIC_PASS`: password for `/admin` and `/api/admin/*` Basic Auth
- `NEXT_PUBLIC_SHOW_ADMIN_TAB`: set `true` to show the `/admin` tab in public UI (default hidden)
- `ADMIN_RATE_LIMIT_MAX`: max requests per window per IP for `/admin` + `/api/admin/*`
- `ADMIN_RATE_LIMIT_WINDOW_MS`: admin rate-limit window in milliseconds
- `CRON_RATE_LIMIT_MAX`: max requests per window per IP for `/api/cron/*`
- `CRON_RATE_LIMIT_WINDOW_MS`: cron rate-limit window in milliseconds

## Important safety notes

- This app only reads public on-chain data.
- It does not sign transactions or execute claims.
- Always verify claim URLs from official project channels.

## Extend rules

Edit `lib/airdrops.ts` and adjust check logic in `lib/evaluator.ts`.

To use Supabase persistence:

1. Run `/Users/hectorruiz/Documents/New project/solana-airdrop-checker-web/supabase/schema.sql` in Supabase SQL editor.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Open `http://localhost:3000/admin` to create and view rules.

## Keeping discovery up to date

- Open `/admin` and use `Run scan now` for manual scans.
- Schedule `GET /api/cron/discovery` with `Authorization: Bearer <CRON_SECRET>` hourly.
- Discovery is high-coverage, not exhaustive. Always verify claim URLs before publishing.

## Admin & security

- `/admin` and `/api/admin/*` are protected by HTTP Basic Auth via `proxy.ts`.
- `/api/cron/*` requires `Authorization: Bearer <CRON_SECRET>`.
- Baseline security headers (including CSP, frame protections, and origin isolation headers) are applied to app routes.
- Rate limiting is enforced by IP for admin and cron routes.
- Admin write APIs enforce strict JSON validation and HTTPS-only external URLs.
