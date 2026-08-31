import { eq } from "drizzle-orm";
import { adminSettingsTable, db } from "@workspace/db";
import { logger } from "./logger";

export type ArubaFatturazioneEnvironment = "demo" | "production";
export type ArubaInvoiceDirection = "out" | "in";

type ArubaFatturazioneConfig = {
  environment: ArubaFatturazioneEnvironment;
  authBaseUrl: string;
  wsBaseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
  senderCountry: string;
  senderVatcode: string;
  receiverCountry: string;
  receiverVatcode: string;
  syncDelayMs: number;
  configured: boolean;
  missing: string[];
};

type ArubaTokenCache = {
  cacheKey: string;
  accessToken: string;
  expiresAtMs: number;
};

type ArubaTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type ArubaInvoiceCompany = {
  description?: string;
  countryCode?: string;
  vatCode?: string;
  fiscalCode?: string;
};

type ArubaInvoiceLine = {
  invoiceDate?: string;
  number?: string;
  documentType?: string;
  status?: string;
  statusDescription?: string;
  totalDocument?: number | string;
  totalVat?: number | string;
  netPayable?: number | string;
};

type ArubaInvoiceLot = {
  id?: string;
  idSdi?: string;
  filename?: string;
  docType?: string;
  creationDate?: string;
  lastUpdate?: string;
  pddAvailable?: boolean;
  sender?: ArubaInvoiceCompany;
  receiver?: ArubaInvoiceCompany;
  invoices?: ArubaInvoiceLine[];
};

type ArubaInvoicePage = {
  content?: ArubaInvoiceLot[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
  first?: boolean;
  last?: boolean;
};

export type ArubaInvoiceSearchInput = {
  direction: ArubaInvoiceDirection;
  page?: unknown;
  size?: unknown;
  creationStartDate?: unknown;
  creationEndDate?: unknown;
  status?: unknown;
  documentType?: unknown;
};

export type ArubaInvoiceCacheRecord = {
  cacheId: string;
  direction: ArubaInvoiceDirection;
  id?: string;
  idSdi?: string;
  filename?: string;
  docType?: string;
  creationDate?: string;
  lastUpdate?: string;
  pddAvailable?: boolean;
  invoiceDate?: string;
  number?: string;
  documentType?: string;
  status?: string;
  statusDescription?: string;
  totalDocument?: number;
  totalVat?: number;
  netPayable?: number;
  counterpartyName?: string;
  counterpartyCountry?: string;
  counterpartyVatCode?: string;
  counterpartyFiscalCode?: string;
  syncedAt: string;
};

type ArubaInvoiceCacheState = {
  version: 1;
  updatedAt?: string;
  invoices: ArubaInvoiceCacheRecord[];
  lastSync?: ArubaInvoiceSyncState;
};

export type ArubaInvoiceSyncState = {
  id: string;
  direction: ArubaInvoiceDirection;
  status: "idle" | "running" | "completed" | "failed";
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  creationStartDate: string;
  creationEndDate: string;
  totalWindows: number;
  completedWindows: number;
  totalProviderRequests: number;
  importedCount: number;
  error?: string;
  providerStatus?: number;
  retryAfterSeconds?: number;
};

export type ArubaInvoiceSyncInput = {
  direction: ArubaInvoiceDirection;
  creationStartDate?: unknown;
  creationEndDate?: unknown;
  size?: unknown;
};

export class ArubaFatturazioneError extends Error {
  readonly statusCode: number;
  readonly providerStatus?: number;
  readonly providerMessage?: string;
  readonly operation?: string;
  readonly hint?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    statusCode: number,
    message: string,
    providerStatus?: number,
    options: { providerMessage?: string; operation?: string; hint?: string; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "ArubaFatturazioneError";
    this.statusCode = statusCode;
    this.providerStatus = providerStatus;
    this.providerMessage = options.providerMessage;
    this.operation = options.operation;
    this.hint = options.hint;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

const DEMO_AUTH_BASE_URL = "https://demoauth.fatturazioneelettronica.aruba.it";
const DEMO_WS_BASE_URL = "https://demows.fatturazioneelettronica.aruba.it";
const PRODUCTION_AUTH_BASE_URL = "https://auth.fatturazioneelettronica.aruba.it";
const PRODUCTION_WS_BASE_URL = "https://ws.fatturazioneelettronica.aruba.it";
const TOKEN_REFRESH_SAFETY_MS = 60_000;
const MAX_INVOICE_SEARCH_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const INVOICE_CACHE_KEY = "aruba-fatturazione-cache-v1";
const SYNC_WINDOW_DAYS = 2;
const MAX_SYNC_RANGE_DAYS = 370;
const DEFAULT_SYNC_DELAY_MS = 5_500;
const SENSITIVE_PAYLOAD_KEYS = new Set([
  "access_token",
  "refresh_token",
  "file",
  "pdfFile",
  "dataFile",
  "password",
]);

let tokenCache: ArubaTokenCache | null = null;
let tokenRefreshInFlight: { cacheKey: string; promise: Promise<string> } | null = null;
let providerCooldownUntilMs = 0;
let currentSyncJob: ArubaInvoiceSyncState | null = null;

const cleanEnv = (value: string | undefined) => value?.trim().replace(/^(['"])(.*)\1$/, "$2") ?? "";

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = cleanEnv(process.env[key]);
    if (value) return value;
  }
  return "";
};

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const readInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizeEnvironment = (value: string): ArubaFatturazioneEnvironment =>
  value.toLocaleLowerCase("it-IT") === "production" ? "production" : "demo";

const inferEnvironment = (explicit: string, authBaseUrl: string, wsBaseUrl: string) => {
  if (explicit) return normalizeEnvironment(explicit);
  const combinedUrls = `${authBaseUrl} ${wsBaseUrl}`.toLocaleLowerCase("it-IT");
  if (combinedUrls.includes("demo")) return "demo";
  if (combinedUrls.includes("fatturazioneelettronica.aruba.it")) return "production";
  return "demo";
};

const defaultAuthBaseUrl = (environment: ArubaFatturazioneEnvironment) =>
  environment === "production" ? PRODUCTION_AUTH_BASE_URL : DEMO_AUTH_BASE_URL;

const defaultWsBaseUrl = (environment: ArubaFatturazioneEnvironment) =>
  environment === "production" ? PRODUCTION_WS_BASE_URL : DEMO_WS_BASE_URL;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getConfig = (): ArubaFatturazioneConfig => {
  const explicitAuthBaseUrl = readEnv("ARUBA_FE_AUTH_BASE_URL", "ARUBA_FE_AUTH_URL");
  const explicitWsBaseUrl = readEnv("ARUBA_FE_WS_BASE_URL", "ARUBA_FE_API_URL");
  const environment = inferEnvironment(
    readEnv("ARUBA_FE_ENVIRONMENT"),
    explicitAuthBaseUrl,
    explicitWsBaseUrl,
  );
  const username = readEnv("ARUBA_FE_USERNAME");
  const password = readEnv("ARUBA_FE_PASSWORD");
  const missing = [
    ["ARUBA_FE_USERNAME", username],
    ["ARUBA_FE_PASSWORD", password],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    environment,
    authBaseUrl: trimTrailingSlash(explicitAuthBaseUrl || defaultAuthBaseUrl(environment)),
    wsBaseUrl: trimTrailingSlash(explicitWsBaseUrl || defaultWsBaseUrl(environment)),
    username,
    password,
    timeoutMs: readInteger(readEnv("ARUBA_FE_TIMEOUT_MS"), 10_000, 1_000, 30_000),
    senderCountry: readEnv("ARUBA_FE_SENDER_COUNTRY") || "IT",
    senderVatcode: readEnv("ARUBA_FE_SENDER_VATCODE", "ARUBA_FE_SENDER_PIVA"),
    receiverCountry: readEnv("ARUBA_FE_RECEIVER_COUNTRY") || "IT",
    receiverVatcode: readEnv("ARUBA_FE_RECEIVER_VATCODE", "ARUBA_FE_RECEIVER_PIVA"),
    syncDelayMs: readInteger(readEnv("ARUBA_FE_SYNC_DELAY_MS"), DEFAULT_SYNC_DELAY_MS, 1_000, 60_000),
    configured: missing.length === 0,
    missing,
  };
};

export const getArubaFatturazioneStatus = () => {
  const config = getConfig();

  return {
    provider: "aruba-fatturazione-elettronica",
    configured: config.configured,
    missing: config.missing,
    environment: config.environment,
    readOnly: true,
    authBaseUrl: config.authBaseUrl,
    wsBaseUrl: config.wsBaseUrl,
    usernameConfigured: Boolean(config.username),
    senderVatConfigured: Boolean(config.senderVatcode),
    receiverVatConfigured: Boolean(config.receiverVatcode),
    limits: {
      authPerIp: "1/min",
      invoiceSearchPerIp: "12/min",
      maxInvoiceSearchWindowDays: 2,
    },
    capabilities: {
      userInfo: true,
      cedenti: true,
      invoicesOut: true,
      invoicesIn: true,
      createInvoice: false,
      createCreditNote: false,
      downloadFiles: false,
    },
  };
};

const assertConfigured = (config: ArubaFatturazioneConfig) => {
  if (!config.configured) {
    throw new ArubaFatturazioneError(503, "Integrazione Aruba non configurata");
  }
};

const cacheKeyForConfig = (config: ArubaFatturazioneConfig) =>
  `${config.environment}:${config.authBaseUrl}:${config.username}`;

const withTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ArubaFatturazioneError(504, "Timeout durante la chiamata ad Aruba");
    }
    throw new ArubaFatturazioneError(502, "Errore di connessione verso Aruba");
  } finally {
    clearTimeout(timeout);
  }
};

const retryAfterSecondsFromHeader = (value: string | null) => {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 300);

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.min(300, Math.max(1, Math.ceil((dateMs - Date.now()) / 1000)));
  }

  return null;
};

const cooldownSecondsRemaining = () =>
  providerCooldownUntilMs > Date.now() ? Math.ceil((providerCooldownUntilMs - Date.now()) / 1000) : 0;

const assertNoProviderCooldown = (operation: string) => {
  const retryAfterSeconds = cooldownSecondsRemaining();
  if (retryAfterSeconds <= 0) return;

  throw new ArubaFatturazioneError(
    429,
    "Limite chiamate Aruba attivo",
    429,
    {
      operation,
      retryAfterSeconds,
      hint: `Attendi circa ${retryAfterSeconds} secondi prima di riprovare.`,
    },
  );
};

const sanitizeProviderMessage = (value: unknown) => {
  const cleaned = readString(value).replace(/\s+/g, " ");
  return cleaned.slice(0, 240);
};

const providerMessageFromPayload = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const payload = sanitizeProviderPayload(value) as Record<string, unknown>;
  const candidates = [
    payload["error_description"],
    payload["errorDescription"],
    payload["message"],
    payload["error"],
    payload["title"],
    payload["detail"],
  ];
  return candidates.map(sanitizeProviderMessage).find(Boolean);
};

const parseProviderPayload = (text: string) => {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return sanitizeProviderMessage(text);
  }
};

const isCredentialProviderMessage = (message: string | undefined) =>
  Boolean(message?.toLocaleLowerCase("it-IT").match(/user name|username|password|credential|credenzial/));

const arubaErrorMessage = (status: number, operation: string, providerMessage?: string) => {
  if ((status === 400 || status === 401) && isCredentialProviderMessage(providerMessage)) {
    return "Credenziali Aruba non valide o ambiente Aruba errato";
  }
  if (status === 400) return "Richiesta Aruba non valida";
  if (status === 401) return "Credenziali Aruba non valide o ambiente Aruba errato";
  if (status === 403) return "Utenza Aruba senza permessi per questa consultazione";
  if (status === 404) return "Risorsa Aruba non trovata";
  if (status === 413) return "Risposta o richiesta Aruba troppo grande";
  if (status === 429) return "Limite chiamate Aruba superato";
  if (status >= 500) return "Servizio Aruba temporaneamente non disponibile";
  return `${operation}: Aruba ha rifiutato o non ha completato la richiesta`;
};

const arubaErrorHint = (
  status: number,
  operation: string,
  retryAfterSeconds?: number,
  providerMessage?: string,
) => {
  if ((status === 400 || status === 401) && isCredentialProviderMessage(providerMessage)) {
    return "Controlla ambiente demo/produzione, username e password Aruba configurati nel backend.";
  }
  if (status === 400 && operation.includes("fatture")) {
    return "Controlla intervallo date, ambiente e Partita IVA mittente/destinatario configurata nel backend.";
  }
  if (status === 400) return "Controlla i parametri inviati e la configurazione Aruba nel backend.";
  if (status === 401) return "Controlla ARUBA_FE_ENVIRONMENT, username e password Aruba. Demo e produzione usano credenziali e host separati.";
  if (status === 403) return "Verifica che l'utenza Aruba abbia accesso API alla funzione richiesta.";
  if (status === 429) {
    return retryAfterSeconds
      ? `Attendi circa ${retryAfterSeconds} secondi prima di riprovare: Aruba limita login e ricerche per IP.`
      : "Attendi almeno un minuto prima di riprovare: Aruba limita login e ricerche per IP.";
  }
  if (status >= 500) return "Riprova piu tardi o verifica lo stato del servizio Aruba.";
  return undefined;
};

const fetchJson = async <T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  operation: string,
): Promise<T> => {
  assertNoProviderCooldown(operation);
  const response = await withTimeout(url, init, timeoutMs);
  const text = await response.text();

  if (!response.ok) {
    const retryAfterSeconds = response.status === 429
      ? retryAfterSecondsFromHeader(response.headers.get("retry-after")) ?? 60
      : undefined;
    if (retryAfterSeconds) {
      providerCooldownUntilMs = Math.max(providerCooldownUntilMs, Date.now() + retryAfterSeconds * 1000);
    }
    const providerPayload = parseProviderPayload(text);
    const providerMessage = typeof providerPayload === "string"
      ? providerPayload
      : providerMessageFromPayload(providerPayload);
    throw new ArubaFatturazioneError(
      response.status >= 500 ? 502 : response.status,
      arubaErrorMessage(response.status, operation, providerMessage),
      response.status,
      {
        providerMessage,
        operation,
        hint: arubaErrorHint(response.status, operation, retryAfterSeconds, providerMessage),
        retryAfterSeconds,
      },
    );
  }

  if (!text.trim()) return null as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ArubaFatturazioneError(502, "Risposta Aruba non valida");
  }
};

const sanitizeProviderPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeProviderPayload);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_PAYLOAD_KEYS.has(key))
      .map(([key, item]) => [key, sanitizeProviderPayload(item)]),
  );
};

const signIn = async (config: ArubaFatturazioneConfig) => {
  const body = new URLSearchParams({
    grant_type: "password",
    username: config.username,
    password: config.password,
  });

  const data = await fetchJson<ArubaTokenResponse>(
    `${config.authBaseUrl}/auth/signin`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    },
    config.timeoutMs,
    "autenticazione Aruba",
  );

  const accessToken = readString(data?.access_token);
  if (!accessToken) throw new ArubaFatturazioneError(502, "Token Aruba non presente nella risposta");

  const expiresInSeconds = readInteger(data?.expires_in, 1_800, 60, 86_400);
  tokenCache = {
    cacheKey: cacheKeyForConfig(config),
    accessToken,
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
  };

  return accessToken;
};

const getAccessToken = async (config: ArubaFatturazioneConfig) => {
  const cacheKey = cacheKeyForConfig(config);
  if (
    tokenCache &&
    tokenCache.cacheKey === cacheKey &&
    tokenCache.expiresAtMs > Date.now() + TOKEN_REFRESH_SAFETY_MS
  ) {
    return tokenCache.accessToken;
  }

  if (tokenRefreshInFlight?.cacheKey === cacheKey) return tokenRefreshInFlight.promise;

  const promise = signIn(config).finally(() => {
    if (tokenRefreshInFlight?.cacheKey === cacheKey) {
      tokenRefreshInFlight = null;
    }
  });
  tokenRefreshInFlight = { cacheKey, promise };

  return promise;
};

const authorizedGet = async <T>(config: ArubaFatturazioneConfig, url: string) => {
  const token = await getAccessToken(config);
  return fetchJson<T>(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    config.timeoutMs,
    url.includes("invoices-out")
      ? "lettura fatture inviate"
      : url.includes("invoices-in")
        ? "lettura fatture ricevute"
        : "lettura dati Aruba",
  );
};

export const getArubaUserInfo = async () => {
  const config = getConfig();
  assertConfigured(config);
  const data = await authorizedGet<unknown>(config, `${config.authBaseUrl}/auth/userInfo`);
  return sanitizeProviderPayload(data);
};

export const getArubaCedenti = async () => {
  const config = getConfig();
  assertConfigured(config);
  const data = await authorizedGet<unknown>(config, `${config.authBaseUrl}/auth/multicedenti`);
  return sanitizeProviderPayload(data);
};

const dateOnlyToIso = (value: string, endOfDay: boolean) =>
  `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;

const normalizeDateParam = (value: unknown, fallback: Date, endOfDay: boolean) => {
  const raw = readString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return dateOnlyToIso(raw, endOfDay);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback.toISOString();
};

const createInvoiceSearchParams = (config: ArubaFatturazioneConfig, input: ArubaInvoiceSearchInput) => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const creationStartDate = normalizeDateParam(input.creationStartDate, yesterday, false);
  const creationEndDate = normalizeDateParam(input.creationEndDate, now, true);
  const startMs = new Date(creationStartDate).getTime();
  const endMs = new Date(creationEndDate).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    throw new ArubaFatturazioneError(400, "Intervallo date fatturazione non valido");
  }

  if (endMs - startMs > MAX_INVOICE_SEARCH_WINDOW_MS) {
    throw new ArubaFatturazioneError(400, "La ricerca Aruba non puo superare 2 giorni");
  }

  const params = new URLSearchParams({
    page: String(readInteger(input.page, 1, 1, 10_000)),
    size: String(readInteger(input.size, 10, 1, 100)),
    creationStartDate,
    creationEndDate,
  });

  const status = readString(input.status);
  const documentType = readString(input.documentType);
  if (status) params.set("status", status);
  if (documentType) params.set("documentType", documentType);

  if (input.direction === "out") {
    if (config.senderCountry) params.set("senderCountry", config.senderCountry);
    if (config.senderVatcode) params.set("senderVatcode", config.senderVatcode);
  } else {
    if (config.receiverCountry) params.set("receiverCountry", config.receiverCountry);
    if (config.receiverVatcode) params.set("receiverVatcode", config.receiverVatcode);
  }

  return {
    params,
    filters: {
      creationStartDate,
      creationEndDate,
      page: Number(params.get("page")),
      size: Number(params.get("size")),
    },
  };
};

export const findArubaInvoices = async (input: ArubaInvoiceSearchInput) => {
  const config = getConfig();
  assertConfigured(config);

  const direction = input.direction === "in" ? "in" : "out";
  const { params, filters } = createInvoiceSearchParams(config, { ...input, direction });
  const path = direction === "in" ? "/api/v2/invoices-in" : "/api/v2/invoices-out";
  const data = await authorizedGet<unknown>(config, `${config.wsBaseUrl}${path}?${params.toString()}`);

  return {
    provider: "aruba-fatturazione-elettronica",
    direction,
    readOnly: true,
    requestedAt: new Date().toISOString(),
    filters,
    data: sanitizeProviderPayload(data),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readNumberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readBooleanValue = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;

const readInvoiceCompany = (value: unknown): ArubaInvoiceCompany | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    description: readString(value["description"]) || undefined,
    countryCode: readString(value["countryCode"]) || undefined,
    vatCode: readString(value["vatCode"]) || undefined,
    fiscalCode: readString(value["fiscalCode"]) || undefined,
  };
};

const readInvoiceLine = (value: unknown): ArubaInvoiceLine | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    invoiceDate: readString(value["invoiceDate"]) || undefined,
    number: readString(value["number"]) || undefined,
    documentType: readString(value["documentType"]) || undefined,
    status: readString(value["status"]) || undefined,
    statusDescription: readString(value["statusDescription"]) || undefined,
    totalDocument: readNumberValue(value["totalDocument"]),
    totalVat: readNumberValue(value["totalVat"]),
    netPayable: readNumberValue(value["netPayable"]),
  };
};

const readInvoiceLots = (value: unknown): ArubaInvoiceLot[] => {
  if (!isRecord(value) || !Array.isArray(value["content"])) return [];
  return value["content"].filter(isRecord).map((item) => ({
    id: readString(item["id"]) || undefined,
    idSdi: readString(item["idSdi"]) || undefined,
    filename: readString(item["filename"]) || undefined,
    docType: readString(item["docType"]) || undefined,
    creationDate: readString(item["creationDate"]) || undefined,
    lastUpdate: readString(item["lastUpdate"]) || undefined,
    pddAvailable: readBooleanValue(item["pddAvailable"]),
    sender: readInvoiceCompany(item["sender"]),
    receiver: readInvoiceCompany(item["receiver"]),
    invoices: Array.isArray(item["invoices"])
      ? item["invoices"].map(readInvoiceLine).filter(Boolean) as ArubaInvoiceLine[]
      : [],
  }));
};

const readInvoiceTotalPages = (value: unknown) => {
  if (!isRecord(value)) return 1;
  return readInteger(value["totalPages"], 1, 1, 10_000);
};

const invoiceCacheId = (direction: ArubaInvoiceDirection, lot: ArubaInvoiceLot, invoice: ArubaInvoiceLine) =>
  [
    direction,
    lot.id || "",
    lot.idSdi || "",
    lot.filename || "",
    invoice.number || "",
    invoice.invoiceDate || lot.creationDate || "",
  ].join(":");

const normalizeInvoiceForCache = (
  direction: ArubaInvoiceDirection,
  lot: ArubaInvoiceLot,
  syncedAt: string,
): ArubaInvoiceCacheRecord => {
  const invoice = lot.invoices?.[0] ?? {};
  const counterparty = direction === "out" ? lot.receiver : lot.sender;

  return {
    cacheId: invoiceCacheId(direction, lot, invoice),
    direction,
    id: lot.id,
    idSdi: lot.idSdi,
    filename: lot.filename,
    docType: lot.docType,
    creationDate: lot.creationDate,
    lastUpdate: lot.lastUpdate,
    pddAvailable: lot.pddAvailable,
    invoiceDate: invoice.invoiceDate,
    number: invoice.number,
    documentType: invoice.documentType,
    status: invoice.status,
    statusDescription: invoice.statusDescription,
    totalDocument: readNumberValue(invoice.totalDocument),
    totalVat: readNumberValue(invoice.totalVat),
    netPayable: readNumberValue(invoice.netPayable),
    counterpartyName: counterparty?.description,
    counterpartyCountry: counterparty?.countryCode,
    counterpartyVatCode: counterparty?.vatCode,
    counterpartyFiscalCode: counterparty?.fiscalCode,
    syncedAt,
  };
};

const normalizeCacheRecord = (value: unknown): ArubaInvoiceCacheRecord | null => {
  if (!isRecord(value)) return null;
  const cacheId = readString(value["cacheId"]);
  const direction = readString(value["direction"]) === "in" ? "in" : readString(value["direction"]) === "out" ? "out" : null;
  const syncedAt = readString(value["syncedAt"]);
  if (!cacheId || !direction || !syncedAt) return null;

  return {
    cacheId,
    direction,
    id: readString(value["id"]) || undefined,
    idSdi: readString(value["idSdi"]) || undefined,
    filename: readString(value["filename"]) || undefined,
    docType: readString(value["docType"]) || undefined,
    creationDate: readString(value["creationDate"]) || undefined,
    lastUpdate: readString(value["lastUpdate"]) || undefined,
    pddAvailable: readBooleanValue(value["pddAvailable"]),
    invoiceDate: readString(value["invoiceDate"]) || undefined,
    number: readString(value["number"]) || undefined,
    documentType: readString(value["documentType"]) || undefined,
    status: readString(value["status"]) || undefined,
    statusDescription: readString(value["statusDescription"]) || undefined,
    totalDocument: readNumberValue(value["totalDocument"]),
    totalVat: readNumberValue(value["totalVat"]),
    netPayable: readNumberValue(value["netPayable"]),
    counterpartyName: readString(value["counterpartyName"]) || undefined,
    counterpartyCountry: readString(value["counterpartyCountry"]) || undefined,
    counterpartyVatCode: readString(value["counterpartyVatCode"]) || undefined,
    counterpartyFiscalCode: readString(value["counterpartyFiscalCode"]) || undefined,
    syncedAt,
  };
};

const normalizeSyncState = (value: unknown): ArubaInvoiceSyncState | undefined => {
  if (!isRecord(value)) return undefined;
  const id = readString(value["id"]);
  const direction = readString(value["direction"]) === "in" ? "in" : readString(value["direction"]) === "out" ? "out" : null;
  const status = readString(value["status"]);
  const requestedAt = readString(value["requestedAt"]);
  const creationStartDate = readString(value["creationStartDate"]);
  const creationEndDate = readString(value["creationEndDate"]);
  if (!id || !direction || !requestedAt || !creationStartDate || !creationEndDate) return undefined;
  if (status !== "idle" && status !== "running" && status !== "completed" && status !== "failed") return undefined;

  return {
    id,
    direction,
    status,
    requestedAt,
    startedAt: readString(value["startedAt"]) || undefined,
    finishedAt: readString(value["finishedAt"]) || undefined,
    creationStartDate,
    creationEndDate,
    totalWindows: readInteger(value["totalWindows"], 0, 0, 10_000),
    completedWindows: readInteger(value["completedWindows"], 0, 0, 10_000),
    totalProviderRequests: readInteger(value["totalProviderRequests"], 0, 0, 1_000_000),
    importedCount: readInteger(value["importedCount"], 0, 0, 1_000_000),
    error: readString(value["error"]) || undefined,
    providerStatus: readInteger(value["providerStatus"], 0, 0, 999) || undefined,
    retryAfterSeconds: readInteger(value["retryAfterSeconds"], 0, 0, 86_400) || undefined,
  };
};

const normalizeCacheState = (value: unknown): ArubaInvoiceCacheState => {
  if (!isRecord(value)) return { version: 1, invoices: [] };
  return {
    version: 1,
    updatedAt: readString(value["updatedAt"]) || undefined,
    invoices: Array.isArray(value["invoices"])
      ? value["invoices"].map(normalizeCacheRecord).filter(Boolean) as ArubaInvoiceCacheRecord[]
      : [],
    lastSync: normalizeSyncState(value["lastSync"]),
  };
};

const loadInvoiceCacheState = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, INVOICE_CACHE_KEY))
    .limit(1);

  return normalizeCacheState(settings?.value);
};

const saveInvoiceCacheState = async (state: ArubaInvoiceCacheState) => {
  const now = new Date();
  const value = {
    ...state,
    version: 1 as const,
    updatedAt: now.toISOString(),
  };

  await db
    .insert(adminSettingsTable)
    .values({
      key: INVOICE_CACHE_KEY,
      value,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: {
        value,
        updatedAt: now,
      },
    });

  return value;
};

const upsertCachedInvoices = async (records: ArubaInvoiceCacheRecord[], syncState?: ArubaInvoiceSyncState) => {
  const state = await loadInvoiceCacheState();
  const byId = new Map(state.invoices.map((invoice) => [invoice.cacheId, invoice]));
  records.forEach((record) => byId.set(record.cacheId, record));
  await saveInvoiceCacheState({
    version: 1,
    updatedAt: state.updatedAt,
    invoices: Array.from(byId.values()),
    lastSync: syncState ?? state.lastSync,
  });
};

const saveSyncState = async (syncState: ArubaInvoiceSyncState) => {
  const state = await loadInvoiceCacheState();
  await saveInvoiceCacheState({
    ...state,
    lastSync: syncState,
  });
};

const startOfUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));

const endOfUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));

const parseDateRange = (startValue: unknown, endValue: unknown, defaultStart: Date) => {
  const now = new Date();
  const startIso = normalizeDateParam(startValue, defaultStart, false);
  const endIso = normalizeDateParam(endValue, now, true);
  const start = startOfUtcDay(new Date(startIso));
  const end = endOfUtcDay(new Date(endIso));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) {
    throw new ArubaFatturazioneError(400, "Intervallo date fatturazione non valido");
  }

  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (days > MAX_SYNC_RANGE_DAYS) {
    throw new ArubaFatturazioneError(400, "La sincronizzazione Aruba non puo superare un anno per volta");
  }

  return { start, end };
};

const splitSyncWindows = (start: Date, end: Date) => {
  const windows: Array<{ start: string; end: string }> = [];
  let cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const windowStart = new Date(cursor);
    const windowEnd = new Date(Math.min(
      end.getTime(),
      windowStart.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000 - 1,
    ));
    windows.push({
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    });
    cursor = new Date(windowEnd.getTime() + 1);
  }

  return windows;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Sincronizzazione Aruba non riuscita";

const runInvoiceSync = async (
  initialState: ArubaInvoiceSyncState,
  input: ArubaInvoiceSyncInput,
  delayMs: number,
) => {
  const size = readInteger(input.size, 100, 1, 100);
  const windows = splitSyncWindows(
    new Date(initialState.creationStartDate),
    new Date(initialState.creationEndDate),
  ).reverse();
  const syncState = initialState;

  try {
    syncState.status = "running";
    syncState.startedAt = new Date().toISOString();
    await saveSyncState(syncState);
    logger.info(
      {
        syncId: syncState.id,
        direction: syncState.direction,
        totalWindows: syncState.totalWindows,
      },
      "Aruba invoice sync started",
    );

    for (const window of windows) {
      let page = 1;
      let totalPages = 1;

      do {
        const result = await findArubaInvoices({
          direction: syncState.direction,
          creationStartDate: window.start,
          creationEndDate: window.end,
          page,
          size,
        });
        const lots = readInvoiceLots(result.data);
        const syncedAt = new Date().toISOString();
        const records = lots.map((lot) => normalizeInvoiceForCache(syncState.direction, lot, syncedAt));

        syncState.totalProviderRequests += 1;
        syncState.importedCount += records.length;
        totalPages = readInvoiceTotalPages(result.data);

        await upsertCachedInvoices(records, syncState);

        page += 1;
        if (page <= totalPages) await delay(delayMs);
      } while (page <= totalPages);

      syncState.completedWindows += 1;
      await saveSyncState(syncState);
      logger.info(
        {
          syncId: syncState.id,
          direction: syncState.direction,
          completedWindows: syncState.completedWindows,
          totalWindows: syncState.totalWindows,
          importedCount: syncState.importedCount,
          totalProviderRequests: syncState.totalProviderRequests,
        },
        "Aruba invoice sync progress",
      );

      if (syncState.completedWindows < syncState.totalWindows) await delay(delayMs);
    }

    syncState.status = "completed";
    syncState.finishedAt = new Date().toISOString();
    await saveSyncState(syncState);
    logger.info(
      {
        syncId: syncState.id,
        direction: syncState.direction,
        importedCount: syncState.importedCount,
        totalProviderRequests: syncState.totalProviderRequests,
      },
      "Aruba invoice sync completed",
    );
  } catch (err) {
    syncState.status = "failed";
    syncState.finishedAt = new Date().toISOString();
    syncState.error = errorText(err);
    syncState.providerStatus = err instanceof ArubaFatturazioneError ? err.providerStatus : undefined;
    syncState.retryAfterSeconds = err instanceof ArubaFatturazioneError ? err.retryAfterSeconds : undefined;
    await saveSyncState(syncState);
    logger.warn(
      {
        syncId: syncState.id,
        direction: syncState.direction,
        providerStatus: syncState.providerStatus,
        retryAfterSeconds: syncState.retryAfterSeconds,
        message: syncState.error,
      },
      "Aruba invoice sync failed",
    );
  } finally {
    currentSyncJob = syncState;
  }
};

const defaultYearStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
};

export const startArubaInvoiceSync = async (input: ArubaInvoiceSyncInput) => {
  const config = getConfig();
  assertConfigured(config);

  if (currentSyncJob?.status === "running") {
    throw new ArubaFatturazioneError(409, "Sincronizzazione Aruba gia in corso");
  }

  const direction = input.direction === "in" ? "in" : "out";
  const { start, end } = parseDateRange(input.creationStartDate, input.creationEndDate, defaultYearStart());
  const windows = splitSyncWindows(start, end);
  const now = new Date().toISOString();
  const syncState: ArubaInvoiceSyncState = {
    id: `aruba-sync-${Date.now()}`,
    direction,
    status: "idle",
    requestedAt: now,
    creationStartDate: start.toISOString(),
    creationEndDate: end.toISOString(),
    totalWindows: windows.length,
    completedWindows: 0,
    totalProviderRequests: 0,
    importedCount: 0,
  };

  currentSyncJob = syncState;
  await saveSyncState(syncState);
  void runInvoiceSync(syncState, { ...input, direction }, config.syncDelayMs);
  return syncState;
};

export const getArubaInvoiceSyncState = async () => {
  if (currentSyncJob?.status === "running") return currentSyncJob;
  const state = await loadInvoiceCacheState();
  if (state.lastSync?.status === "running") {
    const interruptedSync: ArubaInvoiceSyncState = {
      ...state.lastSync,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: "Sincronizzazione interrotta: il backend e stato riavviato o fermato prima del completamento.",
    };
    await saveSyncState(interruptedSync);
    return interruptedSync;
  }

  return currentSyncJob ?? state.lastSync ?? null;
};

export const getCachedArubaInvoices = async (input: ArubaInvoiceSearchInput) => {
  const direction = input.direction === "in" ? "in" : "out";
  const { start, end } = parseDateRange(input.creationStartDate, input.creationEndDate, defaultYearStart());
  const page = readInteger(input.page, 1, 1, 10_000);
  const size = readInteger(input.size, 25, 1, 100);
  const state = await loadInvoiceCacheState();
  const startMs = start.getTime();
  const endMs = end.getTime();
  const filtered = state.invoices
    .filter((invoice) => {
      if (invoice.direction !== direction) return false;
      const dateMs = Date.parse(invoice.invoiceDate ?? invoice.creationDate ?? "");
      return !Number.isNaN(dateMs) && dateMs >= startMs && dateMs <= endMs;
    })
    .sort((a, b) => Date.parse(b.invoiceDate ?? b.creationDate ?? "") - Date.parse(a.invoiceDate ?? a.creationDate ?? ""));

  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * size;

  return {
    provider: "aruba-fatturazione-elettronica",
    direction,
    readOnly: true,
    source: "local-cache",
    requestedAt: new Date().toISOString(),
    cacheUpdatedAt: state.updatedAt,
    lastSync: state.lastSync ?? null,
    data: {
      content: filtered.slice(offset, offset + size),
      totalElements,
      totalPages,
      number: safePage,
      size,
      first: safePage === 1,
      last: safePage >= totalPages,
      numberOfElements: filtered.slice(offset, offset + size).length,
    },
  };
};
