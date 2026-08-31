import { boolean, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const adminRolesTable = pgTable("admin_roles", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  descrizione: text("descrizione").notNull().default(""),
  system: boolean("system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adminRolePermissionsTable = pgTable(
  "admin_role_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: text("role_id").notNull().references(() => adminRolesTable.id, { onDelete: "cascade" }),
    permissionId: text("permission_id").notNull(),
  },
  (table) => ({
    uniqueRolePermission: uniqueIndex("admin_role_permissions_role_permission_unique").on(
      table.roleId,
      table.permissionId,
    ),
  }),
);

export const adminAccountsTable = pgTable("admin_accounts", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().default(""),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: text("role_id").notNull().references(() => adminRolesTable.id),
  status: text("status").notNull().default("attivo"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminRoleRecord = typeof adminRolesTable.$inferSelect;
export type AdminRolePermissionRecord = typeof adminRolePermissionsTable.$inferSelect;
export type AdminAccountRecord = typeof adminAccountsTable.$inferSelect;
