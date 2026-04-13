# Sentryx402

Sentryx402 is a payment-native agent runner built for the Stellar x402 hackathon.

It gives an autonomous research agent three things most agent workflows still lack:

- a real wallet
- a hard spending budget
- a receipt trail for every paid decision

Instead of handing an agent a broad API key or a monthly subscription, Sentryx402 lets it pay per query for live search and live news on Stellar testnet using x402.

## Problem

AI agents can reason, but they usually cannot spend money safely.

Most teams are forced into one of three bad choices:

- give the agent unrestricted API access and hope the bill stays sane
- preload stale context and lose access to live information
- block external calls entirely and limit what the agent can do

Sentryx402 solves that by letting an agent buy live data one step at a time with:

- policy checks before every paid request
- a visible budget cap
- auditable receipts after each successful payment

## What It Does

Sentryx402 ships as a simple three-part product:

1. `Overview`
   Shows the wallet, policy, payment, and receipt flow in one clean landing page.
2. `Gateway`
   Runs paid search and paid news queries through x402-protected routes.
3. `Agent Runner`
   Accepts a natural-language task, plans the paid steps, respects a spend budget, and returns a final answer with sources.
4. `Receipts`
   Shows the settlement trail for every successful paid call.

## Key Features

- Freighter wallet connection on `stellar:testnet`
- x402-protected search and news gateways
- policy checks before paid execution
- agent budget cap with visible spend tracking
- final answer plus linked sources
- receipt ledger for every paid query
- responsive UI for desktop and mobile demo flows

## Tech Stack

- React
- Vite
- Tailwind CSS v3
- Express
- `@x402/core`
- `@x402/express`
- `@x402/fetch`
- `@x402/stellar`
- `@stellar/freighter-api`

## Architecture

The app is split into a browser client and an Express backend:

- the frontend connects Freighter, triggers policy checks, and runs paid x402 fetches
- the backend exposes `/api/*` routes for runtime state and planning
- the backend exposes `/x402/*` paid routes for search and news
- successful settlements are recorded in the in-memory receipt ledger

## Repo Structure

```text
sentryx402/
├─ public/
│  └─ branding/
├─ server/
│  ├─ config.js
│  ├─ gatewayProviders.js
│  ├─ index.js
│  ├─ playground.js
│  ├─ policyEngine.js
│  └─ runtimeStore.js
├─ src/
│  ├─ assets/
│  ├─ components/
│  │  ├─ app/
│  │  └─ layout/
│  ├─ lib/
│  ├─ App.css
│  ├─ App.jsx
│  └─ main.jsx
├─ .env.example
├─ index.html
├─ package.json
└─ README.md
```

## Live Routes

- `GET /api/health`
- `GET /api/app`
- `GET /api/runtime`
- `POST /api/session/wallet`
- `POST /api/policy/evaluate`
- `POST /api/playground/plan`
- `POST /api/playground/report`
- `GET /x402/gateway/search`
- `GET /x402/gateway/news`

## Environment

Copy `.env.example` to `.env` and fill in the required values.

Required:

- `X402_FACILITATOR_API_KEY`
- `STELLAR_PAY_TO`

Recommended for deployed search:

- `TAVILY_API_KEY`

Optional:

- `BRAVE_SEARCH_API_KEY`
- `X402_SEARCH_PRICE`
- `X402_NEWS_PRICE`
- `CORS_ORIGIN`

Frontend-only on Vercel:

- `VITE_API_BASE_URL`

## Local Development

Install dependencies:

```bash
npm install
```

Run both frontend and backend:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:server
npm run dev:client
```

Default local URLs:

- frontend: `http://localhost:5173`
- backend: `http://localhost:4021`

## Production Deployment

Recommended split:

- frontend on Vercel
- backend on Render

Backend envs should include:

- `PUBLIC_APP_ORIGIN`
- `CORS_ORIGIN`
- `STELLAR_NETWORK`
- `STELLAR_RPC_URL`
- `X402_FACILITATOR_URL`
- `X402_FACILITATOR_API_KEY`
- `STELLAR_PAY_TO`
- `TAVILY_API_KEY`

Frontend envs should include:

- `VITE_API_BASE_URL`

## Demo Flow

1. Connect Freighter on Stellar testnet
2. Run a paid search or news query in `Gateway`
3. Open `Agent Runner`
4. Enter a task and a budget
5. Approve each paid step
6. Review the final answer and the receipts

## Notes

- x402 intentionally returns `402 Payment Required` before the paid retry succeeds
- live settlement requires a valid facilitator key and funded testnet wallet
- DuckDuckGo scraping may work locally but is less reliable in hosted environments, which is why Tavily is the preferred deployed search provider
- `.env` is intentionally ignored and should never be committed
