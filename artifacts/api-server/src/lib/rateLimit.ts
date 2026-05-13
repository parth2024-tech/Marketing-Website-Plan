import { db, rateLimitsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Atomically increments the counter for `(key, windowStart)` and returns whether
 * this request is within `limit` for the window (inclusive). Uses a single
 * INSERT … ON CONFLICT … DO UPDATE … RETURNING round-trip to avoid check-then-act races.
 */
export async function consumeRateLimit(
  key: string,
  windowMinutes: number,
  limit: number
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (windowMinutes * 60 * 1000)) * (windowMinutes * 60 * 1000)
  );

  const rows = await db
    .insert(rateLimitsTable)
    .values({ ip: key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitsTable.ip, rateLimitsTable.windowStart],
      set: { count: sql`${rateLimitsTable.count} + 1` },
    })
    .returning({ count: rateLimitsTable.count });

  const count = rows[0]?.count;
  if (count == null) return false;
  return count <= limit;
}
