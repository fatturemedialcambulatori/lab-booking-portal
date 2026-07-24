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
  fileUrl?: string;
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

const readQueryValue = (value: unknown, fallback = ""): string => {
  if (Array.isArray(value)) return readQueryValue(value[0], fallback);
  return typeof value === "string" ? value : fallback;
};

const readBodyString = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const readBodyNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const inferContentType = (fileName: string, providedType: string) => {
  if (providedType && providedType !== "application/octet-stream") return providedType;

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";

  return "application/octet-stream";
};

const splitBuffer = (buffer: Buffer, separator: Buffer) => {
  const chunks: Buffer[] = [];
  let position = 0;
  let index = buffer.indexOf(separator, position);

  while (index !== -1) {
    chunks.push(buffer.subarray(position, index));
    position = index + separator.length;
    index = buffer.indexOf(separator, position);
  }

  chunks.push(buffer.subarray(position));
  return chunks;
};

const parseDisposition = (value: string | undefined) => {
  const result: Record<string, string> = {};
  if (!value) return result;

  value.split(";").forEach((part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) return;
    result[rawKey.toLowerCase()] = rawValue.join("=").trim().replace(/^"|"$/g, "");
  });

  return result;
};

const parseMultipartUpload = (body: Buffer, contentType: string) => {
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1]?.replace(/^"|"$/g, "");
  if (!boundary) return null;

  const fields: Record<string, string> = {};
  const files: Array<{ body: Buffer; fileName: string; contentType: string }> = [];

  splitBuffer(body, Buffer.from(`--${boundary}`)).forEach((rawPart) => {
    let part = rawPart;
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(0, 2).toString() === "--" || part.length === 0) return;

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) return;

    const headerLines = part.subarray(0, headerEnd).toString("utf8").split("\r\n");
    const headers = new Map<string, string>();
    headerLines.forEach((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return;
      headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
    });

    let partBody = part.subarray(headerEnd + 4);
    if (partBody.subarray(-2).toString() === "\r\n") partBody = partBody.subarray(0, -2);

    const disposition = parseDisposition(headers.get("content-disposition"));
    const name = disposition.name;
    if (!name) return;

    if (disposition.filename) {
      files.push({
        body: partBody,
        fileName: disposition.filename,
        contentType: headers.get("content-type") ?? "application/octet-stream",
      });
      return;
    }

    fields[name] = partBody.toString("utf8");
  });

  const file = files[0];
  if (!file) return null;
  return {
    body: file.body,
    fileName: file.fileName,
    contentType: file.contentType,
    fields,
  };
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

const withFileUrl = (document: CassaDocument): CassaDocument => ({
  ...document,
  fileUrl: document.fileUrl ?? `/api/cassa-file-download?id=${encodeURIComponent(document.id)}`,
});

const decodeBase64File = (value: string, fallbackContentType: string) => {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      contentType: match[1] || fallbackContentType,
      body: Buffer.from(match[2] || "", "base64"),
    };
  }

  return {
    contentType: fallbackContentType,
    body: Buffer.from(value, "base64"),
  };
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

const ensureStorageBucket = async (config: NonNullable<ReturnType<typeof getStorageConfig>>) => {
  const bucketResponse = await fetch(
    `${config.supabaseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,
    {
      headers: storageHeaders(config.serviceRoleKey),
    },
  );

  if (bucketResponse.ok) return;
  if (bucketResponse.status !== 404) {
    const message = await bucketResponse.text();
    throw new Error(`Bucket check failed (${bucketResponse.status}): ${message}`);
  }

  const createResponse = await fetch(`${config.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders(config.serviceRoleKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: config.bucket,
      name: config.bucket,
      public: false,
      file_size_limit: MAX_FILE_BYTES,
      allowed_mime_types: null,
    }),
  });

  if (!createResponse.ok && createResponse.status !== 400 && createResponse.status !== 409) {
    const message = await createResponse.text();
    throw new Error(`Bucket create failed (${createResponse.status}): ${message}`);
  }
};

const buildDocument = ({
  documentId,
  sedeId,
  data,
  tipo,
  bucket,
  storagePath,
  fileName,
  contentType,
  sizeBytes,
}: {
  documentId: string;
  sedeId: string;
  data: string;
  tipo: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): CassaDocument => ({
  id: documentId,
  data,
  sedeId,
  tipo,
  bucket,
  storagePath,
  fileName,
  fileUrl: `/api/cassa-file-download?id=${encodeURIComponent(documentId)}`,
  contentType,
  sizeBytes,
  uploadedAt: new Date().toISOString(),
});

const saveCassaDocument = async (document: CassaDocument) => {
  const state = await loadCassaState();
  const documenti = [
    ...(Array.isArray(state.documenti) ? state.documenti.filter(isCassaDocument) : [])
      .filter((item) => item.id !== document.id),
    document,
  ];

  await saveCassaState({ ...state, documenti });
  return withFileUrl(document);
};

router.get("/cassa-state", async (req, res) => {
  try {
    const state = await loadCassaState();
    res.json({
      ...state,
      documenti: Array.isArray(state.documenti) ? state.documenti.filter(isCassaDocument).map(withFileUrl) : [],
    });
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

const uploadCassaFileJson: RequestHandler = async (req, res) => {
  const config = getStorageConfig();
  if (!config) {
    res.status(503).json({
      error: "Supabase Storage non configurato",
      details: "Imposta SUPABASE_SERVICE_ROLE_KEY su Vercel.",
    });
    return;
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Upload documento cassa non valido" });
    return;
  }

  const documentId = sanitizeSegment(
    readBodyString(req.body.documentId) || readHeader(req.params.documentId),
    "documento",
  );
  const sedeId = sanitizeSegment(readBodyString(req.body.sedeId, "sede"), "sede");
  const data = sanitizeSegment(readBodyString(req.body.data, new Date().toISOString().slice(0, 10)), "data");
  const tipo = sanitizeSegment(readBodyString(req.body.tipo, "documento"), "documento");
  const fileName = sanitizeSegment(readBodyString(req.body.fileName, "documento.pdf"), "documento.pdf");
  const fallbackContentType = inferContentType(
    fileName,
    readBodyString(req.body.contentType, "application/octet-stream"),
  );
  const fileBase64 = readBodyString(req.body.fileBase64, "");
  const reportedSize = readBodyNumber(req.body.sizeBytes, 0);

  if (!fileBase64) {
    res.status(400).json({ error: "File mancante" });
    return;
  }

  if (reportedSize > MAX_FILE_BYTES) {
    res.status(413).json({ error: "File troppo grande. Il piano Free consente massimo 50 MB per file." });
    return;
  }

  const decodedFile = decodeBase64File(fileBase64, fallbackContentType);
  if (decodedFile.body.length === 0) {
    res.status(400).json({ error: "File mancante" });
    return;
  }

  if (decodedFile.body.length > MAX_FILE_BYTES) {
    res.status(413).json({ error: "File troppo grande. Il piano Free consente massimo 50 MB per file." });
    return;
  }

  const contentType = inferContentType(fileName, decodedFile.contentType);
  const storagePath = ["cassa", sedeId, data, tipo, `${Date.now()}-${fileName}`].join("/");

  try {
    await ensureStorageBucket(config);

    const uploadResponse = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${encodeURI(storagePath)}`,
      {
        method: "POST",
        headers: storageHeaders(config.serviceRoleKey, {
          "Content-Type": contentType,
          "Cache-Control": "3600",
          "x-upsert": "true",
        }),
        body: decodedFile.body,
      },
    );

    if (!uploadResponse.ok) {
      const message = await uploadResponse.text();
      req.log.error({ status: uploadResponse.status, message }, "Supabase Storage cassa JSON upload failed");
      res.status(502).json({ error: "Upload Supabase Storage non riuscito" });
      return;
    }

    const document = buildDocument({
      documentId,
      data,
      sedeId,
      tipo,
      bucket: config.bucket,
      storagePath,
      fileName,
      contentType,
      sizeBytes: decodedFile.body.length,
    });

    res.json(await saveCassaDocument(document));
  } catch (err) {
    req.log.error({ err }, "Failed to upload cassa JSON document");
    res.status(500).json({ error: "Internal server error" });
  }
};

router.post("/cassa-file-upload", uploadCassaFileJson);
router.post("/cassa-file-uploads/:documentId", uploadCassaFileJson);

const uploadCassaFile: RequestHandler = async (req, res) => {
  const config = getStorageConfig();
  if (!config) {
    res.status(503).json({
      error: "Supabase Storage non configurato",
      details: "Imposta SUPABASE_SERVICE_ROLE_KEY su Vercel.",
    });
    return;
  }

  const requestContentType = readHeader(req.headers["content-type"], "application/octet-stream");
  const multipartUpload = Buffer.isBuffer(req.body)
    ? parseMultipartUpload(req.body, requestContentType)
    : null;
  const body = multipartUpload?.body ?? (Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
  if (body.length === 0) {
    res.status(400).json({ error: "File mancante" });
    return;
  }

  if (body.length > MAX_FILE_BYTES) {
    res.status(413).json({ error: "File troppo grande. Il piano Free consente massimo 50 MB per file." });
    return;
  }

  const documentId = sanitizeSegment(readHeader(req.params.documentId), "documento");
  const sedeId = sanitizeSegment(
    multipartUpload?.fields.sedeId ?? readHeader(req.headers["x-sede-id"], "sede"),
    "sede",
  );
  const data = sanitizeSegment(
    multipartUpload?.fields.data ?? readHeader(req.headers["x-data"], new Date().toISOString().slice(0, 10)),
    "data",
  );
  const tipo = sanitizeSegment(
    multipartUpload?.fields.tipo ?? readHeader(req.headers["x-document-type"], "documento"),
    "documento",
  );
  const fileName = sanitizeSegment(
    multipartUpload?.fileName ?? readHeader(req.headers["x-file-name"], "documento.pdf"),
    "documento.pdf",
  );
  const contentType = inferContentType(
    fileName,
    multipartUpload?.contentType ?? readHeader(req.headers["content-type"], "application/octet-stream"),
  );
  const storagePath = ["cassa", sedeId, data, tipo, `${Date.now()}-${fileName}`].join("/");

  try {
    await ensureStorageBucket(config);

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

    const document = buildDocument({
      documentId,
      data,
      sedeId,
      tipo,
      bucket: config.bucket,
      storagePath,
      fileName,
      contentType,
      sizeBytes: body.length,
    });

    res.json(await saveCassaDocument(document));
  } catch (err) {
    req.log.error({ err }, "Failed to upload cassa document");
    res.status(500).json({ error: "Internal server error" });
  }
};

const signCassaFileUpload: RequestHandler = async (req, res) => {
  const config = getStorageConfig();
  if (!config) {
    res.status(503).json({
      error: "Supabase Storage non configurato",
      details: "Imposta SUPABASE_SERVICE_ROLE_KEY su Vercel.",
    });
    return;
  }

  try {
    await ensureStorageBucket(config);

    const documentId = sanitizeSegment(
      readBodyString(req.body?.documentId) || readHeader(req.params.documentId),
      "documento",
    );
    const sedeId = sanitizeSegment(readBodyString(req.body?.sedeId, "sede"), "sede");
    const data = sanitizeSegment(readBodyString(req.body?.data, new Date().toISOString().slice(0, 10)), "data");
    const tipo = sanitizeSegment(readBodyString(req.body?.tipo, "documento"), "documento");
    const fileName = sanitizeSegment(readBodyString(req.body?.fileName, "documento.jpg"), "documento.jpg");
    const contentType = inferContentType(fileName, readBodyString(req.body?.contentType, "application/octet-stream"));
    const sizeBytes = Number.isFinite(Number(req.body?.sizeBytes)) ? Number(req.body.sizeBytes) : 0;

    if (sizeBytes > MAX_FILE_BYTES) {
      res.status(413).json({ error: "File troppo grande. Il piano Free consente massimo 50 MB per file." });
      return;
    }

    const storagePath = ["cassa", sedeId, data, tipo, `${Date.now()}-${fileName}`].join("/");
    const signResponse = await fetch(
      `${config.supabaseUrl}/storage/v1/object/upload/sign/${config.bucket}/${encodeURI(storagePath)}`,
      {
        method: "POST",
        headers: storageHeaders(config.serviceRoleKey, {
          "Content-Type": "application/json",
          "x-upsert": "true",
        }),
        body: JSON.stringify({}),
      },
    );

    if (!signResponse.ok) {
      const message = await signResponse.text();
      req.log.error({ status: signResponse.status, message }, "Supabase Storage cassa signed URL failed");
      res.status(502).json({ error: "Creazione link upload Supabase non riuscita" });
      return;
    }

    const signData = await signResponse.json() as { url?: string; signedUrl?: string; signedURL?: string };
    const signedUrl = signData.signedUrl ?? signData.signedURL ??
      (signData.url?.startsWith("http") ? signData.url : signData.url ? `${config.supabaseUrl}/storage/v1${signData.url}` : "");

    if (!signedUrl) {
      res.status(502).json({ error: "Supabase non ha restituito un link di upload valido" });
      return;
    }

    res.json({
      signedUrl,
      document: buildDocument({
        documentId,
        data,
        sedeId,
        tipo,
        bucket: config.bucket,
        storagePath,
        fileName,
        contentType,
        sizeBytes,
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create cassa signed upload URL");
    res.status(500).json({ error: "Internal server error" });
  }
};

router.post("/cassa-file-sign", signCassaFileUpload);
router.post("/cassa-files/:documentId/sign", signCassaFileUpload);

const completeCassaFileUpload: RequestHandler = async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Documento cassa non valido" });
    return;
  }

  const candidate = req.body as Partial<CassaDocument>;
  const documentId = sanitizeSegment(readBodyString(candidate.id) || readHeader(req.params.documentId), "documento");
  if (
    candidate.id !== documentId ||
    !candidate.data ||
    !candidate.sedeId ||
    !candidate.tipo ||
    !candidate.bucket ||
    !candidate.storagePath ||
    !candidate.fileName ||
    !candidate.contentType ||
    typeof candidate.sizeBytes !== "number" ||
    !candidate.uploadedAt
  ) {
    res.status(400).json({ error: "Documento cassa non valido" });
    return;
  }

  try {
    res.json(await saveCassaDocument({
      id: documentId,
      data: candidate.data,
      sedeId: candidate.sedeId,
      tipo: candidate.tipo,
      bucket: candidate.bucket,
      storagePath: candidate.storagePath,
      fileName: candidate.fileName,
      fileUrl: `/api/cassa-file-download?id=${encodeURIComponent(documentId)}`,
      contentType: candidate.contentType,
      sizeBytes: candidate.sizeBytes,
      uploadedAt: candidate.uploadedAt,
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to complete cassa document upload");
    res.status(500).json({ error: "Internal server error" });
  }
};

router.post("/cassa-file-complete", completeCassaFileUpload);
router.post("/cassa-files/:documentId/complete", completeCassaFileUpload);

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
    const documentId = sanitizeSegment(
      readHeader(req.params.documentId) || readQueryValue(req.query["id"]),
      "documento",
    );
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
router.get("/cassa-file-download", downloadCassaFile);
router.get("/cassa-files/:documentId", downloadCassaFile);

export default router;
