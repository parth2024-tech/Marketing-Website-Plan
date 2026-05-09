import { Router, type Request } from "express";
import { z } from "zod";
import { db, reportsTable, idempotencyKeysTable, rateLimitsTable, reportHabitAnswersTable } from "@workspace/db";
import { SentinelReportSchema, generateReport, computeHabitScore, combinedScore } from "@workspace/report-engine";
import { eq, and, sql, isNull } from "drizzle-orm";
import { newReportId, newClaimToken, sha256hex } from "../lib/ids";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

async function checkRateLimit(
  ip: string,
  windowMinutes: number,
  limit: number
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (windowMinutes * 60 * 1000)) * (windowMinutes * 60 * 1000)
  );

  const existing = await db
    .select()
    .from(rateLimitsTable)
    .where(and(eq(rateLimitsTable.ip, ip), eq(rateLimitsTable.windowStart, windowStart)))
    .limit(1);

  if (existing.length === 0) {
    await db
      .insert(rateLimitsTable)
      .values({ ip, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitsTable.ip, rateLimitsTable.windowStart],
        set: { count: sql`${rateLimitsTable.count} + 1` },
      });
    return true; // allowed
  }

  if (existing[0].count >= limit) return false; // blocked

  await db
    .update(rateLimitsTable)
    .set({ count: sql`${rateLimitsTable.count} + 1` })
    .where(and(eq(rateLimitsTable.ip, ip), eq(rateLimitsTable.windowStart, windowStart)));

  return true; // allowed
}

const PostReportBody = z.object({
  rawJson: z.record(z.unknown()),
  habitAnswers: z.record(z.number()).optional(),
  legacy: z.boolean().optional().default(false),
});

// ── POST /api/reports ─────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  // 256 KB cap (body-size header check — express.json() already parses but we
  // enforce a rough size limit via content-length)
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > 256 * 1024) {
    res.status(413).json({ error: "Payload too large. Maximum 256 KB." });
    return;
  }

  // Parse body
  const parsed = PostReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { rawJson, habitAnswers, legacy } = parsed.data;

  // Validate rawJson against SentinelReportSchema
  const reportParsed = SentinelReportSchema.safeParse(rawJson);
  if (!reportParsed.success) {
    const first = reportParsed.error.issues[0];
    res.status(422).json({
      error: "Invalid report data",
      details: `${first.path.join(".")}: ${first.message}`,
    });
    return;
  }

  const ip = getClientIp(req);
  const ipHash = await sha256hex(ip);

  // Rate limiting: 10/min, 100/day per IP
  const [perMinute, perDay] = await Promise.all([
    checkRateLimit(ipHash, 1, 10),
    checkRateLimit(ipHash, 1440, 100),
  ]);
  if (!perMinute || !perDay) {
    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    return;
  }

  // Idempotency-Key dedup (24h)
  const idempotencyKey = req.headers["idempotency-key"];
  if (typeof idempotencyKey === "string" && idempotencyKey.length > 0) {
    const existing = await db
      .select()
      .from(idempotencyKeysTable)
      .where(eq(idempotencyKeysTable.key, idempotencyKey))
      .limit(1);
    if (existing.length > 0) {
      const report = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, existing[0].reportId))
        .limit(1);
      if (report.length > 0) {
        res.status(200).json({
          id: report[0].id,
          claimToken: report[0].claimToken,
          result: report[0].resultJson,
          deduplicated: true,
        });
        return;
      }
    }
  }

  // Compute result server-side
  const resultJson = generateReport(reportParsed.data);

  // Habit scoring (optional)
  const habitScore = habitAnswers ? computeHabitScore(habitAnswers) : null;
  const combined = habitScore !== null ? combinedScore(resultJson.overall, habitScore) : null;

  // Generate unique ID (retry on collision)
  let id = newReportId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const claimToken = newClaimToken();
    try {
      await db.insert(reportsTable).values({
        id,
        rawJson,
        resultJson: resultJson as unknown as Record<string, unknown>,
        claimToken,
        ipHash,
        legacy: legacy ?? false,
      });

      // Store habit answers alongside the report
      if (habitAnswers && habitScore !== null && combined !== null) {
        await db.insert(reportHabitAnswersTable).values({
          reportId: id,
          answers: habitAnswers,
          habitScore,
          combinedScore: combined,
        }).onConflictDoNothing();
      }

      // Store idempotency key if provided
      if (typeof idempotencyKey === "string" && idempotencyKey.length > 0) {
        await db
          .insert(idempotencyKeysTable)
          .values({ key: idempotencyKey, reportId: id })
          .onConflictDoNothing();
      }

      req.log.info({ reportId: id, hasHabit: !!habitAnswers }, "report_created");

      res.status(201).json({ id, claimToken, result: resultJson, habitScore, combinedScore: combined });
      return;
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") {
        id = newReportId();
        continue;
      }
      req.log.error({ err }, "Failed to create report");
      res.status(500).json({ error: "Failed to save report" });
      return;
    }
  }

  res.status(500).json({ error: "Failed to generate unique report ID" });
});

// ── POST /api/reports/:id/claim ───────────────────────────────────────────────

const ClaimBody = z.object({
  claimToken: z.string().min(8).max(64),
  email: z.string().email().max(254).optional(),
});

router.post("/:id/claim", async (req, res) => {
  const { id } = req.params;
  if (!id || id.length < 4) {
    res.status(400).json({ error: "Invalid report ID" });
    return;
  }

  const parsed = ClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid claim request", details: parsed.error.message });
    return;
  }

  const { claimToken, email } = parsed.data;

  const rows = await db
    .select()
    .from(reportsTable)
    .where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt)))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const row = rows[0];

  if (row.claimToken !== claimToken) {
    res.status(403).json({ error: "Invalid claim token" });
    return;
  }

  if (row.claimed && !email) {
    // Already claimed — return current state
    res.json({ id, claimed: true, email: row.email ? "***" : null });
    return;
  }

  await db
    .update(reportsTable)
    .set({
      claimed: true,
      ...(email ? { email } : {}),
    })
    .where(eq(reportsTable.id, id));

  req.log.info({ reportId: id, hasEmail: !!email }, "report_claimed");

  res.json({ id, claimed: true, email: email ? "***" : null });
});

// ── GET /api/reports/:id ──────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || id.length < 4) {
    res.status(400).json({ error: "Invalid report ID" });
    return;
  }

  const rows = await db
    .select()
    .from(reportsTable)
    .where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt)))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const row = rows[0];

  // Also fetch habit data if available
  const habitRows = await db
    .select()
    .from(reportHabitAnswersTable)
    .where(eq(reportHabitAnswersTable.reportId, id))
    .limit(1);

  const habit = habitRows[0];

  res.json({
    id: row.id,
    result: row.resultJson,
    habitScore: habit?.habitScore ?? null,
    combinedScore: habit?.combinedScore ?? null,
    claimed: row.claimed,
    email: row.email ? "***" : null,
    createdAt: row.createdAt,
  });
});

export default router;
