import { Router, type Request } from "express";
import { z } from "zod";
import { db, reportsTable, idempotencyKeysTable, reportHabitAnswersTable, devicesTable } from "@workspace/db";
import { SentinelReportSchema, generateReport, computeHabitScore, combinedScore } from "@workspace/report-engine";
import { eq, and, isNull } from "drizzle-orm";
import { newReportId, newClaimToken, sha256hex } from "../lib/ids";
import { consumeRateLimit } from "../lib/rateLimit";
import { isResendConfigured } from "../lib/email/config";
import { buildReportClaimedEmail } from "../lib/email/templates/reportClaimed";
import { sendTransactionalEmail } from "../lib/email/resendMailer";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
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

  // Check for agent device-token auth (Bearer token from Tier 1/2 agent)
  let agentDeviceEmail: string | null = null;
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const deviceToken = authHeader.slice(7).trim();
    if (deviceToken.length >= 10) {
      const deviceRows = await db
        .select()
        .from(devicesTable)
        .where(eq(devicesTable.deviceToken, deviceToken))
        .limit(1);
      if (deviceRows.length === 0) {
        res.status(401).json({ error: "Invalid device token" });
        return;
      }
      agentDeviceEmail = deviceRows[0].email ?? null;
    }
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
    consumeRateLimit(ipHash, 1, 10),
    consumeRateLimit(ipHash, 1440, 100),
  ]);
  if (!perMinute || !perDay) {
    res.set("Retry-After", !perMinute ? "60" : "1440");
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
        // Auto-claim when uploaded by a paired agent
        ...(agentDeviceEmail ? { claimed: true, email: agentDeviceEmail } : {}),
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

  if (email && isResendConfigured()) {
    const { subject, html, text } = buildReportClaimedEmail(email, id);
    sendTransactionalEmail({ to: email, subject, html, text }).catch((err) =>
      req.log.error({ err, reportId: id }, "report_claim_confirmation_email_failed")
    );
  }

  res.json({ id, claimed: true, email: email ? "***" : null });
});

// ── POST /api/reports/:id/habit-answers ───────────────────────────────────────

const HabitAnswersBody = z.object({
  claimToken: z.string().min(8).max(64),
  habitAnswers: z.record(z.number()),
});

router.post("/:id/habit-answers", async (req, res) => {
  const { id } = req.params;
  if (!id || id.length < 4) {
    res.status(400).json({ error: "Invalid report ID" });
    return;
  }

  const parsed = HabitAnswersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { claimToken, habitAnswers } = parsed.data;

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

  const habitScore = computeHabitScore(habitAnswers);
  const rj = row.resultJson as Record<string, unknown>;
  const overall = typeof rj.overall === "number" ? rj.overall : 0;
  const combined = combinedScore(overall, habitScore);

  await db
    .insert(reportHabitAnswersTable)
    .values({
      reportId: id,
      answers: habitAnswers,
      habitScore,
      combinedScore: combined,
    })
    .onConflictDoUpdate({
      target: reportHabitAnswersTable.reportId,
      set: {
        answers: habitAnswers,
        habitScore,
        combinedScore: combined,
        updatedAt: new Date(),
      },
    });

  req.log.info({ reportId: id }, "report_habit_answers_saved");

  res.json({ id, habitScore, combinedScore: combined });
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
