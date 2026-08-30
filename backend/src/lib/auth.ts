import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { eq } from "drizzle-orm";
import { adminSettingsTable, db } from "@workspace/db";

export type PermissionId =
  | "laboratorio.accettazione"
  | "laboratorio.agenda"
  | "laboratorio.listino"
  | "ambulatorio.accettazione"
  | "ambulatorio.agenda"
  | "ambulatorio.prestazioni"
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
export const SESSION_COOKIE_NAME = "mmedical_session";
const SESSION_TTL_SECONDS = Number(process.env["AUTH_SESSION_TTL_SECONDS"] ?? 8 * 60 * 60);
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = Number(process.env["AUTH_LOGIN_MAX_FAILURES"] ?? 10);

const PERMISSION_IDS: PermissionId[] = [
  "laboratorio.accettazione",
  "laboratorio.agenda",
  "laboratorio.listino",
  "ambulatorio.accettazione",
  "ambulatorio.agenda",
  "ambulatorio.prestazioni",
  "anagrafiche",
  "infortunistica",
  "cassa",
  "cassa.modena",
  "cassa.sassuolo",
  "impostazioni",
  "utenti",
];

const SEGRETERIA_PERMESSI = PERMISSION_IDS.filter((permesso) => permesso !== "laboratorio.agenda");

const RUOLI_DEFAULT_FORZATI = new Set([
  "segreteria",
  "laboratorio",
  "avvocato",
  "segreteria-modena",
  "segreteria-sassuolo",
]);

const DEFAULT_ACCESS_CONFIG: StoredAccessConfig = {
  ruoli: [
    {
      id: "segreteria",
      nome: "Segreteria",
      descrizione: "Gestione operativa completa dello studio.",
      permessi: SEGRETERIA_PERMESSI,
    },
    {
      id: "laboratorio",
      nome: "Laboratorio",
      descrizione: "Area laboratorio e refertazione operativa.",
      permessi: ["laboratorio.accettazione", "laboratorio.listino", "anagrafiche"],
    },
    {
      id: "medico",
      nome: "Medico",
      descrizione: "Accesso alla sola agenda/prestazioni assegnate.",
      permessi: ["ambulatorio.agenda"],
    },
    {
      id: "avvocato",
      nome: "Avvocato",
      descrizione: "Accesso limitato ai sinistri, clienti infortunistica e documenti.",
      permessi: ["infortunistica"],
    },
    {
      id: "amministrazione",
      nome: "Amministrazione",
      descrizione: "Gestione amministrativa e impostazioni.",
      permessi: ["anagrafiche", "infortunistica", "cassa", "impostazioni"],
    },
    {
      id: "segreteria-modena",
      nome: "Segreteria Modena",
      descrizione: "Accesso limitato alla sola cassa della sede di Modena.",
      permessi: ["cassa.modena"],
    },
    {
      id: "segreteria-sassuolo",
      nome: "Segreteria Sassuolo",
      descrizione: "Accesso limitato alla sola cassa della sede di Sassuolo.",
      permessi: ["cassa.sassuolo"],
    },
    {
      id: "admin",
      nome: "Amministratore",
      descrizione: "Accesso tecnico completo.",
      permessi: PERMISSION_IDS,
    },
  ],
  account: [
    {
      id: "segreteria",
      nome: "Segreteria",
      email: "segreteria@mmedical.local",
      username: "segreteria",
      passwordHash: "scrypt$aRtcc40wpLDTaHMizImCJw$0adBqdZjsSF53EGWFA29mWJo-FVgkYEWfZjIN6d6w7o",
      ruoloId: "segreteria",
      stato: "attivo",
    },
    {
      id: "laboratorio",
      nome: "Laboratorio",
      email: "laboratorio@mmedical.local",
      username: "laboratorio",
      passwordHash: "scrypt$MVNibxzOAy_1t5H1H6Mg0A$GUS5p2WJ8mSu6h0u1goQvkzOfbGT6q0ngOj_p92Elnw",
      ruoloId: "laboratorio",
      stato: "attivo",
    },
    {
      id: "avvocato",
      nome: "Avvocato",
      email: "avvocato@mmedical.local",
      username: "avvocato",
      passwordHash: "scrypt$WJljZDUgZddw36Jn4_HTOw$6aEv5q_XGPZzRvDWDLU8D4c2Rb5UvvHMlXYz85jHpC0",
      ruoloId: "avvocato",
      stato: "attivo",
    },
    {
      id: "segreteria-modena",
      nome: "Segreteria Modena",
      email: "segreteria.modena@mmedical.local",
      username: "segreteria-modena",
      passwordHash: "scrypt$1HE-1zG-xq5MJ0h63TDCvg$T23SlhUe1K_WA73TXmEcOcstdwvovVLOn-4i2_VVvHQ",
      ruoloId: "segreteria-modena",
      stato: "attivo",
    },
    {
      id: "segreteria-sassuolo",
      nome: "Segreteria Sassuolo",
      email: "segreteria.sassuolo@mmedical.local",
      username: "segreteria-sassuolo",
      passwordHash: "scrypt$Ne9B1anN07aFKj7clXvP8w$r7Rh6HCWY4qBbUf_e3CefPSUzeuqgjSkphRg4LmTFlA",
      ruoloId: "segreteria-sassuolo",
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
  const ruoli = Array.isArray(item["ruoli"]) ? item["ruoli"].map(normalizeRole).filter(Boolean) as AdminRole[] : [];
  const account = Array.isArray(item["account"])
    ? item["account"].map(normalizeStoredAccount).filter(Boolean) as StoredAdminAccount[]
    : [];

  return {
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
  const ruoli = [...config.ruoli];
  DEFAULT_ACCESS_CONFIG.ruoli.forEach((ruoloDefault) => {
    const existingIndex = ruoli.findIndex((ruolo) => ruolo.id === ruoloDefault.id);
    if (existingIndex === -1) {
      ruoli.push(ruoloDefault);
      return;
    }

    ruoli[existingIndex] = {
      ...ruoli[existingIndex],
      descrizione: RUOLI_DEFAULT_FORZATI.has(ruoloDefault.id)
        ? ruoloDefault.descrizione
        : ruoli[existingIndex].descrizione,
      permessi: RUOLI_DEFAULT_FORZATI.has(ruoloDefault.id)
        ? ruoloDefault.permessi
        : Array.from(new Set([...ruoli[existingIndex].permessi, ...ruoloDefault.permessi])),
    };
  });

  const account = [...config.account];
  DEFAULT_ACCESS_CONFIG.account.forEach((accountDefault) => {
    const existingIndex = account.findIndex(
      (item) => item.id === accountDefault.id || item.username === accountDefault.username,
    );

    if (existingIndex === -1) {
      account.push(accountDefault);
      return;
    }

    if (accountDefault.id === "avvocato") {
      account[existingIndex] = {
        ...account[existingIndex],
        nome: accountDefault.nome,
        email: account[existingIndex].email || accountDefault.email,
        username: accountDefault.username,
        ruoloId: accountDefault.ruoloId,
        stato: "attivo",
      };
    }
  });

  return { ruoli, account };
};

export async function loadAccessConfig(): Promise<StoredAccessConfig> {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, ADMIN_ACCESS_KEY))
    .limit(1);

  const config = mergeDefaultAccessConfig(normalizeStoredConfig(settings?.value));
  if (settings && hasLegacyPlaintextPasswords(settings.value)) {
    await db
      .update(adminSettingsTable)
      .set({ value: config, updatedAt: new Date() })
      .where(eq(adminSettingsTable.key, ADMIN_ACCESS_KEY));
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
  const permissions = req.auth?.permissions ?? [];
  if (permissions.includes("utenti") && permission === "utenti") return true;
  if (permission === "cassa.modena") return permissions.includes("cassa") || permissions.includes("cassa.modena");
  if (permission === "cassa.sassuolo") return permissions.includes("cassa") || permissions.includes("cassa.sassuolo");
  return permissions.includes(permission);
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
