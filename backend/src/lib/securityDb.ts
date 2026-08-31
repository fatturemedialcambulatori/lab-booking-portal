import { pool } from "@workspace/db";

let securityTablesPromise: Promise<void> | null = null;

export const ensureSecurityTables = async () => {
  if (!securityTablesPromise) {
    securityTablesPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_roles (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          descrizione TEXT NOT NULL DEFAULT '',
          system BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_role_permissions (
          id SERIAL PRIMARY KEY,
          role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
          permission_id TEXT NOT NULL
        )
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS admin_role_permissions_role_permission_unique
        ON admin_role_permissions(role_id, permission_id)
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_accounts (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          email TEXT NOT NULL DEFAULT '',
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role_id TEXT NOT NULL REFERENCES admin_roles(id),
          status TEXT NOT NULL DEFAULT 'attivo',
          must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
          last_login_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        ALTER TABLE admin_accounts
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE
      `);

      await pool.query(`
        ALTER TABLE admin_accounts
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS admin_accounts_username_unique
        ON admin_accounts(username)
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          actor_account_id TEXT,
          actor_username TEXT,
          actor_role_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          outcome TEXT NOT NULL,
          reason TEXT,
          request_method TEXT,
          request_path TEXT,
          ip_address TEXT,
          user_agent TEXT,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
        ON audit_logs(created_at DESC)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS audit_logs_actor_account_id_idx
        ON audit_logs(actor_account_id)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS audit_logs_action_idx
        ON audit_logs(action)
      `);
    })();
  }

  return securityTablesPromise;
};
