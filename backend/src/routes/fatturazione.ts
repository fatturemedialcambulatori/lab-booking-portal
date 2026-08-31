import { Router, type Response } from "express";
import {
  ArubaFatturazioneError,
  findArubaInvoices,
  getArubaInvoiceSyncState,
  getCachedArubaInvoices,
  getArubaCedenti,
  getArubaFatturazioneStatus,
  getArubaUserInfo,
  startArubaInvoiceSync,
  type ArubaInvoiceDirection,
} from "../lib/arubaFatturazione";
import { requireAnyPermission } from "../lib/auth";

const router = Router();

const readQueryString = (value: unknown) => {
  if (Array.isArray(value)) return readQueryString(value[0]);
  return typeof value === "string" ? value.trim() : "";
};

const handleArubaError = (err: unknown, res: Response) => {
  if (err instanceof ArubaFatturazioneError) {
    res.status(err.statusCode).json({
      error: err.message,
      providerStatus: err.providerStatus,
      providerMessage: err.providerMessage,
      operation: err.operation,
      hint: err.hint,
      retryAfterSeconds: err.retryAfterSeconds,
    });
    return;
  }

  res.status(500).json({ error: "Errore interno fatturazione" });
};

router.use("/fatturazione", requireAnyPermission(["admin"]));

router.get("/fatturazione/status", (_req, res) => {
  res.json(getArubaFatturazioneStatus());
});

router.get("/fatturazione/user-info", async (req, res) => {
  try {
    res.json({ data: await getArubaUserInfo() });
  } catch (err) {
    req.log.warn({ message: err instanceof Error ? err.message : "Aruba user info error" }, "Aruba user info failed");
    handleArubaError(err, res);
  }
});

router.get("/fatturazione/cedenti", async (req, res) => {
  try {
    res.json({ data: await getArubaCedenti() });
  } catch (err) {
    req.log.warn({ message: err instanceof Error ? err.message : "Aruba cedenti error" }, "Aruba cedenti failed");
    handleArubaError(err, res);
  }
});

router.get("/fatturazione/invoices", async (req, res) => {
  try {
    const direction = readQueryString(req.query["direction"]) === "in" ? "in" : "out";
    res.json(await findArubaInvoices({
      direction: direction as ArubaInvoiceDirection,
      page: req.query["page"],
      size: req.query["size"],
      creationStartDate: req.query["creationStartDate"],
      creationEndDate: req.query["creationEndDate"],
      status: req.query["status"],
      documentType: req.query["documentType"],
    }));
  } catch (err) {
    req.log.warn({ message: err instanceof Error ? err.message : "Aruba invoices error" }, "Aruba invoices failed");
    handleArubaError(err, res);
  }
});

router.get("/fatturazione/cache", async (req, res) => {
  try {
    const direction = readQueryString(req.query["direction"]) === "in" ? "in" : "out";
    res.json(await getCachedArubaInvoices({
      direction: direction as ArubaInvoiceDirection,
      page: req.query["page"],
      size: req.query["size"],
      creationStartDate: req.query["creationStartDate"],
      creationEndDate: req.query["creationEndDate"],
      status: req.query["status"],
      documentType: req.query["documentType"],
    }));
  } catch (err) {
    req.log.warn({ message: err instanceof Error ? err.message : "Aruba cache error" }, "Aruba cache failed");
    handleArubaError(err, res);
  }
});

router.get("/fatturazione/sync", async (req, res) => {
  try {
    res.json({ sync: await getArubaInvoiceSyncState() });
  } catch (err) {
    req.log.warn({ message: err instanceof Error ? err.message : "Aruba sync status error" }, "Aruba sync status failed");
    handleArubaError(err, res);
  }
});

router.post("/fatturazione/sync", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const direction = readQueryString(body["direction"]) === "in" ? "in" : "out";
    res.status(202).json({
      sync: await startArubaInvoiceSync({
        direction: direction as ArubaInvoiceDirection,
        creationStartDate: body["creationStartDate"],
        creationEndDate: body["creationEndDate"],
        size: body["size"],
      }),
    });
  } catch (err) {
    req.log.warn({ message: err instanceof Error ? err.message : "Aruba sync start error" }, "Aruba sync start failed");
    handleArubaError(err, res);
  }
});

export default router;
