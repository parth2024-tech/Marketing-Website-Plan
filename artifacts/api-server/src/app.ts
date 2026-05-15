import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// Adds X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security,
// Content-Security-Policy, and other critical security headers.
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS — restrict to configured origins ─────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["https://yoursite.com"],
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
}));

app.use(cookieParser());

// ── Body parser with explicit size cap ────────────────────────────────────────
// Enforced by the parser regardless of client-supplied content-length header.
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

app.use("/api", router);

// ── Global error handler ──────────────────────────────────────────────────────
// Must be 4-argument signature for Express to treat it as error handler.
// Catches unhandled async errors and prevents stack trace leaks in production.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "unhandled_error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
