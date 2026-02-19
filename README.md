# Solana Airdrop Checker (Web MVP)

Connect a Solana wallet and run a read-only eligibility scan against configurable airdrop rules.

## Features

- Wallet connect (Phantom, Solflare)
- Read-only wallet profile fetch from Solana RPC
- Eligibility scoring engine with starter rules
- Accessible status tabs (`all`, `eligible`, `likely`, `not_eligible`, `unknown`)
- Safety UI to discourage phishing/seed phrase scams
- Supabase-backed admin API + `/admin` rules manager

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
