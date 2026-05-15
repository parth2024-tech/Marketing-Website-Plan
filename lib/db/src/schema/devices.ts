import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const devicesTable = pgTable(
  "devices",
  {
    id: text("id").primaryKey(),
    pairToken: text("pair_token").notNull().unique(),
    deviceToken: text("device_token").notNull().unique(),
    email: text("email"),
    claimed: boolean("claimed").notNull().default(false),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /** Pair token expiry — reject claims on tokens past this time (#6) */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("devices_pair_token_idx").on(t.pairToken),
    index("devices_device_token_idx").on(t.deviceToken),
    index("devices_email_idx").on(t.email),
  ],
);

export type Device = typeof devicesTable.$inferSelect;
export type InsertDevice = typeof devicesTable.$inferInsert;
