import {
  pgTable,
  text,
  jsonb,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const reportsTable = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    rawJson: jsonb("raw_json").notNull(),
    resultJson: jsonb("result_json").notNull(),
    algoVersion: integer("algo_version").notNull().default(1),
    claimToken: text("claim_token"),
    shareToken: text("share_token"),
    claimed: boolean("claimed").notNull().default(false),
    email: text("email"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    legacy: boolean("legacy").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_email_idx").on(t.email),
    index("reports_created_at_idx").on(t.createdAt),
    index("reports_share_token_idx").on(t.shareToken),
  ],
);

export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = typeof reportsTable.$inferInsert;
