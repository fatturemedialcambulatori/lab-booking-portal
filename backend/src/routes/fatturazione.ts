import { Router, type Response } from "express";
import {
  ArubaFatturazioneError,
  findArubaInvoices,
  getArubaCedenti,
  getArubaFatturazioneStatus,
  getArubaUserInfo,
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

export default router;
