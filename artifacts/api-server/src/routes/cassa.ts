import express, { Router, type RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { adminSettingsTable, db } from "@workspace/db";

const router = Router();

const STATE_KEY = "cassa-state";
const DEFAULT_BUCKET = "certificati-infortunistica";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

type CassaDocument = {
  id: string;
  data: string;
  sedeId: string;
  tipo: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};

type CassaState = {
  giorni?: unknown[];
  spese?: unknown[];
  documenti?: CassaDocument[];
};

const cleanEnv = (value: string | undefined) => value?.trim().replace(/^(['"])(.*)\1$/, "$2");

const deriveSupabaseUrl = () => {
  const explicitUrl = cleanEnv(process.env.SUPABASE_URL);
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");

  const databaseUrl = cleanEnv(process.env.DATABASE_URL);
  const projectRef = databaseUrl?.match(/postgres\.([a-z0-9]+):/i)?.[1];
  return projectRef ? `https://${projectRef}.supabase.co` : "";
};

const getStorageConfig = () => {
  const supabaseUrl = deriveSupabaseUrl();
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const bucket = cleanEnv(process.env.SUPABASE_STORAGE_BUCKET) || DEFAULT_BUCKET;

  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey, bucket };
};

const storageHeaders = (serviceRoleKey: string, extra?: Record<string, string>) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  ...extra,
});

const sanitizeSegment = (value: string, fallback: string) => {
  const cleaned = decodeURIComponent(value || "")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return cleaned || fallback;
};

const readHeader = (value: string | string[] | undefined, fallback = "") =>
  Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;

const inferContentType = (fileName: string, providedType: string) => {
  if (providedType && providedType !== "application/octet-stream") return providedType;

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";

  return "application/octet-stream";
};

const isCassaDocument = (value: unknown): value is CassaDocument => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<CassaDocument>;
  return (
    typeof item.id === "string" &&
    typeof item.data === "string" &&
    typeof item.sedeId === "string" &&
    typeof item.tipo === "string" &&
    typeof item.bucket === "string" &&
    typeof item.storagePath === "string" &&
    typeof item.fileName === "string" &&
    typeof item.contentType === "string" &&
    typeof item.sizeBytes === "number" &&
    typeof item.uploadedAt === "string"
  );
};

const loadCassaState = async (): Promise<CassaState> => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, STATE_KEY))
    .limit(1);

  return settings?.value && typeof settings.value === "object" && !Array.isArray(settings.value)
    ? (settings.value as CassaState)
    : { giorni: [], spese: [], documenti: [] };
};

const saveCassaState = async (state: CassaState) => {
  const now = new Date();
  const [settings] = await db
    .insert(adminSettingsTable)
    .values({
      key: STATE_KEY,
      value: state,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: {
        value: state,
        updatedAt: now,
      },
    })
    .returning();

  return settings.value;
};

router.get("/cassa-state", async (req, res) => {
  try {
    res.json(await loadCassaState());
  } catch (err) {
    req.log.error({ err }, "Failed to load cassa state");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/cassa-state", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Dati cassa non validi" });
    return;
  }

  try {
    res.json(await saveCassaState(req.body as CassaState));
  } catch (err) {
    req.log.error({ err }, "Failed to save cassa state");
    res.status(500).json({ error: "Internal server error" });
  }
});

const uploadCassaFile: RequestHandler = async (req, res) => {
  const config = getStorageConfig();
  if (!config) {
    res.status(503).json({
      error: "Supabase Storage non configurato",
      details: "Imposta SUPABASE_SERVICE_ROLE_KEY su Vercel.",
    });
    return;
  }

  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (body.length === 0) {
    res.status(400).json({ error: "File mancante" });
    return;
  }

  if (body.length > MAX_FILE_BYTES) {
    res.status(413).json({ error: "File troppo grande. Il piano Free consente massimo 50 MB per file." });
    return;
  }

  const documentId = sanitizeSegment(readHeader(req.params.documentId), "documento");
  const sedeId = sanitizeSegment(readHeader(req.headers["x-sede-id"], "sede"), "sede");
  const data = sanitizeSegment(readHeader(req.headers["x-data"], new Date().toISOString().slice(0, 10)), "data");
  const tipo = sanitizeSegment(readHeader(req.headers["x-document-type"], "documento"), "documento");
  const fileName = sanitizeSegment(readHeader(req.headers["x-file-name"], "documento.pdf"), "documento.pdf");
  const contentType = inferContentType(fileName, readHeader(req.headers["content-type"], "application/octet-stream"));
  const storagePath = ["cassa", sedeId, data, tipo, `${Date.now()}-${fileName}`].join("/");

  try {
    const uploadResponse = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${encodeURI(storagePath)}`,
      {
        method: "POST",
        headers: storageHeaders(config.serviceRoleKey, {
          "Content-Type": contentType,
          "Cache-Control": "3600",
          "x-upsert": "true",
        }),
        body,
      },
    );

    if (!uploadResponse.ok) {
      const message = await uploadResponse.text();
      req.log.error({ status: uploadResponse.status, message }, "Supabase Storage cassa upload failed");
      res.status(502).json({ error: "Upload Supabase Storage non riuscito" });
      return;
    }

    const document: CassaDocument = {
      id: documentId,
      data,
      sedeId,
      tipo,
      bucket: config.bucket,
      storagePath,
      fileName,
      contentType,
      sizeBytes: body.length,
      uploadedAt: new Date().toISOString(),
    };
    const state = await loadCassaState();
    const documenti = [
      ...(Array.isArray(state.documenti) ? state.documenti.filter(isCassaDocument) : [])
        .filter((item) => item.id !== document.id),
      document,
    ];

    await saveCassaState({ ...state, documenti });

    res.json({
      ...document,
      fileUrl: `/api/cassa-files/${encodeURIComponent(document.id)}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to upload cassa document");
    res.status(500).json({ error: "Internal server error" });
  }
};

const downloadCassaFile: RequestHandler = async (req, res) => {
  const config = getStorageConfig();
  if (!config) {
    res.status(503).json({
      error: "Supabase Storage non configurato",
      details: "Imposta SUPABASE_SERVICE_ROLE_KEY su Vercel.",
    });
    return;
  }

  try {
    const documentId = sanitizeSegment(readHeader(req.params.documentId), "documento");
    const state = await loadCassaState();
    const document = (Array.isArray(state.documenti) ? state.documenti : [])
      .filter(isCassaDocument)
      .find((item) => item.id === documentId);

    if (!document) {
      res.status(404).json({ error: "Documento cassa non trovato" });
      return;
    }

    const downloadResponse = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${document.bucket}/${encodeURI(document.storagePath)}`,
      {
        headers: storageHeaders(config.serviceRoleKey),
      },
    );

    if (!downloadResponse.ok || !downloadResponse.body) {
      const message = await downloadResponse.text();
      req.log.error({ status: downloadResponse.status, message }, "Supabase Storage cassa download failed");
      res.status(502).json({ error: "Download Supabase Storage non riuscito" });
      return;
    }

    const bytes = Buffer.from(await downloadResponse.arrayBuffer());
    res.setHeader("Content-Type", document.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", `attachment; filename="${document.fileName.replace(/"/g, "")}"`);
    res.send(bytes);
  } catch (err) {
    req.log.error({ err }, "Failed to download cassa document");
    res.status(500).json({ error: "Internal server error" });
  }
};

const rawCassaFile = express.raw({ type: "*/*", limit: "50mb" });

router.post("/cassa-files/:documentId", rawCassaFile, uploadCassaFile);
router.get("/cassa-files/:documentId", downloadCassaFile);

export default router;
