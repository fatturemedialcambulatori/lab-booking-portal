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

export type ArubaInvoiceSearchInput = {
  direction: ArubaInvoiceDirection;
  page?: unknown;
  size?: unknown;
  creationStartDate?: unknown;
  creationEndDate?: unknown;
  status?: unknown;
  documentType?: unknown;
};

export class ArubaFatturazioneError extends Error {
  readonly statusCode: number;
  readonly providerStatus?: number;

  constructor(statusCode: number, message: string, providerStatus?: number) {
    super(message);
    this.name = "ArubaFatturazioneError";
    this.statusCode = statusCode;
    this.providerStatus = providerStatus;
  }
}

const DEMO_AUTH_BASE_URL = "https://demoauth.fatturazioneelettronica.aruba.it";
const DEMO_WS_BASE_URL = "https://demows.fatturazioneelettronica.aruba.it";
const PRODUCTION_AUTH_BASE_URL = "https://auth.fatturazioneelettronica.aruba.it";
const PRODUCTION_WS_BASE_URL = "https://ws.fatturazioneelettronica.aruba.it";
const TOKEN_REFRESH_SAFETY_MS = 60_000;
const MAX_INVOICE_SEARCH_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SENSITIVE_PAYLOAD_KEYS = new Set([
  "access_token",
  "refresh_token",
  "file",
  "pdfFile",
  "dataFile",
  "password",
]);

let tokenCache: ArubaTokenCache | null = null;

const cleanEnv = (value: string | undefined) => value?.trim().replace(/^(['"])(.*)\1$/, "$2") ?? "";

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const readInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizeEnvironment = (value: string): ArubaFatturazioneEnvironment =>
  value.toLocaleLowerCase("it-IT") === "production" ? "production" : "demo";

const defaultAuthBaseUrl = (environment: ArubaFatturazioneEnvironment) =>
  environment === "production" ? PRODUCTION_AUTH_BASE_URL : DEMO_AUTH_BASE_URL;

const defaultWsBaseUrl = (environment: ArubaFatturazioneEnvironment) =>
  environment === "production" ? PRODUCTION_WS_BASE_URL : DEMO_WS_BASE_URL;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getConfig = (): ArubaFatturazioneConfig => {
  const environment = normalizeEnvironment(cleanEnv(process.env["ARUBA_FE_ENVIRONMENT"]));
  const username = cleanEnv(process.env["ARUBA_FE_USERNAME"]);
  const password = cleanEnv(process.env["ARUBA_FE_PASSWORD"]);
  const missing = [
    ["ARUBA_FE_USERNAME", username],
    ["ARUBA_FE_PASSWORD", password],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    environment,
    authBaseUrl: trimTrailingSlash(cleanEnv(process.env["ARUBA_FE_AUTH_BASE_URL"]) || defaultAuthBaseUrl(environment)),
    wsBaseUrl: trimTrailingSlash(cleanEnv(process.env["ARUBA_FE_WS_BASE_URL"]) || defaultWsBaseUrl(environment)),
    username,
    password,
    timeoutMs: readInteger(cleanEnv(process.env["ARUBA_FE_TIMEOUT_MS"]), 10_000, 1_000, 30_000),
    senderCountry: cleanEnv(process.env["ARUBA_FE_SENDER_COUNTRY"]) || "IT",
    senderVatcode: cleanEnv(process.env["ARUBA_FE_SENDER_VATCODE"]),
    receiverCountry: cleanEnv(process.env["ARUBA_FE_RECEIVER_COUNTRY"]) || "IT",
    receiverVatcode: cleanEnv(process.env["ARUBA_FE_RECEIVER_VATCODE"]),
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

const fetchJson = async <T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> => {
  const response = await withTimeout(url, init, timeoutMs);
  const text = await response.text();

  if (!response.ok) {
    throw new ArubaFatturazioneError(
      response.status >= 500 ? 502 : response.status,
      "Aruba ha rifiutato o non ha completato la richiesta",
      response.status,
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

  return signIn(config);
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
