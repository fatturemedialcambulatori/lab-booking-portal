import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { eq } from "drizzle-orm";
import { adminSettingsTable, db } from "@workspace/db";

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
    },
    {
      id: "segreteria-modena",
      nome: "Segreteria Modena",
      email: "segreteria.modena@mmedical.local",
      username: "segreteria-modena",
      passwordHash: DEFAULT_SEGRETERIA_PASSWORD_HASH,
      ruoloId: "segreteria-modena",
      stato: "attivo",
    },
    {
      id: "segreteria-sassuolo",
      nome: "Segreteria Sassuolo",
      email: "segreteria.sassuolo@mmedical.local",
      username: "segreteria-sassuolo",
      passwordHash: DEFAULT_SEGRETERIA_PASSWORD_HASH,
      ruoloId: "segreteria-sassuolo",
      stato: "attivo",
    },
    {
      id: "laboratorio-modena",
      nome: "Laboratorio Modena",
      email: "laboratorio.modena@mmedical.local",
      username: "laboratorio-modena",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "laboratorio-modena",
      stato: "attivo",
    },
    {
      id: "laboratorio-sassuolo",
      nome: "Laboratorio Sassuolo",
      email: "laboratorio.sassuolo@mmedical.local",
      username: "laboratorio-sassuolo",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "laboratorio-sassuolo",
      stato: "attivo",
    },
    {
      id: "ambulatorio-modena",
      nome: "Ambulatorio Modena",
      email: "ambulatorio.modena@mmedical.local",
      username: "ambulatorio-modena",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "ambulatorio-modena",
      stato: "attivo",
    },
    {
      id: "ambulatorio-sassuolo",
      nome: "Ambulatorio Sassuolo",
      email: "ambulatorio.sassuolo@mmedical.local",
      username: "ambulatorio-sassuolo",
      passwordHash: DEFAULT_OPERATIVO_PASSWORD_HASH,
      ruoloId: "ambulatorio-sassuolo",
      stato: "attivo",
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
  const defaultUsernames = new Set(DEFAULT_ACCESS_CONFIG.account.map((account) => account.username));

  const customRoles = config.ruoli.filter((ruolo) =>
    !defaultRoleIds.has(ruolo.id) &&
    !LEGACY_DEFAULT_ROLE_IDS.has(ruolo.id),
  );
  const customAccounts = config.account.filter((account) =>
    !defaultAccountIds.has(account.id) &&
    !defaultUsernames.has(account.username) &&
    !LEGACY_DEFAULT_ACCOUNT_IDS.has(account.id) &&
    !LEGACY_DEFAULT_ACCOUNT_IDS.has(account.username),
  );

  return {
    securityProfileVersion: ACCESS_CONFIG_VERSION,
    ruoli: [...DEFAULT_ACCESS_CONFIG.ruoli, ...customRoles],
    account: [...DEFAULT_ACCESS_CONFIG.account, ...customAccounts],
  };
};

export async function loadAccessConfig(): Promise<StoredAccessConfig> {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, ADMIN_ACCESS_KEY))
    .limit(1);

  const normalized = normalizeStoredConfig(settings?.value);
  const config = mergeDefaultAccessConfig(normalized);
  if (!settings || normalized.securityProfileVersion !== ACCESS_CONFIG_VERSION || hasLegacyPlaintextPasswords(settings.value)) {
    await db
      .insert(adminSettingsTable)
      .values({ key: ADMIN_ACCESS_KEY, value: config, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set: { value: config, updatedAt: new Date() },
      });
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
    const passwordHash = newPassword ? hashPassword(newPassword) : existing?.passwordHash;
    if (!passwordHash) {
      throw new Error(`Password mancante per ${username}`);
    }

    return {
      id,
      nome,
      email: readString(item["email"]),
      username,
      passwordHash,
      ruoloId,
      stato: item["stato"] === "sospeso" ? "sospeso" : "attivo",
    };
  });

  if (account.length === 0) throw new Error("Almeno un account e richiesto");

  const next = mergeDefaultAccessConfig({ ruoli: incomingRoles, account });
  const now = new Date();
  const [saved] = await db
    .insert(adminSettingsTable)
    .values({ key: ADMIN_ACCESS_KEY, value: next, updatedAt: now })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: { value: next, updatedAt: now },
    })
    .returning();

  return toPublicAccessConfig(saved.value as StoredAccessConfig);
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

export const createSessionForAccount = async (account: StoredAdminAccount): Promise<AuthSession> => {
  const config = await loadAccessConfig();
  const role = config.ruoli.find((item) => item.id === account.ruoloId);
  const now = Math.floor(Date.now() / 1000);
  return {
    accountId: account.id,
    username: account.username,
    nome: account.nome,
    roleId: account.ruoloId,
    roleName: role?.nome ?? account.ruoloId,
    permissions: role?.permessi ?? [],
    iat: now,
    exp: now + Math.max(60, SESSION_TTL_SECONDS),
  };
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
  return account;
};

export const requireAuth: RequestHandler = (req, res, next) => {
  const session = decodeToken(tokenFromRequest(req));
  if (!session) {
    res.status(401).json({ error: "Accesso richiesto" });
    return;
  }
  req.auth = session;
  next();
};

export const requireAnyPermission = (permissions: PermissionId[]): RequestHandler => (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  requireAuth(req, res, () => {
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
