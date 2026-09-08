import { integer, varchar, pgTable } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const siteStatsTable = pgTable("site_stats", {
  key: varchar("key", { length: 40 }).primaryKey(),
  visitorCount: integer("visitor_count").notNull().default(0),
});

export const siteStatsKeySchema = z.literal("global");
export type SiteStats = typeof siteStatsTable.$inferSelect;