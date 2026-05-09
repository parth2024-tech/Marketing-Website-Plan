import { Router } from "express";
import { z } from "zod";
import { db, devicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

const router = Router();

function newToken(len = 32): string {
  return randomBytes(len).toString("hex");
}

function newDeviceId(): string {
  return randomBytes(8).toString("hex");
}

// ── POST /api/devices/pair ────────────────────────────────────────────────────
// Called by the agent immediately after install. Returns a one-time pairToken
// (opened in the browser as /pair?token=<pairToken>) and a persistent
// deviceToken (used as Bearer token for all future report uploads).

router.post("/pair", async (req, res) => {
  const pairToken = newToken(24);
  const deviceToken = newToken(32);
  const id = newDeviceId();

  await db.insert(devicesTable).values({ id, pairToken, deviceToken });

  req.log.info({ deviceId: id }, "device_pair_initiated");

  res.status(201).json({ pairToken, deviceToken });
});

// ── POST /api/devices/claim ───────────────────────────────────────────────────
// Called from the browser /pair page. Binds the device to a user email.

const ClaimBody = z.object({
  pairToken: z.string().min(10).max(128),
  email: z.string().email().max(254),
});

router.post("/claim", async (req, res) => {
  const parsed = ClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid request", details: parsed.error.message });
    return;
  }

  const { pairToken, email } = parsed.data;

  const rows = await db
    .select()
    .from(devicesTable)
    .where(eq(devicesTable.pairToken, pairToken))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Invalid or expired pairing token" });
    return;
  }

  const device = rows[0];

  if (device.claimed) {
    res.json({ deviceId: device.id, email: "***", alreadyClaimed: true });
    return;
  }

  await db
    .update(devicesTable)
    .set({ claimed: true, email, claimedAt: new Date() })
    .where(eq(devicesTable.id, device.id));

  req.log.info({ deviceId: device.id }, "device_claimed");

  res.json({ deviceId: device.id, claimed: true });
});

// ── GET /api/devices/pair-status ──────────────────────────────────────────────
// Polled by the browser /pair page to check whether the agent has initiated
// pairing yet (i.e. whether the pairToken is valid).

router.get("/pair-status", async (req, res) => {
  const token = req.query["token"];
  if (typeof token !== "string" || token.length < 10) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  const rows = await db
    .select({ id: devicesTable.id, claimed: devicesTable.claimed })
    .from(devicesTable)
    .where(eq(devicesTable.pairToken, token))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ valid: false });
    return;
  }

  res.json({ valid: true, claimed: rows[0].claimed });
});

export default router;
