# Sentinel — Hardware Diagnostic Monitor

A dark, precision-designed multi-page marketing website and application for a Windows laptop hardware diagnostic tool. Users run a local diagnostic script (PowerShell/Python), paste the JSON output into the site, and receive a scored, explainable hardware health report persisted in PostgreSQL.

Scoring is fully deterministic and publicly documented — no black-box AI, no machine learning. The same inputs always produce the same output.

## Features

- **Multi-page Marketing Site** — Fully responsive dark/futuristic design with scroll-triggered animations and premium micro-interactions.
- **Deterministic Scoring Engine** — Five-component weighted health score (Battery 30%, Thermals 25%, Storage 25%, Memory 10%, CPU 10%) computed server-side from documented formulas. Algorithm version is stamped on every report.
- **Public Scoring Methodology** — `/scoring` page documents every formula, threshold, and weight with worked examples so any user can reproduce a score by hand.
- **Health Forecast Timeline** — Population-curve baseline (cold start) graduating to per-device linear regression with 95% CI intervals as scan history accumulates. Model source is labelled on every projection.
- **OEM Failure Case Studies** — `/oem-failures` page documenting research into misleading OEM diagnostic tools (Dell SupportAssist, Lenovo Vantage, HP Support Assistant).
- **Diagnostic Scripts** — Generic (PowerShell), Dell (PowerShell), Lenovo (PowerShell), and HP (Python) collection scripts. Implements multi-source telemetry (WMI, Performance Counters, OHM/LHM) with tiered fallback and hardware-level IOCTL querying for NVMe SMART health.
- **Diagnostic Transparency** — Integrated sensor validation (e.g., detecting static ACPI readings) with real-time UI warnings ("Data Collection Notes") when telemetry quality is suspect.
- **Unified Diagnostic Schema** — Standardized `sentinelSchema:1` format used across all collection scripts (PS1/PY) and the core scoring engine to ensure data integrity.
- **Hardware Health Report Flow** — Paste JSON → complete habit audit → receive scored report with component breakdown, findings, and forecast timeline.
- **Troubleshooting Assistant** — Chat-style knowledge base with step-by-step diagnostic guidance.
- **Risk Calculator & Dashboard** — Interactive failure-risk estimation and multi-report comparison views.
- **Account & Claim System** — Passwordless magic-link auth (15-min token → 30-day session cookie). Reports are claimable by email after submission.
- **Device Pairing** — Agent-friendly pairing flow (`/pair`) with `pairToken`/`deviceToken` handshake so a local agent can push reports and auto-claim them.
- **Three-tier Onboarding** — `/get-started` routes users to Tier 1 (Agent), Tier 2 (One-Shot Executable), or Tier 3 (Legacy Script Paste-back) based on capability.
- **Waitlist Gate** — Pro findings blurred behind a waitlist capture form.
- **Custom 404** — Brand-aligned error page.

## Tech Stack

- **Monorepo** — `pnpm` workspaces, Node.js 24, TypeScript 5.9
- **Frontend** — React 19 + Vite, Tailwind CSS v4, `wouter` routing, `@tanstack/react-query`, `framer-motion` animations, `Radix UI` primitives
- **Backend API** — Express 5, `cookie-parser`, `cors`, `pino` logging
- **Database** — PostgreSQL via Drizzle ORM
- **Validation** — Zod (`zod/v4`) + `drizzle-zod`
- **Shared Libraries**:
  - `@workspace/report-engine` — Schema, scoring engine, habit scoring, forecast
  - `@workspace/db` — Drizzle schema + client
  - `@workspace/api-spec` — OpenAPI specification and `orval` codegen config
  - `@workspace/api-zod` — Generated Zod schemas from API spec
  - `@workspace/api-client-react` — Generated React hooks for API interaction

## Project Structure

```text
├── artifacts/
│   ├── api-server/         # Express API (reports, auth, waitlist, device pairing)
│   ├── sentinel-site/      # Main React/Vite marketing + app frontend
│   │   └── public/scripts/ # Diagnostic scripts (dell.ps1, lenovo.ps1, hp.py)
│   ├── novasentinel/       # Nova Dashboard redesign (React/Vite)
│   └── mockup-sandbox/     # UI/UX mockup and prototyping sandbox
├── native/                 # C#/.NET Windows applications
│   ├── SentinelAgent/      # Tier 1 background service & WiX installer
│   ├── SentinelOneShot/    # Tier 2 standalone GUI executable
│   ├── SentinelTestHarness/# Developer test tool for native logic
│   ├── Shared/             # Shared collector (WMI/NVMe) & uploader logic
│   └── sign-binaries.ps1   # Script for code-signing native executables
├── lib/
│   ├── db/                 # Drizzle ORM schema and database client
│   ├── report-engine/      # Shared scoring logic
│   ├── api-spec/           # API contract (OpenAPI)
│   ├── api-zod/            # Generated Zod validation
│   └── api-client-react/   # Generated API hooks
├── scripts/                # Workspace-level maintenance scripts
├── start_api.sh            # Shorthand to start API (Port 5000)
├── start_site.sh           # Shorthand to start Site (Port 3000)
└── pnpm-workspace.yaml
```

## Native Binaries & Downloads

The `native/` directory contains C# tools for data collection:
- **SentinelAgent** — background service with system tray and WiX installer (`SentinelSetup.msi`)
- **SentinelOneShot** — one-time scan executable (Tier 2 on `/get-started`)

### How `/get-started` downloads work

The marketing site does **not** hard-link to GitHub. Buttons call the API, which resolves files in this order:

1. **Env override** — `SENTINEL_DOWNLOAD_URL_SETUP`, `SENTINEL_DOWNLOAD_URL_ONESHOT`, or `SENTINEL_DOWNLOAD_URL_AGENT`
2. **Local bundle** — `artifacts/downloads/` (see `artifacts/downloads/README.md`)
3. **GitHub Releases** — any release (including prereleases) on `SENTINEL_GITHUB_REPO` / `parth2024-tech/Marketing-Website-Plan`

| Endpoint | File |
|----------|------|
| `GET /api/downloads/latest/setup` | `SentinelSetup.msi` |
| `GET /api/downloads/latest/oneshot` | `SentinelOneShot.exe` |
| `GET /api/downloads/latest/agent` | `SentinelAgent.exe` |

If nothing is available, the API returns **503 JSON** and the UI shows a clear error (instead of sending users to an empty GitHub page).

### CI/CD (`native.yml`)

- **Tagged releases (`v*`)** — signed assets attached to a semver GitHub Release.
- **`main` branch** — after each successful native build, a rolling prerelease **`ci-downloads`** is updated so `/get-started` works before the first semver tag.
- **Local dev** — copy built files into `artifacts/downloads/` or run both `./start_api.sh` and `./start_site.sh` (Vite proxies `/api` to port 5000).

Build and sign locally on Windows:

```powershell
.\build-native.ps1
.\native\sign-binaries.ps1 -CertPath .\your-cert.pfx -CertPassword '...'
Copy-Item artifacts\bin\SentinelOneShot\SentinelOneShot.exe artifacts\downloads\
Copy-Item artifacts\bin\SentinelAgent\SentinelAgent.exe artifacts\downloads\
Copy-Item artifacts\bin\SentinelSetup.msi artifacts\downloads\
```

Optional API env for higher GitHub rate limits: `GITHUB_TOKEN` or `SENTINEL_GITHUB_TOKEN`.

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

You can use the provided shorthand scripts:

**API Server** (port 5000):
```bash
./start_api.sh
```

**Frontend** (port 3000):
```bash
./start_site.sh
```

### Useful Commands

```bash
pnpm run typecheck          # Full type check across all packages
pnpm run build              # Build all packages
pnpm --filter @workspace/api-spec run codegen # Regenerate API clients
```

## Architecture Decisions

- **Server-side trust** — `generateReport` runs exclusively on the API server. Client input is untreated; only pre-validated for fast UI feedback.
- **Deterministic scoring** — No ML, no randomness. `ALGORITHM_VERSION` is incremented whenever formulas change; old reports retain their original version stamp.
- **API Specification & Codegen** — The API contract is defined in `@workspace/api-spec` using OpenAPI. Zod schemas and React hooks are automatically generated to ensure type safety across the network boundary.
- **Diagnostic Transparency** — The engine tracks `dataSource` metadata. Suspect telemetry (like static ACPI zones) is flagged and excluded from scoring to prevent false penalties.
- **Layered Telemetry Fallback** — Collection scripts attempt high-fidelity WMI/IOCTL sources first, falling back to performance counters only when necessary.
- **Wear level semantics** — Higher percentages mean healthier (percentage of life remaining, not consumed).
- **Magic-link auth** — No passwords. Email initiates a 15-minute token; successful claim sets a 30-day session cookie.
- **Device pairing** — `POST /api/devices/pair` → short-lived `pairToken` → `POST /api/devices/claim` with email → persistent `deviceToken`.

## Remote Testing & Pairing

To test the Pairing System with a machine on a different network:

1. **Expose your local server**: Use a tool like **ngrok** to create a public tunnel.
   ```bash
   ngrok http 3000 # Expose the frontend
   ngrok http 5000 # Expose the backend
   ```
2. **Update script URLs**: Open the diagnostic script (e.g., `dell.ps1`) and change `$SENTINEL_BASE_URL` to your **Backend ngrok URL**.
3. **External Laptop**:
   - Open your **Frontend ngrok URL**.
   - Generate a **Pair Code**.
   - Run the script: `.\dell.ps1 -PairCode YOUR_CODE`.
4. **Instant Sync**: Your browser will automatically detect the upload and show the report.
