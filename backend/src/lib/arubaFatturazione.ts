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
