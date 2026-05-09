# Sentinel - Predictive Health Monitor

A dark, futuristic multi-page marketing website and application for a Windows laptop hardware prediction tool. Users can download a diagnostic script (PowerShell/Python), run it locally on their machine, paste the JSON output into the site, and receive a comprehensive, scored, and shareable hardware health report which is persisted in a PostgreSQL database.

## 🌟 Features

- **Multi-page Marketing Site**: Fully responsive and beautifully designed dark, futuristic aesthetic.
- **High-Fidelity Motion Design**: Standardized scroll-triggered entrance animations and premium micro-interactions across the site.
- **Diagnostic Scripts**: Support for Dell (PowerShell), Lenovo (PowerShell), and HP (Python) laptops.
- **Hardware Health Report Flow**: Users paste JSON output → complete a habit audit → receive a scored report with a detailed component breakdown.
- **Intelligent Troubleshooting Assistant**: Local troubleshooting assistant with a chat-style knowledge base for step-by-step diagnostic solutions.
- **Risk Calculator & Dashboards**: Interactive components to calculate potential hardware failure risks and dedicated dashboards to compare reports over time.
- **Server-Side Scoring Algorithm**: Robust, trustworthy scoring executed server-side.
- **Report Sharing**: Server-stored reports with cross-device links and offline localStorage fallbacks.
- **Account & Claim System**: "Magic-link" passwordless authentication. Users can save reports to their email-based session.
- **Waitlist Gate**: "Pro" findings and premium features blurred behind a waitlist capture form.
- **Custom 404 Page**: Brand-aligned error page to improve user experience when navigating to non-existent pages.

## 🛠 Tech Stack

- **Monorepo Strategy**: `pnpm` workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React 19 + Vite, Tailwind CSS v4, `wouter` for routing, `framer-motion` for animations.
- **Backend API**: Express 5 + `cookie-parser` + `cors` + `pino` logging.
- **Database**: PostgreSQL with Drizzle ORM.
- **Validation & Schema**: Zod (`zod/v4`) and `drizzle-zod`.
- **Shared Library**: `@workspace/report-engine` for shared schemas, scoring engine, and habit scoring logic.

## 📂 Project Structure

```text
├── artifacts/
│   ├── api-server/         # Express API Server (handles reporting, auth, waitlist)
│   └── sentinel-site/      # React/Vite frontend marketing site
├── lib/
│   ├── db/                 # Drizzle ORM schema and database client
│   └── report-engine/      # Shared Sentinel report schema, scoring algorithms
├── scripts/                # Utility and build scripts
└── pnpm-workspace.yaml     # pnpm workspace configuration
```

## 🚀 Getting Started

### Prerequisites
- [Node.js 24+](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- A running PostgreSQL database instance

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/parth2024-tech/Marketing-Website-Plan.git
   cd Marketing-Website-Plan
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure Environment Variables:
   Set up your environment variables, specifically the `DATABASE_URL` for PostgreSQL connections. You may need to create a `.env` file in `artifacts/api-server/` or configure it globally.
   ```env
   DATABASE_URL="postgres://user:password@localhost:5432/sentinel"
   ```

4. Push Database Schema (Dev Only):
   ```bash
   pnpm --filter @workspace/db run push
   ```

### Running the Application Locally

You can use the provided bash scripts to start the server and the frontend with the correct environment variables concurrently.

**1. Start the API Server:**
```bash
chmod +x start_api.sh
./start_api.sh
```
*(Runs on port 5000 and connects to the local PostgreSQL database)*

**2. Start the Frontend Application:**
```bash
chmod +x start_site.sh
./start_site.sh
```
*(Runs on port 3000)*

### Useful Commands

- **Full Typecheck**: `pnpm run typecheck`
- **Build All Packages**: `pnpm run build`
- **Regenerate API Hooks/Zod Schemas**: `pnpm --filter @workspace/api-spec run codegen`

## 🧠 Architecture Decisions

- **Server-Side Trust**: `generateReport` executes strictly on the API server. Client-side input is considered untrusted and only pre-validated for fast UI feedback.
- **Wear Level Semantics**: High percentages equate to healthy status (percentage of life remaining).
- **Habit Scoring**: Accounts for 30% of the combined health score, stored securely in the database.
- **Magic-Link Auth**: No passwords. An email initiates a 15-minute token leading to a session cookie with a 30-day TTL.
- **Composite Library Building**: `@workspace/report-engine` is bundled directly into the backend via `esbuild` and resolved in the frontend via Vite symlinking.

## 🤝 Contributing

Ensure all code changes pass type checking and build steps before committing:
```bash
pnpm run typecheck && pnpm run build
```
