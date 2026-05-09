# Sentinel — Hardware Diagnostic Monitor

A dark, precision-designed multi-page marketing website and application for a Windows laptop hardware diagnostic tool. Users run a local diagnostic script (PowerShell/Python), paste the JSON output into the site, and receive a scored, explainable hardware health report persisted in PostgreSQL.

Scoring is fully deterministic and publicly documented — no black-box AI, no machine learning. The same inputs always produce the same output.

## Features

- **Multi-page Marketing Site** — Fully responsive dark/futuristic design with scroll-triggered animations and premium micro-interactions.
- **Deterministic Scoring Engine** — Five-component weighted health score (Battery 30%, Thermals 25%, Storage 25%, Memory 10%, CPU 10%) computed server-side from documented formulas. Algorithm version is stamped on every report.
- **Public Scoring Methodology** — `/scoring` page documents every formula, threshold, and weight with worked examples so any user can reproduce a score by hand.
- **Health Forecast Timeline** — Population-curve baseline (cold start) graduating to per-device linear regression with 95% CI intervals as scan history accumulates. Model source is labelled on every projection.
- **Diagnostic Scripts** — Dell (PowerShell), Lenovo (PowerShell), and HP (Python) collection scripts.
- **Hardware Health Report Flow** — Paste JSON → complete habit audit → receive scored report with component breakdown, findings, and forecast timeline.
- **Troubleshooting Assistant** — Chat-style knowledge base with step-by-step diagnostic guidance.
- **Risk Calculator & Dashboard** — Interactive failure-risk estimation and multi-report comparison views.
- **Account & Claim System** — Passwordless magic-link auth (15-min token → 30-day session cookie). Reports are claimable by email after submission.
- **Device Pairing** — Agent-friendly pairing flow (`/pair`) with `pairToken`/`deviceToken` handshake so a local agent can push reports and auto-claim them to an email.
- **Three-tier Onboarding** — `/get-started` routes users to Tier 1 (agent), Tier 2 (one-shot paste), or Tier 3 (legacy hidden flow) based on capability.
- **Waitlist Gate** — Pro findings blurred behind a waitlist capture form.
- **Custom 404** — Brand-aligned error page.

## Tech Stack

- **Monorepo** — `pnpm` workspaces, Node.js 24, TypeScript 5.9
- **Frontend** — React 19 + Vite, Tailwind CSS v4, `wouter` routing, `framer-motion` animations
- **Backend API** — Express 5, `cookie-parser`, `cors`, `pino` logging
- **Database** — PostgreSQL via Drizzle ORM
- **Validation** — Zod (`zod/v4`) + `drizzle-zod`
- **Shared Libraries** — `@workspace/report-engine` (schema, scoring engine, habit scoring, forecast), `@workspace/db` (Drizzle schema + client)

## Project Structure

```text
├── artifacts/
│   ├── api-server/         # Express API (reports, auth, waitlist, device pairing)
│   └── sentinel-site/      # React/Vite marketing + app frontend
├── lib/
│   ├── db/                 # Drizzle ORM schema and database client
│   │   └── src/schema/
│   │       ├── reports.ts
│   │       ├── devices.ts          # Device pairing tokens
│   │       ├── scans.ts            # Per-device scan history (Track 2A)
│   │       ├── waitlist.ts
│   │       ├── magicLinkTokens.ts
│   │       └── ...
│   └── report-engine/      # Shared scoring logic
│       └── src/
│           ├── engine.ts           # Deterministic scoring formulas
│           ├── forecast.ts         # Population curve + per-device regression (Track 2C)
│           ├── habit.ts
│           └── schema.ts
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites
- Node.js 24+
- pnpm
- PostgreSQL database

### Installation

```bash
git clone https://github.com/parth2024-tech/Marketing-Website-Plan.git
cd Marketing-Website-Plan
pnpm install
```

### Environment Variables

Set `DATABASE_URL` in `artifacts/api-server/.env`:

```env
DATABASE_URL="postgres://user:password@localhost:5432/sentinel"
```

### Push Database Schema

```bash
pnpm --filter @workspace/db run push
```

### Running Locally

**API Server** (port 8080):
```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

**Frontend** (port 3000):
```bash
PORT=3000 BASE_PATH=/ API_PORT=8080 pnpm --filter @workspace/sentinel-site run dev
```

### Useful Commands

```bash
pnpm run typecheck          # Full type check across all packages
pnpm run build              # Build all packages
pnpm --filter @workspace/db run push   # Apply schema changes to DB
```

## Architecture Decisions

- **Server-side trust** — `generateReport` runs exclusively on the API server. Client input is untreated; only pre-validated for fast UI feedback.
- **Deterministic scoring** — No ML, no randomness. `ALGORITHM_VERSION` is incremented whenever formulas change; old reports retain their original version stamp.
- **Wear level semantics** — Higher percentages mean healthier (percentage of life remaining, not consumed).
- **Forecast honesty** — Cold-start projections use a population curve and are labelled as such. Warm projections use the device's own scan history with a 95% CI range, never a false-precision single number.
- **Habit scoring** — Accounts for 30% of the combined health score (`0.7 × hw_score + 0.3 × habit_score`), stored in the database.
- **Magic-link auth** — No passwords. Email initiates a 15-minute token; successful claim sets a 30-day session cookie.
- **Device pairing** — `POST /api/devices/pair` → short-lived `pairToken` → `POST /api/devices/claim` with email → persistent `deviceToken`. Reports submitted with `Authorization: Bearer <deviceToken>` are auto-claimed.
- **Library bundling** — `@workspace/report-engine` is bundled into the backend via `esbuild` and resolved in the frontend via Vite workspace symlinking.
