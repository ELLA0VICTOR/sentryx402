# Sentryx402

Sentryx402 is payment-native agent infrastructure on Stellar x402.

It ships the combined product surface you would expect in a hackathon demo:

1. `Gateway`
   Runs paid search and paid news calls behind x402 so an agent pays only when it needs fresh information.
2. `Agent Runner`
   Takes a natural-language task, plans the paid steps, runs them with Freighter, and returns a final answer with sources.
3. `Receipts + Controls`
   Keeps operator policy checks and settlement receipts visible for every paid call.

## What The App Does

- Connects a real Stellar wallet that can sign Soroban auth entries
- Evaluates each paid query against an operator policy profile
- Calls real x402-protected search and news routes on Stellar testnet
- Records successful settlements in a visible receipt ledger
- Returns a final answer so the Agent Runner is useful instead of just returning raw links

## Stack

- React + Vite
- Express
- `@x402/express`
- `@x402/fetch`
- `@x402/stellar`
- `@stellar/freighter-api`

## Live Routes

- `GET /api/app`
- `GET /api/runtime`
- `POST /api/session/wallet`
- `POST /api/policy/evaluate`
- `POST /api/playground/plan`
- `POST /api/playground/report`
- `GET /x402/gateway/search`
- `GET /x402/gateway/news`

The browser client uses Freighter to sign the Stellar auth entry required by x402, then retries the paid request automatically through `@x402/fetch`.

## Environment

Copy `.env.example` to `.env` and fill in:

- `X402_FACILITATOR_API_KEY`
- `STELLAR_PAY_TO`

Optional:

- `TAVILY_API_KEY`
  If present, the search gateway uses Tavily as the primary live search provider in production.
- `BRAVE_SEARCH_API_KEY`
  If present, the search gateway uses Brave Search as a secondary live provider.
- `X402_SEARCH_PRICE`
- `X402_NEWS_PRICE`

Defaults:

- `stellar:testnet`
- Soroban testnet RPC
- OpenZeppelin Channels x402 testnet facilitator
- `$0.01` search queries
- `$0.02` news queries

## Run

```bash
npm run dev
```

That starts:

- the Express backend on `http://localhost:4021`
- the Vite frontend on `http://localhost:5173`

You can also run them separately:

```bash
npm run dev:server
npm run dev:client
```

The Vite dev server proxies `/api` and `/x402` to the backend automatically.

## Build

```bash
npm run build
```

## Notes

- Real settlement requires both the facilitator API key and a valid `STELLAR_PAY_TO` address.
- The live wallet path is Freighter-first because Stellar x402 needs auth-entry signing from a compatible wallet.
- The overview stays visual, while the action tabs stay intentionally sparse for judging and live demos.
