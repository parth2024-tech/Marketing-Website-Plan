# Sentinel

A dark, futuristic multi-page marketing website for a Windows laptop hardware prediction app. Users download a PowerShell/Python diagnostic script, run it locally, paste the JSON output into the site, and get a scored shareable hardware health report — persisted in Postgres.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / $PORT)
- `pnpm --filter @workspace/sentinel-site run dev` — run the marketing site (port $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + cookie-parser + cors + pino logging
- DB: PostgreSQL + Drizzle ORM
- Shared lib: `@workspace/report-engine` (schema, engine, habit scoring)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Frontend: React + Vite, Tailwind CSS v4, wouter routing, framer-motion
- Build: esbuild (ESM bundle)

## Where things live

```
lib/
  report-engine/       # Shared: SentinelReportSchema, generateReport, HABIT_QUESTIONS, computeHabitScore, combinedScore
  db/                  # Drizzle schema + db client
artifacts/
  api-server/          # Express API — src/routes/{health,waitlist,reports,myReports}.ts
  sentinel-site/       # React/Vite marketing site — src/pages/
```

### Key files
- `lib/report-engine/src/schema.ts` — SentinelReportSchema (source of truth for raw input shape)
- `lib/report-engine/src/engine.ts` — generateReport, scoring algorithm (ALGORITHM_VERSION=1)
- `lib/report-engine/src/habit.ts` — HABIT_QUESTIONS, computeHabitScore
- `lib/db/src/schema/reports.ts` — reports table
- `artifacts/api-server/src/routes/reports.ts` — POST /api/reports, GET /api/reports/:id, POST /api/reports/:id/claim
- `artifacts/api-server/src/routes/myReports.ts` — POST /api/my-reports/request, GET /api/my-reports/verify, GET /api/my-reports, DELETE /api/my-reports/session
- `artifacts/sentinel-site/src/pages/HealthTest.tsx` — step 1: paste → step 2: habit audit → POST to API
- `artifacts/sentinel-site/src/pages/Report.tsx` — server-first load, combined score display, claim panel, share

## Architecture decisions

- **Server-side scoring**: `generateReport` runs on the API server (not trusted client output). The raw JSON is stored for reprocessing. Client runs a local pre-validation for fast feedback only.
- **wearLevelPct semantics**: High = healthy (percentage of life remaining). Score = `clamp(wearLevelPct)`. Not inverted.
- **Storage score inversion bug fixed**: Was `100 - wear`; now correctly `wear` (remaining life = health %).
- **Habit scoring**: 30% weight in `combinedScore(hwScore, habitScore)`. Stored in `report_habit_answers` table. Optional — reports without habit answers show hardware score only.
- **Magic-link auth**: No passwords. Email → 15-min token → session cookie (30-day TTL). Dev mode returns `devToken` in the response.
- **@workspace/report-engine** is a source-only composite lib — Vite resolves it via the workspace symlink in `artifacts/sentinel-site/node_modules/@workspace`. esbuild bundles it inline for the API server (zod must be in api-server's direct deps).

## Product

- Multi-page marketing site (Home, Features, Pricing, FAQ, etc.)
- Diagnostic scripts for Dell (PowerShell), Lenovo (PowerShell), HP (Python)
- Hardware health report flow: paste JSON → habit audit → scored report with component breakdown
- Report sharing: server-stored (cross-device link), localStorage fallback (offline)
- Claim panel: report owners can save to their account (email → session)
- /my-reports: magic-link auth, shows all claimed reports per email
- Pro findings: blurred behind waitlist gate

## Milestone status

- M0: DB schema (6 tables) ✅
- M1: Engine accuracy + ALGORITHM_VERSION=1 ✅
- M2: Core report API + HealthTest wiring ✅
- M3: Claim + share + OG meta ✅
- M4: Habit audit + combined score ✅
- M5: /my-reports + magic-link sessions ✅
- M6: Email templates + cron (Resend) — pending
- M7: Analytics + QA — pending

## User preferences

- Dark, futuristic aesthetic — primary color is cyan (`--primary: #22d3ee`)
- No Supabase, no Lovable Cloud — Replit Postgres only
- Server-side scoring is non-negotiable (trust boundary)

## Gotchas

- **Never run `pnpm dev` at workspace root** — use `restart_workflow` or the workflow panel
- After adding a new workspace lib, always run `pnpm install` before restarting workflows
- esbuild bundles everything inline for api-server — any new dep must be in api-server's `package.json` dependencies
- `BASE_PATH` env var is injected by the Replit proxy; use it for redirects in Express
- Rate-limit uses ip_hash (sha256 of forwarded IP), not raw IP
