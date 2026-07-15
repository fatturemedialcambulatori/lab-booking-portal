import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminSettingsTable = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminSettings = typeof adminSettingsTable.$inferSelect;
