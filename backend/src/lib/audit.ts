import type { Request, RequestHandler } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { ensureSecurityTables } from "./securityDb";

export type AuditOutcome = "success" | "blocked" | "error";

export type AuditLogEntry = {
  id: number;
  createdAt: string;
  actorAccountId: string | null;
  actorUsername: string | null;
  actorRoleId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: AuditOutcome;
  reason: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
};

type AuditInput = {
  actorAccountId?: string | null;
  actorUsername?: string | null;
  actorRoleId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  outcome: AuditOutcome;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

type AuditQuery = {
  page?: number;
  pageSize?: number;
  actor?: string;
  action?: string;
  entityType?: string;
  outcome?: string;
  from?: string;
  to?: string;
};

const SENSITIVE_METADATA_KEYS = [
  "authorization",
  "cookie",
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "secret",
  "token",
];

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const requestPath = (req: Request) => (req.originalUrl || req.url || req.path).split("?")[0] ?? "";

const sanitizeMetadataValue = (value: unknown, depth = 0): unknown => {
  if (depth > 2) return "[truncated]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1));
  if (typeof value !== "object") return undefined;

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    const normalizedKey = key.toLocaleLowerCase("it-IT").replace(/[^a-z0-9]/g, "");
    if (SENSITIVE_METADATA_KEYS.some((sensitiveKey) => normalizedKey.includes(sensitiveKey))) continue;
    const sanitizedValue = sanitizeMetadataValue(nestedValue, depth + 1);
    if (sanitizedValue !== undefined) output[key] = sanitizedValue;
  }
  return output;
};

const sanitizeMetadata = (metadata: Record<string, unknown> | undefined) =>
  (sanitizeMetadataValue(metadata ?? {}) as Record<string, unknown>) ?? {};

const outcomeFromStatus = (statusCode: number): AuditOutcome => {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "blocked";
  return "success";
};

const entityTypeFromPath = (path: string) =>
  path
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean)[0] || "api";

const shouldAuditMutation = (req: Request) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return false;
  const path = requestPath(req);
  if (!path.startsWith("/api/")) return false;
  if (path.endsWith("/auth/login") || path.endsWith("/auth/change-password")) return false;
  if (path.includes("/audit-logs")) return false;
  return true;
};

export const writeAuditLog = async (req: Request, input: AuditInput) => {
  await ensureSecurityTables();

  const auth = req.auth;
  const path = requestPath(req);
  const entityId = input.entityId === undefined || input.entityId === null
    ? null
    : String(input.entityId);

  await pool.query(
    `
      INSERT INTO audit_logs (
        actor_account_id,
        actor_username,
        actor_role_id,
        action,
        entity_type,
        entity_id,
        outcome,
        reason,
        request_method,
        request_path,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
    `,
    [
      input.actorAccountId ?? auth?.accountId ?? null,
      input.actorUsername ?? auth?.username ?? null,
      input.actorRoleId ?? auth?.roleId ?? null,
      input.action,
      input.entityType,
      entityId,
      input.outcome,
      input.reason ?? null,
      req.method,
      path,
      req.ip ?? null,
      readString(req.headers["user-agent"]) || null,
      JSON.stringify(sanitizeMetadata(input.metadata)),
    ],
  );
};

export const auditHttpMutations: RequestHandler = (req, res, next) => {
  if (!shouldAuditMutation(req)) {
    next();
    return;
  }

  const path = requestPath(req);
  res.on("finish", () => {
    void writeAuditLog(req, {
      action: `http.${req.method.toLocaleLowerCase("it-IT")}`,
      entityType: entityTypeFromPath(path),
      outcome: outcomeFromStatus(res.statusCode),
      reason: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null,
      metadata: {
        statusCode: res.statusCode,
      },
    }).catch((err) => {
      logger.warn({ err }, "Failed to write audit log");
    });
  });

  next();
};

export const listAuditLogs = async (query: AuditQuery) => {
  await ensureSecurityTables();

  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(query.pageSize ?? 50)));
  const params: unknown[] = [];
  const where: string[] = [];

  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (query.actor) {
    const placeholder = addParam(`%${query.actor}%`);
    where.push(`(actor_username ILIKE ${placeholder} OR actor_account_id ILIKE ${placeholder})`);
  }
  if (query.action) where.push(`action = ${addParam(query.action)}`);
  if (query.entityType) where.push(`entity_type = ${addParam(query.entityType)}`);
  if (query.outcome) where.push(`outcome = ${addParam(query.outcome)}`);
  if (query.from) where.push(`created_at >= ${addParam(query.from)}::timestamp`);
  if (query.to) where.push(`created_at <= ${addParam(query.to)}::timestamp`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitPlaceholder = addParam(pageSize);
  const offsetPlaceholder = addParam((page - 1) * pageSize);

  const rows = await pool.query<{
    id: number;
    created_at: Date;
    actor_account_id: string | null;
    actor_username: string | null;
    actor_role_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    outcome: AuditOutcome;
    reason: string | null;
    request_method: string | null;
    request_path: string | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
  }>(`
    SELECT
      id,
      created_at,
      actor_account_id,
      actor_username,
      actor_role_id,
      action,
      entity_type,
      entity_id,
      outcome,
      reason,
      request_method,
      request_path,
      ip_address,
      user_agent,
      metadata
    FROM audit_logs
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `, params);

  const countRows = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM audit_logs ${whereSql}`,
    params.slice(0, params.length - 2),
  );

  const items: AuditLogEntry[] = rows.rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at.toISOString(),
    actorAccountId: row.actor_account_id,
    actorUsername: row.actor_username,
    actorRoleId: row.actor_role_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    outcome: row.outcome,
    reason: row.reason,
    requestMethod: row.request_method,
    requestPath: row.request_path,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata ?? {},
  }));

  return {
    items,
    page,
    pageSize,
    total: Number(countRows.rows[0]?.total ?? "0"),
  };
};
