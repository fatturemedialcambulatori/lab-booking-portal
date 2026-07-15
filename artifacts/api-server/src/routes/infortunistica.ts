import express, { Router } from "express";
import { eq } from "drizzle-orm";
import {
  adminSettingsTable,
  db,
  infortunisticaCertificatiFilesTable,
} from "@workspace/db";

const router = Router();

const STATE_KEY = "infortunistica-state";
const DEFAULT_BUCKET = "certificati-infortunistica";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

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

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

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
  if (lowerName.endsWith(".doc")) return "application/msword";
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/octet-stream";
};

router.get("/infortunistica-state", async (req, res) => {
  try {
    const [settings] = await db
      .select()
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, STATE_KEY))
      .limit(1);

    res.json(settings?.value ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to load infortunistica state");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/infortunistica-state", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Dati infortunistica non validi" });
    return;
  }

  try {
    const now = new Date();
    const [settings] = await db
      .insert(adminSettingsTable)
      .values({
        key: STATE_KEY,
        value: req.body,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set: {
          value: req.body,
          updatedAt: now,
        },
      })
      .returning();

    res.json(settings.value);
  } catch (err) {
    req.log.error({ err }, "Failed to save infortunistica state");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/infortunistica/certificati/files", async (req, res) => {
  try {
    const files = await db.select().from(infortunisticaCertificatiFilesTable);
    res.json(files);
  } catch (err) {
    req.log.error({ err }, "Failed to load infortunistica certificate files");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/infortunistica/certificati/:certificatoId/file",
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req, res) => {
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

    const certificatoId = sanitizeSegment(req.params.certificatoId, "certificato");
    const clienteId = sanitizeSegment(readHeader(req.headers["x-cliente-id"]), "cliente");
    const praticaId = sanitizeSegment(readHeader(req.headers["x-pratica-id"]), "pratica");
    const fileName = sanitizeSegment(readHeader(req.headers["x-file-name"], "certificato.pdf"), "certificato.pdf");
    const contentType = inferContentType(
      fileName,
      readHeader(req.headers["content-type"], "application/octet-stream"),
    );
    const storagePath = [
      clienteId,
      praticaId,
      certificatoId,
      `${Date.now()}-${fileName}`,
    ].join("/");

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
        req.log.error({ status: uploadResponse.status, message }, "Supabase Storage upload failed");
        res.status(502).json({ error: "Upload Supabase Storage non riuscito" });
        return;
      }

      const uploadedAt = new Date();
      const [file] = await db
        .insert(infortunisticaCertificatiFilesTable)
        .values({
          certificatoId,
          clienteId,
          praticaId,
          bucket: config.bucket,
          storagePath,
          fileName,
          contentType,
          sizeBytes: body.length,
          uploadedAt,
        })
        .onConflictDoUpdate({
          target: infortunisticaCertificatiFilesTable.certificatoId,
          set: {
            clienteId,
            praticaId,
            bucket: config.bucket,
            storagePath,
            fileName,
            contentType,
            sizeBytes: body.length,
            uploadedAt,
          },
        })
        .returning();

      res.json({
        ...file,
        fileUrl: `/api/infortunistica/certificati/${encodeURIComponent(certificatoId)}/file`,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to upload infortunistica certificate");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.get("/infortunistica/certificati/:certificatoId/file", async (req, res) => {
  const config = getStorageConfig();
  if (!config) {
    res.status(503).json({
      error: "Supabase Storage non configurato",
      details: "Imposta SUPABASE_SERVICE_ROLE_KEY su Vercel.",
    });
    return;
  }

  try {
    const [file] = await db
      .select()
      .from(infortunisticaCertificatiFilesTable)
      .where(eq(infortunisticaCertificatiFilesTable.certificatoId, req.params.certificatoId))
      .limit(1);

    if (!file) {
      res.status(404).json({ error: "File certificato non trovato" });
      return;
    }

    const downloadResponse = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${file.bucket}/${encodeURI(file.storagePath)}`,
      {
        headers: storageHeaders(config.serviceRoleKey),
      },
    );

    if (!downloadResponse.ok || !downloadResponse.body) {
      const message = await downloadResponse.text();
      req.log.error({ status: downloadResponse.status, message }, "Supabase Storage download failed");
      res.status(502).json({ error: "Download Supabase Storage non riuscito" });
      return;
    }

    const bytes = Buffer.from(await downloadResponse.arrayBuffer());
    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/"/g, "")}"`);
    res.send(bytes);
  } catch (err) {
    req.log.error({ err }, "Failed to download infortunistica certificate");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
