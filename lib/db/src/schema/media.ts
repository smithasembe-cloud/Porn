import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const mediaTable = pgTable("media", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull().default(""),
  type: varchar("type", { length: 10 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  objectPath: text("object_path").notNull(),
  location: varchar("location", { length: 120 }).notNull().default("Kenya"),
  uploaderName: varchar("uploader_name", { length: 120 }).notNull().default("Picha community"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  views: integer("views").notNull().default(0),
});

export const insertMediaSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  type: z.enum(["image", "video"]),
  mimeType: z.string().min(1),
  objectPath: z.string().min(1),
  location: z.string().default("Kenya"),
  uploaderName: z.string().default("Picha community"),
});

export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof mediaTable.$inferSelect;