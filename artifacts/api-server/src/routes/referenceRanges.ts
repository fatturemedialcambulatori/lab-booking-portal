import { Router } from "express";
import { db } from "@workspace/db";
import { examReferenceRangesTable, type Fascia } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/exams/:id/reference-ranges", async (req, res) => {
  const examId = Number(req.params.id);
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
});

router.post("/exams/:id/reference-ranges", async (req, res) => {
  const examId = Number(req.params.id);
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
  } = req.body as Record<string, unknown>;

  if (!tipo || !["range", "qualitative", "fasce"].includes(tipo as string)) {
    return res.status(400).json({ error: "tipo deve essere range, qualitative o fasce" });
  }

  try {
    const [range] = await db.insert(examReferenceRangesTable).values({
      examId,
      gender: (gender as string | null) ?? null,
      ageMin: ageMin != null ? Number(ageMin) : null,
      ageMax: ageMax != null ? Number(ageMax) : null,
      statoFisiologico: (statoFisiologico as string | null) ?? null,
      tipo: tipo as string,
      valoreMin: valoreMin != null ? String(valoreMin) : null,
      valoreMax: valoreMax != null ? String(valoreMax) : null,
      valoriAccettabili: (valoriAccettabili as string | null) ?? null,
      fasce: (fasce as Fascia[] | null) ?? null,
      unita: (unita as string | null) ?? null,
      note: (note as string | null) ?? null,
      ordinamento: ordinamento != null ? Number(ordinamento) : 0,
    }).returning();

    return res.status(201).json(range);
  } catch (err) {
    req.log.error({ err }, "Failed to create reference range");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/exams/:id/reference-ranges/:rangeId", async (req, res) => {
  const examId = Number(req.params.id);
  const rangeId = Number(req.params.rangeId);
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
  } = req.body as Record<string, unknown>;

  try {
    const [range] = await db
      .update(examReferenceRangesTable)
      .set({
        gender: (gender as string | null) ?? null,
        ageMin: ageMin != null ? Number(ageMin) : null,
        ageMax: ageMax != null ? Number(ageMax) : null,
        statoFisiologico: (statoFisiologico as string | null) ?? null,
        tipo: tipo as string,
        valoreMin: valoreMin != null ? String(valoreMin) : null,
        valoreMax: valoreMax != null ? String(valoreMax) : null,
        valoriAccettabili: (valoriAccettabili as string | null) ?? null,
        fasce: (fasce as Fascia[] | null) ?? null,
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
});

router.delete("/exams/:id/reference-ranges/:rangeId", async (req, res) => {
  const examId = Number(req.params.id);
  const rangeId = Number(req.params.rangeId);
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
});

export default router;
