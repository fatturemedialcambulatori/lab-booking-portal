import { Router } from "express";
import { listAuditLogs } from "../lib/audit";
import { requireAnyPermission } from "../lib/auth";

const router = Router();

const readQueryString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const readQueryNumber = (value: unknown) => {
  const parsed = Number(readQueryString(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

router.get("/audit-logs", requireAnyPermission(["admin"]), async (req, res) => {
  try {
    const outcome = readQueryString(req.query["outcome"]);
    res.json(await listAuditLogs({
      page: readQueryNumber(req.query["page"]),
      pageSize: readQueryNumber(req.query["pageSize"]),
      actor: readQueryString(req.query["actor"]),
      action: readQueryString(req.query["action"]),
      entityType: readQueryString(req.query["entityType"]),
      outcome: ["success", "blocked", "error"].includes(outcome) ? outcome : "",
      from: readQueryString(req.query["from"]),
      to: readQueryString(req.query["to"]),
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to load audit logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
