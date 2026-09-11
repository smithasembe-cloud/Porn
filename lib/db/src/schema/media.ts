import { index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const mediaTable = pgTable("media", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull().default(""),
  type: varchar("type", { length: 10 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  objectPath: text("object_path").notNull(),
  thumbnailObjectPath: text("thumbnail_object_path"),
  location: varchar("location", { length: 120 }).notNull().default("Kenya"),
  uploaderName: varchar("uploader_name", { length: 120 }).notNull().default("Picha community"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  views: integer("views").notNull().default(0),
}, (table) => ({
  createdAtIdx: index("media_created_at_idx").on(table.createdAt),
  trendingIdx: index("media_views_created_at_idx").on(table.views, table.createdAt),
}));

export const insertMediaSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(5000).default(""),
  type: z.enum(["image", "video"]),
  mimeType: z.string().regex(/^(image|video)\//).max(120),
  objectPath: z.string().min(1),
  thumbnailObjectPath: z.string().min(1).nullable().optional(),
  location: z.string().trim().max(120).default("Kenya"),
  uploaderName: z.string().trim().max(120).default("Picha community"),
});

export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof mediaTable.$inferSelect;