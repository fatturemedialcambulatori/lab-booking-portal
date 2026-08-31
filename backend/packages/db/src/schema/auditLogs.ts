import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  actorAccountId: text("actor_account_id"),
  actorUsername: text("actor_username"),
  actorRoleId: text("actor_role_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  outcome: text("outcome").notNull(),
  reason: text("reason"),
  requestMethod: text("request_method"),
  requestPath: text("request_path"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
