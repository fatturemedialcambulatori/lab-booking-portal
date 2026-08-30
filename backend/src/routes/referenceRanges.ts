import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { examReferenceRangesTable, type Fascia } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAnyPermission } from "../lib/auth";

const router = Router();
const VALID_REFERENCE_RANGE_TYPES = ["range", "gt", "gte", "lt", "lte", "qualitative", "fasce"] as const;
const requireReferenceRangeManagement = requireAnyPermission([
  "laboratorio.listino.write",
  "ambulatorio.prestazioni.write",
  "impostazioni",
]);

const isReferenceRangeType = (value: unknown): value is (typeof VALID_REFERENCE_RANGE_TYPES)[number] =>
  typeof value === "string" && (VALID_REFERENCE_RANGE_TYPES as readonly string[]).includes(value);

const parseMedicalNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim().replace(",", ".");
  const fraction = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (!Number.isFinite(denominator) || denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeFasce = (value: unknown): Fascia[] | null => {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => ({
      label: String(item["label"] ?? `Fascia ${index + 1}`).trim() || `Fascia ${index + 1}`,
      min: parseMedicalNumber(item["min"]) ?? undefined,
      minOp: item["minOp"] === ">" ? ">" : item["minOp"] === ">=" ? ">=" : undefined,
      max: parseMedicalNumber(item["max"]) ?? undefined,
      maxOp: item["maxOp"] === "<=" ? "<=" : item["maxOp"] === "<" ? "<" : undefined,
      color:
        item["color"] === "yellow" || item["color"] === "orange" || item["color"] === "red" || item["color"] === "green"
          ? item["color"]
          : undefined,
      nota: typeof item["nota"] === "string" && item["nota"].trim() ? item["nota"].trim() : undefined,
    }));
};

async function listReferenceRangesByExamId(examId: number, req: Request, res: Response) {
  if (!Number.isInteger(examId)) return res.status(400).json({ error: "ID non valido" });
  try {
    const ranges = await db
      .select()
      .from(examReferenceRangesTable)
      .where(eq(examReferenceRangesTable.examId, examId))
      .orderBy(examReferenceRangesTable.ordinamento);
    return res.json(ranges);
  } catch (err) {
    req.log.error({ err }, "Failed to list reference ranges");
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function createReferenceRangeForExam(examId: number, body: unknown, req: Request, res: Response) {
  if (!Number.isInteger(examId)) return res.status(400).json({ error: "ID non valido" });

  const {
    gender,
    ageMin,
    ageMax,
    statoFisiologico,
    tipo,
    valoreMin,
    valoreMax,
    valoriAccettabili,
    fasce,
    unita,
    note,
    ordinamento,
  } = body as Record<string, unknown>;

  if (!isReferenceRangeType(tipo)) {
    return res.status(400).json({ error: "tipo deve essere range, gt, gte, lt, lte, qualitative o fasce" });
  }

  try {
    const [range] = await db.insert(examReferenceRangesTable).values({
      examId,
      gender: (gender as string | null) ?? null,
      ageMin: ageMin != null ? Number(ageMin) : null,
      ageMax: ageMax != null ? Number(ageMax) : null,
      statoFisiologico: (statoFisiologico as string | null) ?? null,
      tipo,
      valoreMin: valoreMin != null ? String(valoreMin) : null,
      valoreMax: valoreMax != null ? String(valoreMax) : null,
      valoriAccettabili: (valoriAccettabili as string | null) ?? null,
      fasce: tipo === "fasce" ? normalizeFasce(fasce) : null,
      unita: (unita as string | null) ?? null,
      note: (note as string | null) ?? null,
      ordinamento: ordinamento != null ? Number(ordinamento) : 0,
    }).returning();

    return res.status(201).json(range);
  } catch (err) {
    req.log.error({ err }, "Failed to create reference range");
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function updateReferenceRangeById(
  examId: number,
  rangeId: number,
  body: unknown,
  req: Request,
  res: Response,
) {
  if (!Number.isInteger(examId) || !Number.isInteger(rangeId)) {
    return res.status(400).json({ error: "ID non valido" });
  }

  const {
    gender,
    ageMin,
    ageMax,
    statoFisiologico,
    tipo,
    valoreMin,
    valoreMax,
    valoriAccettabili,
    fasce,
    unita,
    note,
    ordinamento,
  } = body as Record<string, unknown>;

  if (!isReferenceRangeType(tipo)) {
    return res.status(400).json({ error: "tipo deve essere range, gt, gte, lt, lte, qualitative o fasce" });
  }

  try {
    const [range] = await db
      .update(examReferenceRangesTable)
      .set({
        gender: (gender as string | null) ?? null,
        ageMin: ageMin != null ? Number(ageMin) : null,
        ageMax: ageMax != null ? Number(ageMax) : null,
        statoFisiologico: (statoFisiologico as string | null) ?? null,
        tipo,
        valoreMin: valoreMin != null ? String(valoreMin) : null,
        valoreMax: valoreMax != null ? String(valoreMax) : null,
        valoriAccettabili: (valoriAccettabili as string | null) ?? null,
        fasce: tipo === "fasce" ? normalizeFasce(fasce) : null,
        unita: (unita as string | null) ?? null,
        note: (note as string | null) ?? null,
        ordinamento: ordinamento != null ? Number(ordinamento) : 0,
      })
      .where(and(eq(examReferenceRangesTable.id, rangeId), eq(examReferenceRangesTable.examId, examId)))
      .returning();

    if (!range) return res.status(404).json({ error: "Range non trovato" });
    return res.json(range);
  } catch (err) {
    req.log.error({ err }, "Failed to update reference range");
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function deleteReferenceRangeById(examId: number, rangeId: number, req: Request, res: Response) {
  if (!Number.isInteger(examId) || !Number.isInteger(rangeId)) {
    return res.status(400).json({ error: "ID non valido" });
  }

  try {
    const deleted = await db
      .delete(examReferenceRangesTable)
      .where(and(eq(examReferenceRangesTable.id, rangeId), eq(examReferenceRangesTable.examId, examId)))
      .returning();
    if (deleted.length === 0) return res.status(404).json({ error: "Range non trovato" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete reference range");
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/exams/:id/reference-ranges", async (req, res) => {
  return listReferenceRangesByExamId(Number(req.params.id), req, res);
});

router.get("/exam-reference-ranges", async (req, res) => {
  return listReferenceRangesByExamId(Number(req.query["examId"]), req, res);
});

router.post("/exams/:id/reference-ranges", requireReferenceRangeManagement, async (req, res) => {
  return createReferenceRangeForExam(Number(req.params.id), req.body, req, res);
});

router.post("/exam-reference-ranges", requireReferenceRangeManagement, async (req, res) => {
  const rawBody = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const { examId: rawExamId, ...body } = rawBody;
  return createReferenceRangeForExam(Number(rawExamId), body, req, res);
});

router.put("/exams/:id/reference-ranges/:rangeId", requireReferenceRangeManagement, async (req, res) => {
  return updateReferenceRangeById(Number(req.params.id), Number(req.params.rangeId), req.body, req, res);
});

router.post("/exam-reference-ranges-update", requireReferenceRangeManagement, async (req, res) => {
  const rawBody = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const { examId: rawExamId, rangeId: rawRangeId, ...body } = rawBody;
  return updateReferenceRangeById(Number(rawExamId), Number(rawRangeId), body, req, res);
});

router.delete("/exams/:id/reference-ranges/:rangeId", requireReferenceRangeManagement, async (req, res) => {
  return deleteReferenceRangeById(Number(req.params.id), Number(req.params.rangeId), req, res);
});

router.post("/exam-reference-ranges-delete", requireReferenceRangeManagement, async (req, res) => {
  const examId = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? Number((req.body as Record<string, unknown>)["examId"])
    : NaN;
  const rangeId = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? Number((req.body as Record<string, unknown>)["rangeId"])
    : NaN;
  return deleteReferenceRangeById(examId, rangeId, req, res);
});

export default router;
