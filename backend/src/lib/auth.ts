import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { eq } from "drizzle-orm";
import { adminSettingsTable, db, pool } from "@workspace/db";
import { ensureSecurityTables } from "./securityDb";

export type PermissionId =
  | "admin"
  | "laboratorio.accettazione"
  | "laboratorio.accettazione.modena"
  | "laboratorio.accettazione.sassuolo"
  | "laboratorio.agenda"
  | "laboratorio.agenda.modena"
  | "laboratorio.agenda.sassuolo"
  | "laboratorio.listino"
  | "laboratorio.listino.write"
  | "ambulatorio.accettazione"
  | "ambulatorio.accettazione.modena"
  | "ambulatorio.accettazione.sassuolo"
  | "ambulatorio.agenda"
  | "ambulatorio.agenda.modena"
  | "ambulatorio.agenda.sassuolo"
  | "ambulatorio.prestazioni"
  | "ambulatorio.prestazioni.write"
  | "anagrafiche"
  | "infortunistica"
  | "cassa"
  | "cassa.modena"
  | "cassa.sassuolo"
  | "impostazioni"
  | "utenti";

export type AdminRole = {
  id: string;
  nome: string;
  descrizione: string;
  permessi: PermissionId[];
};

type StoredAdminAccount = {
  id: string;
  nome: string;
  email: string;
  username: string;
  passwordHash?: string;
  password?: string;
  ruoloId: string;
  stato: "attivo" | "sospeso";
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
};

export type PublicAdminAccount = Omit<StoredAdminAccount, "passwordHash" | "password"> & {
  password: "";
  hasPassword: boolean;
};

type StoredAccessConfig = {
  securityProfileVersion?: number;
  ruoli: AdminRole[];
  account: StoredAdminAccount[];
};

export type PublicAccessConfig = {
  ruoli: AdminRole[];
  account: PublicAdminAccount[];
};

export type AuthSession = {
  accountId: string;
  username: string;
  nome: string;
  roleId: string;
  roleName: string;
  permissions: PermissionId[];
  mustChangePassword: boolean;
  iat: number;
  exp: number;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSession;
    }
  }
}

const ADMIN_ACCESS_KEY = "admin-access";
const ACCESS_CONFIG_VERSION = 2;
export const SESSION_COOKIE_NAME = "mmedical_session";
const SESSION_TTL_SECONDS = Number(process.env["AUTH_SESSION_TTL_SECONDS"] ?? 8 * 60 * 60);
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = Number(process.env["AUTH_LOGIN_MAX_FAILURES"] ?? 10);
const PASSWORD_MIN_LENGTH = Number(process.env["AUTH_PASSWORD_MIN_LENGTH"] ?? 8);

const PERMISSION_IDS: PermissionId[] = [
  "admin",
  "laboratorio.accettazione",
  "laboratorio.accettazione.modena",
  "laboratorio.accettazione.sassuolo",
  "laboratorio.agenda",
  "laboratorio.agenda.modena",
  "laboratorio.agenda.sassuolo",
  "laboratorio.listino",
  "laboratorio.listino.write",
  "ambulatorio.accettazione",
  "ambulatorio.accettazione.modena",
  "ambulatorio.accettazione.sassuolo",
  "ambulatorio.agenda",
  "ambulatorio.agenda.modena",
  "ambulatorio.agenda.sassuolo",
  "ambulatorio.prestazioni",
  "ambulatorio.prestazioni.write",
  "anagrafiche",
  "infortunistica",
  "cassa",
  "cassa.modena",
  "cassa.sassuolo",
  "impostazioni",
  "utenti",
];

export type SedeId = "modena" | "sassuolo";
export type SedeScopedPermissionBase =
  | "laboratorio.accettazione"
  | "laboratorio.agenda"
  | "ambulatorio.accettazione"
  | "ambulatorio.agenda"
  | "cassa";

const SEDI: SedeId[] = ["modena", "sassuolo"];
const DEFAULT_ADMIN_PASSWORD_HASH =
  "scrypt$JiwyKsD8QHBOECchiqDozw$lsh63_ficzu7h518fciFoIhXbulE0eFgd4BFV3ZdDlw";
const DEFAULT_SEGRETERIA_PASSWORD_HASH =
  "scrypt$LKNI4woszTP_Zm7PF6fHGw$C5RBBMdRzF-5jBiC_eI7HCwKDFBwk-03LBq4yMjc4LY";
const DEFAULT_OPERATIVO_PASSWORD_HASH =
  "scrypt$3sSgutaFx7_1xukvP360pQ$kBPgzWQufVWxoekUjgEqVdMA_mKGz6ZWWEXRookeWSE";

const LEGACY_DEFAULT_ROLE_IDS = new Set([
  "segreteria",
  "laboratorio",
  "medico",
  "avvocato",
  "amministrazione",
]);

const LEGACY_DEFAULT_ACCOUNT_IDS = new Set([
  "segreteria",
  "laboratorio",
  "medico",
  "avvocato",
  "amministrazione",
]);

const DEFAULT_ACCESS_CONFIG: StoredAccessConfig = {
  securityProfileVersion: ACCESS_CONFIG_VERSION,
  ruoli: [
    {
      id: "admin",
      nome: "Admin",
      descrizione: "Accesso completo a tutte le sedi, sezioni e operazioni.",
      permessi: PERMISSION_IDS,
    },
    {
      id: "segreteria-modena",
      nome: "Segreteria Modena",
      descrizione: "Operativita Modena; agenda ambulatoriale visibile e scrivibile su entrambe le sedi.",
      permessi: [
        "laboratorio.accettazione.modena",
        "laboratorio.agenda.modena",
        "laboratorio.agenda.sassuolo",
        "ambulatorio.accettazione.modena",
        "ambulatorio.agenda.modena",
        "ambulatorio.agenda.sassuolo",
        "cassa.modena",
      ],
    },
    {
      id: "segreteria-sassuolo",
      nome: "Segreteria Sassuolo",
      descrizione: "Operativita Sassuolo; agenda ambulatoriale visibile e scrivibile su entrambe le sedi.",
      permessi: [
        "laboratorio.accettazione.sassuolo",
        "laboratorio.agenda.modena",
        "laboratorio.agenda.sassuolo",
        "ambulatorio.accettazione.sassuolo",
        "ambulatorio.agenda.modena",
        "ambulatorio.agenda.sassuolo",
        "cassa.sassuolo",
      ],
    },
    {
      id: "laboratorio-modena",
      nome: "Laboratorio Modena",
      descrizione: "Accesso operativo limitato al laboratorio della sede di Modena.",
      permessi: ["laboratorio.accettazione.modena", "laboratorio.listino"],
    },
    {
      id: "laboratorio-sassuolo",
      nome: "Laboratorio Sassuolo",
      descrizione: "Accesso operativo limitato al laboratorio della sede di Sassuolo.",
      permessi: ["laboratorio.accettazione.sassuolo", "laboratorio.listino"],
    },
    {
      id: "ambulatorio-modena",
      nome: "Ambulatorio Modena",
      descrizione: "Accesso operativo limitato all'ambulatorio della sede di Modena.",
      permessi: [
        "ambulatorio.accettazione.modena",
        "ambulatorio.agenda.modena",
        "ambulatorio.prestazioni",
      ],
    },
    {
      id: "ambulatorio-sassuolo",
      nome: "Ambulatorio Sassuolo",
      descrizione: "Accesso operativo limitato all'ambulatorio della sede di Sassuolo.",
      permessi: [
        "ambulatorio.accettazione.sassuolo",
        "ambulatorio.agenda.sassuolo",
        "ambulatorio.prestazioni",
      ],
    },
  ],
  account: [
    {
      id: "admin",
      nome: "Admin",
      email: "admin@mmedical.local",
      username: "admin",
      passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
      ruoloId: "admin",
      stato: "attivo",
      mustChangePassword: false,
    },
    {
      id: "segreteria-modena",
      nome: "Segreteria Modena",
      email: "segreteria.modena@mmedical.local",
      username: "segreteria-modena",
      passwordHash: DEFAULT_SEGRETERIA_PASSWORD_HASH,
      ruoloId: "segreteria-modena",
      stato: "attivo",
      mustChangePassword: false,
    },
    {
      id: "segreteria-sassuolo",
      nome: "Segreteria Sassuolo",
      email: "segreteria.sassuolo@mmedical.local",
      username: "segreteria-sassuolo",
      passwordHash: DEFAULT_SEGRETERIA_PASSWORD_HASH,
      ruoloId: "segreteria-sassuolo",
      stato: "attivo",
      mustChangePassword: false,
    },
    {
      id: "laboratorio-modena",
      nome: "Laboratorio Modena",
      email: "laboratorio.modena@mmedical.local",
      username: "laboratorio-modena",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "laboratorio-modena",
      stato: "attivo",
      mustChangePassword: false,
    },
    {
      id: "laboratorio-sassuolo",
      nome: "Laboratorio Sassuolo",
      email: "laboratorio.sassuolo@mmedical.local",
      username: "laboratorio-sassuolo",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "laboratorio-sassuolo",
      stato: "attivo",
      mustChangePassword: false,
    },
    {
      id: "ambulatorio-modena",
      nome: "Ambulatorio Modena",
      email: "ambulatorio.modena@mmedical.local",
      username: "ambulatorio-modena",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "ambulatorio-modena",
      stato: "attivo",
      mustChangePassword: false,
    },
    {
      id: "ambulatorio-sassuolo",
      nome: "Ambulatorio Sassuolo",
      email: "ambulatorio.sassuolo@mmedical.local",
      username: "ambulatorio-sassuolo",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "ambulatorio-sassuolo",
      stato: "attivo",
      mustChangePassword: false,
    },
  ],
};

const loginFailures = new Map<string, { count: number; resetAt: number }>();

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const readPermissions = (value: unknown): PermissionId[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is PermissionId => PERMISSION_IDS.includes(item as PermissionId))))
    : [];

const normalizeRole = (value: unknown): AdminRole | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = readString(item["id"]);
  const nome = readString(item["nome"]);
  if (!id || !nome) return null;
  return {
    id,
    nome,
    descrizione: readString(item["descrizione"]),
    permessi: readPermissions(item["permessi"]),
  };
};

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (password: string, passwordHash: string | undefined) => {
  if (!passwordHash) return false;
  const [algorithm, salt, expectedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHash) return false;

  const expected = Buffer.from(expectedHash, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const normalizeStoredAccount = (value: unknown): StoredAdminAccount | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = readString(item["id"]);
  const nome = readString(item["nome"]);
  const username = readString(item["username"]);
  const ruoloId = readString(item["ruoloId"]);
  if (!id || !nome || !username || !ruoloId) return null;

  const stato = item["stato"] === "sospeso" ? "sospeso" : "attivo";
  const passwordHash = readString(item["passwordHash"]);
  const legacyPassword = readString(item["password"]);

  return {
    id,
    nome,
    email: readString(item["email"]),
    username,
    passwordHash: passwordHash || (legacyPassword ? hashPassword(legacyPassword) : undefined),
    ruoloId,
    stato,
    mustChangePassword: Boolean(item["mustChangePassword"] ?? item["must_change_password"] ?? false),
  };
};

const normalizeStoredConfig = (value: unknown): StoredAccessConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_ACCESS_CONFIG;
  const item = value as Record<string, unknown>;
  const version = Number(item["securityProfileVersion"] ?? 0);
  const ruoli = Array.isArray(item["ruoli"]) ? item["ruoli"].map(normalizeRole).filter(Boolean) as AdminRole[] : [];
  const account = Array.isArray(item["account"])
    ? item["account"].map(normalizeStoredAccount).filter(Boolean) as StoredAdminAccount[]
    : [];

  return {
    securityProfileVersion: Number.isFinite(version) ? version : 0,
    ruoli: ruoli.length ? ruoli : DEFAULT_ACCESS_CONFIG.ruoli,
    account: account.length ? account : DEFAULT_ACCESS_CONFIG.account,
  };
};

const hasLegacyPlaintextPasswords = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const account = (value as Record<string, unknown>)["account"];
  return Array.isArray(account) && account.some((item) => (
    Boolean(item) &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    readString((item as Record<string, unknown>)["password"]) !== ""
  ));
};

const mergeDefaultAccessConfig = (config: StoredAccessConfig): StoredAccessConfig => {
  const defaultRoleIds = new Set(DEFAULT_ACCESS_CONFIG.ruoli.map((ruolo) => ruolo.id));
  const defaultAccountIds = new Set(DEFAULT_ACCESS_CONFIG.account.map((account) => account.id));
  const configuredRolesById = new Map(config.ruoli.map((ruolo) => [ruolo.id, ruolo]));
  const configuredAccountsById = new Map(config.account.map((account) => [account.id, account]));
  const configuredAccountsByUsername = new Map(config.account.map((account) => [account.username, account]));

  const customRoles = config.ruoli.filter((ruolo) =>
    !defaultRoleIds.has(ruolo.id) &&
    !LEGACY_DEFAULT_ROLE_IDS.has(ruolo.id),
  );
  const customAccounts = config.account.filter((account) =>
    !defaultAccountIds.has(account.id) &&
    !DEFAULT_ACCESS_CONFIG.account.some((defaultAccount) => defaultAccount.username === account.username) &&
    !LEGACY_DEFAULT_ACCOUNT_IDS.has(account.id) &&
    !LEGACY_DEFAULT_ACCOUNT_IDS.has(account.username),
  );

  return {
    securityProfileVersion: ACCESS_CONFIG_VERSION,
    ruoli: [
      ...DEFAULT_ACCESS_CONFIG.ruoli.map((defaultRole) => configuredRolesById.get(defaultRole.id) ?? defaultRole),
      ...customRoles,
    ],
    account: [
      ...DEFAULT_ACCESS_CONFIG.account.map((defaultAccount) =>
        configuredAccountsById.get(defaultAccount.id) ??
        configuredAccountsByUsername.get(defaultAccount.username) ??
        defaultAccount,
      ),
      ...customAccounts,
    ],
  };
};

type RolePermissionRow = {
  id: string;
  nome: string;
  descrizione: string | null;
  permission_id: string | null;
};

type AccountRow = {
  id: string;
  nome: string;
  email: string | null;
  username: string;
  password_hash: string;
  role_id: string;
  status: string;
  must_change_password: boolean;
  last_login_at: Date | null;
};

let accessStorePromise: Promise<void> | null = null;

const roleIsSystemDefault = (roleId: string) =>
  DEFAULT_ACCESS_CONFIG.ruoli.some((ruolo) => ruolo.id === roleId);

const validatePasswordPolicy = (password: string) => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`La password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("La password deve contenere almeno una lettera e un numero");
  }
};

const readAccessConfigFromDb = async (): Promise<StoredAccessConfig> => {
  const roleRows = await pool.query<RolePermissionRow>(`
    SELECT r.id, r.nome, r.descrizione, p.permission_id
    FROM admin_roles r
    LEFT JOIN admin_role_permissions p ON p.role_id = r.id
    ORDER BY r.created_at ASC, r.id ASC, p.permission_id ASC
  `);

  const rolesById = new Map<string, AdminRole>();
  const roleOrder: string[] = [];
  for (const row of roleRows.rows) {
    if (!rolesById.has(row.id)) {
      roleOrder.push(row.id);
      rolesById.set(row.id, {
        id: row.id,
        nome: row.nome,
        descrizione: row.descrizione ?? "",
        permessi: [],
      });
    }

    if (row.permission_id && PERMISSION_IDS.includes(row.permission_id as PermissionId)) {
      const role = rolesById.get(row.id);
      role?.permessi.push(row.permission_id as PermissionId);
    }
  }

  const accountRows = await pool.query<AccountRow>(`
    SELECT id, nome, email, username, password_hash, role_id, status, must_change_password, last_login_at
    FROM admin_accounts
    ORDER BY created_at ASC, id ASC
  `);

  return {
    securityProfileVersion: ACCESS_CONFIG_VERSION,
    ruoli: roleOrder.map((roleId) => rolesById.get(roleId)).filter(Boolean) as AdminRole[],
    account: accountRows.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      email: row.email ?? "",
      username: row.username,
      passwordHash: row.password_hash,
      ruoloId: row.role_id,
      stato: row.status === "sospeso" ? "sospeso" : "attivo",
      mustChangePassword: row.must_change_password,
      lastLoginAt: row.last_login_at,
    })),
  };
};

const loadLegacyAccessConfigFromSettings = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, ADMIN_ACCESS_KEY))
    .limit(1);

  return mergeDefaultAccessConfig(normalizeStoredConfig(settings?.value));
};

const writeAccessConfigToDb = async (config: StoredAccessConfig) => {
  const client = await pool.connect();
  const roleIds = config.ruoli.map((ruolo) => ruolo.id);
  const accountIds = config.account.map((accountItem) => accountItem.id);

  try {
    await client.query("BEGIN");

    for (const ruolo of config.ruoli) {
      await client.query(
        `
          INSERT INTO admin_roles (id, nome, descrizione, system, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            descrizione = EXCLUDED.descrizione,
            system = EXCLUDED.system,
            updated_at = NOW()
        `,
        [ruolo.id, ruolo.nome, ruolo.descrizione, roleIsSystemDefault(ruolo.id)],
      );
    }

    await client.query("DELETE FROM admin_accounts WHERE NOT (id = ANY($1::text[]))", [accountIds]);

    for (const accountItem of config.account) {
      await client.query(
        `
          INSERT INTO admin_accounts (
            id,
            nome,
            email,
            username,
            password_hash,
            role_id,
            status,
            must_change_password,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            email = EXCLUDED.email,
            username = EXCLUDED.username,
            password_hash = EXCLUDED.password_hash,
            role_id = EXCLUDED.role_id,
            status = EXCLUDED.status,
            must_change_password = EXCLUDED.must_change_password,
            updated_at = NOW()
        `,
        [
          accountItem.id,
          accountItem.nome,
          accountItem.email,
          accountItem.username,
          accountItem.passwordHash,
          accountItem.ruoloId,
          accountItem.stato,
          accountItem.mustChangePassword,
        ],
      );
    }

    await client.query("DELETE FROM admin_role_permissions WHERE role_id = ANY($1::text[])", [roleIds]);

    for (const ruolo of config.ruoli) {
      for (const permesso of ruolo.permessi) {
        await client.query(
          `
            INSERT INTO admin_role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [ruolo.id, permesso],
        );
      }
    }

    await client.query("DELETE FROM admin_roles WHERE NOT (id = ANY($1::text[]))", [roleIds]);
    await client.query(
      `
        INSERT INTO admin_settings (key, value, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `,
      [ADMIN_ACCESS_KEY, JSON.stringify(config)],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const ensureAccessStoreReady = async () => {
  if (!accessStorePromise) {
    accessStorePromise = (async () => {
      await ensureSecurityTables();
      const existingRoles = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_roles");
      if (Number(existingRoles.rows[0]?.count ?? "0") === 0) {
        await writeAccessConfigToDb(await loadLegacyAccessConfigFromSettings());
      }
    })().catch((err) => {
      accessStorePromise = null;
      throw err;
    });
  }

  return accessStorePromise;
};

export async function loadAccessConfig(): Promise<StoredAccessConfig> {
  await ensureAccessStoreReady();
  const config = await readAccessConfigFromDb();
  if (config.ruoli.length === 0 || config.account.length === 0) {
    const fallback = await loadLegacyAccessConfigFromSettings();
    await writeAccessConfigToDb(fallback);
    return readAccessConfigFromDb();
  }
  return config;
}

const toPublicAccessConfig = (config: StoredAccessConfig): PublicAccessConfig => ({
  ruoli: config.ruoli,
  account: config.account.map(({ passwordHash, password, ...account }) => ({
    ...account,
    password: "",
    hasPassword: Boolean(passwordHash || password),
  })),
});

export async function loadPublicAccessConfig(): Promise<PublicAccessConfig> {
  return toPublicAccessConfig(await loadAccessConfig());
}

export async function saveAccessConfig(input: unknown): Promise<PublicAccessConfig> {
  await ensureAccessStoreReady();
  const current = await loadAccessConfig();
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Configurazione account non valida");
  }

  const data = input as Record<string, unknown>;
  const incomingRoles = Array.isArray(data["ruoli"]) ? data["ruoli"].map(normalizeRole).filter(Boolean) as AdminRole[] : [];
  const incomingAccounts = Array.isArray(data["account"])
    ? data["account"].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];

  if (incomingRoles.length === 0) throw new Error("Almeno un ruolo e richiesto");

  const roleIds = new Set<string>();
  for (const role of incomingRoles) {
    if (roleIds.has(role.id)) throw new Error(`Ruolo duplicato: ${role.nome}`);
    roleIds.add(role.id);
  }

  const existingById = new Map(current.account.map((account) => [account.id, account]));
  const existingByUsername = new Map(current.account.map((account) => [account.username, account]));
  const seenUsernames = new Set<string>();

  const account: StoredAdminAccount[] = incomingAccounts.map((item) => {
    const id = readString(item["id"]) || `account-${readString(item["username"])}`;
    const nome = readString(item["nome"]);
    const username = readString(item["username"]);
    const ruoloId = readString(item["ruoloId"]);
    if (!id || !nome || !username || !ruoloId) {
      throw new Error("Account incompleto");
    }
    if (seenUsernames.has(username.toLocaleLowerCase("it-IT"))) {
      throw new Error(`Username duplicato: ${username}`);
    }
    seenUsernames.add(username.toLocaleLowerCase("it-IT"));

    const existing = existingById.get(id) ?? existingByUsername.get(username);
    const newPassword = readString(item["password"]);
    if (newPassword) validatePasswordPolicy(newPassword);
    const passwordHash = newPassword ? hashPassword(newPassword) : existing?.passwordHash;
    if (!passwordHash) {
      throw new Error(`Password mancante per ${username}`);
    }
    if (!roleIds.has(ruoloId)) {
      throw new Error(`Ruolo non valido per ${username}`);
    }

    return {
      id,
      nome,
      email: readString(item["email"]),
      username,
      passwordHash,
      ruoloId,
      stato: item["stato"] === "sospeso" ? "sospeso" : "attivo",
      mustChangePassword: existing
        ? newPassword
          ? true
          : Boolean(item["mustChangePassword"] ?? existing.mustChangePassword)
        : true,
    };
  });

  if (account.length === 0) throw new Error("Almeno un account e richiesto");

  const adminRoleIds = new Set(
    incomingRoles.filter((role) => role.permessi.includes("admin")).map((role) => role.id),
  );
  if (adminRoleIds.size === 0) {
    throw new Error("Deve esistere almeno un ruolo amministratore");
  }
  if (!account.some((item) => item.stato === "attivo" && adminRoleIds.has(item.ruoloId))) {
    throw new Error("Deve restare almeno un account amministratore attivo");
  }

  const next: StoredAccessConfig = {
    securityProfileVersion: ACCESS_CONFIG_VERSION,
    ruoli: incomingRoles,
    account,
  };
  await writeAccessConfigToDb(next);

  return toPublicAccessConfig(await readAccessConfigFromDb());
}

const getAuthSecret = () =>
  readString(process.env["AUTH_SECRET"]) ||
  readString(process.env["SESSION_SECRET"]) ||
  readString(process.env["SUPABASE_SERVICE_ROLE_KEY"]) ||
  readString(process.env["DATABASE_URL"]) ||
  (process.env["NODE_ENV"] === "production" ? "" : "mmedical-dev-session-secret");

const sign = (payload: string) => createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");

const encodeToken = (session: AuthSession) => {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(session));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
};

const decodeToken = (token: string): AuthSession | null => {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  if (!getAuthSecret()) return null;
  const unsigned = `${header}.${payload}`;
  const expected = sign(unsigned);
  const expectedBuffer = Buffer.from(expected, "base64url");
  const actualBuffer = Buffer.from(signature, "base64url");
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
    if (!parsed || typeof parsed !== "object" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      ...parsed,
      permissions: readPermissions(parsed.permissions),
      mustChangePassword: Boolean(parsed.mustChangePassword),
    };
  } catch {
    return null;
  }
};

const tokenFromRequest = (req: Request) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();
  const cookies = req.cookies as Record<string, unknown> | undefined;
  return readString(cookies?.[SESSION_COOKIE_NAME]);
};

const AGGREGATE_PERMISSION_VARIANTS: Partial<Record<PermissionId, PermissionId[]>> = {
  "laboratorio.accettazione": [
    "laboratorio.accettazione.modena",
    "laboratorio.accettazione.sassuolo",
  ],
  "laboratorio.agenda": [
    "laboratorio.agenda.modena",
    "laboratorio.agenda.sassuolo",
  ],
  "ambulatorio.accettazione": [
    "ambulatorio.accettazione.modena",
    "ambulatorio.accettazione.sassuolo",
  ],
  "ambulatorio.agenda": [
    "ambulatorio.agenda.modena",
    "ambulatorio.agenda.sassuolo",
  ],
};

const SEDE_PERMISSION_BY_BASE: Record<SedeScopedPermissionBase, Record<SedeId, PermissionId>> = {
  "laboratorio.accettazione": {
    modena: "laboratorio.accettazione.modena",
    sassuolo: "laboratorio.accettazione.sassuolo",
  },
  "laboratorio.agenda": {
    modena: "laboratorio.agenda.modena",
    sassuolo: "laboratorio.agenda.sassuolo",
  },
  "ambulatorio.accettazione": {
    modena: "ambulatorio.accettazione.modena",
    sassuolo: "ambulatorio.accettazione.sassuolo",
  },
  "ambulatorio.agenda": {
    modena: "ambulatorio.agenda.modena",
    sassuolo: "ambulatorio.agenda.sassuolo",
  },
  cassa: {
    modena: "cassa.modena",
    sassuolo: "cassa.sassuolo",
  },
};

const readRequestPermissions = (req: Request) => req.auth?.permissions ?? [];

export const hasGlobalPermission = (req: Request, permission: PermissionId) => {
  const permissions = readRequestPermissions(req);
  return permissions.includes("admin") || permissions.includes(permission);
};

export const normalizeSedeId = (value: unknown): SedeId | null => {
  const normalized = readString(value).toLocaleLowerCase("it-IT");
  if (normalized === "modena" || normalized === "sassuolo") return normalized;
  return null;
};

export const allowedSediForPermission = (
  req: Request,
  permission: SedeScopedPermissionBase,
): SedeId[] => {
  if (hasGlobalPermission(req, permission)) return SEDI;
  const bySede = SEDE_PERMISSION_BY_BASE[permission];
  return SEDI.filter((sede) => hasGlobalPermission(req, bySede[sede]));
};

export const canAccessSedeForPermission = (
  req: Request,
  permission: SedeScopedPermissionBase,
  sede: unknown,
) => {
  const normalized = normalizeSedeId(sede);
  if (!normalized) return hasGlobalPermission(req, permission);
  return hasGlobalPermission(req, permission) || hasGlobalPermission(req, SEDE_PERMISSION_BY_BASE[permission][normalized]);
};

const buildSessionForAccount = (
  account: StoredAdminAccount,
  role: AdminRole | undefined,
  bounds?: Pick<AuthSession, "iat" | "exp">,
): AuthSession => {
  const now = Math.floor(Date.now() / 1000);
  return {
    accountId: account.id,
    username: account.username,
    nome: account.nome,
    roleId: account.ruoloId,
    roleName: role?.nome ?? account.ruoloId,
    permissions: role?.permessi ?? [],
    mustChangePassword: account.mustChangePassword,
    iat: bounds?.iat ?? now,
    exp: bounds?.exp ?? now + Math.max(60, SESSION_TTL_SECONDS),
  };
};

export const createSessionForAccount = async (account: StoredAdminAccount): Promise<AuthSession> => {
  const config = await loadAccessConfig();
  const role = config.ruoli.find((item) => item.id === account.ruoloId);
  return buildSessionForAccount(account, role);
};

const createLiveSessionFromToken = async (decoded: AuthSession): Promise<AuthSession | null> => {
  const config = await loadAccessConfig();
  const account = config.account.find(
    (item) => item.id === decoded.accountId && item.username === decoded.username && item.stato === "attivo",
  );
  if (!account) return null;
  const role = config.ruoli.find((item) => item.id === account.ruoloId);
  return buildSessionForAccount(account, role, { iat: decoded.iat, exp: decoded.exp });
};

export const setSessionCookie = (res: Response, session: AuthSession) => {
  res.cookie(SESSION_COOKIE_NAME, encodeToken(session), {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, SESSION_TTL_SECONDS) * 1000,
  });
};

export const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
  });
};

export const loginWithPassword = async (username: string, password: string) => {
  const config = await loadAccessConfig();
  const normalizedUsername = username.trim().toLocaleLowerCase("it-IT");
  const account = config.account.find(
    (item) => item.username.toLocaleLowerCase("it-IT") === normalizedUsername && item.stato === "attivo",
  );

  if (!account || !verifyPassword(password, account.passwordHash)) return null;
  void pool.query("UPDATE admin_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1", [account.id])
    .catch(() => undefined);
  return account;
};

const isAllowedBeforePasswordChange = (req: Request) => {
  const path = (req.originalUrl || req.url || req.path).split("?")[0] ?? "";
  return (
    path.endsWith("/auth/me") ||
    path.endsWith("/auth/logout") ||
    path.endsWith("/auth/change-password")
  );
};

export const changeOwnPassword = async (
  session: AuthSession,
  currentPassword: string,
  newPassword: string,
) => {
  const cleanCurrentPassword = typeof currentPassword === "string" ? currentPassword : "";
  const cleanNewPassword = readString(newPassword);
  validatePasswordPolicy(cleanNewPassword);

  const config = await loadAccessConfig();
  const account = config.account.find((item) => item.id === session.accountId && item.stato === "attivo");
  if (!account || !verifyPassword(cleanCurrentPassword, account.passwordHash)) {
    throw new Error("Password attuale non corretta");
  }
  if (verifyPassword(cleanNewPassword, account.passwordHash)) {
    throw new Error("La nuova password deve essere diversa da quella attuale");
  }

  const passwordHash = hashPassword(cleanNewPassword);
  await pool.query(
    `
      UPDATE admin_accounts
      SET password_hash = $1,
          must_change_password = FALSE,
          updated_at = NOW()
      WHERE id = $2
    `,
    [passwordHash, account.id],
  );

  return createSessionForAccount({
    ...account,
    passwordHash,
    mustChangePassword: false,
  });
};

export const requireAuth: RequestHandler = async (req, res, next) => {
  const decoded = decodeToken(tokenFromRequest(req));
  if (!decoded) {
    res.status(401).json({ error: "Accesso richiesto" });
    return;
  }

  try {
    const session = await createLiveSessionFromToken(decoded);
    if (!session) {
      clearSessionCookie(res);
      res.status(401).json({ error: "Sessione non valida o account sospeso" });
      return;
    }
    if (session.mustChangePassword && !isAllowedBeforePasswordChange(req)) {
      res.status(403).json({
        error: "Cambio password richiesto prima di continuare",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
      return;
    }

    req.auth = session;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAnyPermission = (permissions: PermissionId[]): RequestHandler => (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  requireAuth(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    if (permissions.some((permission) => hasPermission(req, permission))) {
      next();
      return;
    }
    res.status(403).json({ error: "Permesso insufficiente" });
  });
};

export const hasPermission = (req: Request, permission: PermissionId) => {
  if (hasGlobalPermission(req, permission)) return true;
  if (permission === "cassa.modena") return hasGlobalPermission(req, "cassa");
  if (permission === "cassa.sassuolo") return hasGlobalPermission(req, "cassa");
  return AGGREGATE_PERMISSION_VARIANTS[permission]?.some((variant) => hasGlobalPermission(req, variant)) ?? false;
};

export const publicSession = (session: AuthSession) => ({
  accountId: session.accountId,
  username: session.username,
  nome: session.nome,
  roleId: session.roleId,
  roleName: session.roleName,
  permissions: session.permissions,
  mustChangePassword: session.mustChangePassword,
  expiresAt: new Date(session.exp * 1000).toISOString(),
});

const loginKey = (req: Request, username: string) =>
  `${req.ip ?? "unknown"}:${username.trim().toLocaleLowerCase("it-IT")}`;

export const isLoginRateLimited = (req: Request, username: string) => {
  const now = Date.now();
  const key = loginKey(req, username);
  const current = loginFailures.get(key);
  if (!current || current.resetAt <= now) return false;
  return current.count >= LOGIN_MAX_FAILURES;
};

export const recordLoginResult = (req: Request, username: string, success: boolean) => {
  const key = loginKey(req, username);
  if (success) {
    loginFailures.delete(key);
    return;
  }

  const now = Date.now();
  const current = loginFailures.get(key);
  if (!current || current.resetAt <= now) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  loginFailures.set(key, { ...current, count: current.count + 1 });
};
