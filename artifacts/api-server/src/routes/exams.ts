import { Router } from "express";
import { db } from "@workspace/db";
import { examsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateExamBody, UpdateExamBody, DeleteExamParams } from "@workspace/api-zod";

const router = Router();

router.get("/exams", async (req, res) => {
  try {
    const exams = await db.select().from(examsTable).orderBy(examsTable.codiceAnalisi);
    res.json(exams);
  } catch (err) {
    req.log.error({ err }, "Failed to list exams");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/exams", async (req, res) => {
  const parsed = CreateExamBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dati non validi" });
  }
  try {
    const [exam] = await db.insert(examsTable).values({
      codiceAnalisi: parsed.data.codiceAnalisi,
      descrizione: parsed.data.descrizione,
      colorProvetta: parsed.data.colorProvetta ?? null,
      synlab: parsed.data.synlab ?? false,
      um: parsed.data.um ?? null,
      metodo: parsed.data.metodo ?? null,
      regola: parsed.data.regola ?? null,
      importo: parsed.data.importo ?? null,
      valoreRiferimento: parsed.data.valoreRiferimento ?? null,
      preparationInstructions: parsed.data.preparationInstructions ?? "",
    }).returning();
    res.status(201).json(exam);
  } catch (err) {
    req.log.error({ err }, "Failed to create exam");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/exams/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID non valido" });

  const parsed = UpdateExamBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dati non validi" });
  }
  try {
    const [exam] = await db.update(examsTable)
      .set({
        codiceAnalisi: parsed.data.codiceAnalisi,
        descrizione: parsed.data.descrizione,
        colorProvetta: parsed.data.colorProvetta ?? null,
        synlab: parsed.data.synlab ?? false,
        um: parsed.data.um ?? null,
        metodo: parsed.data.metodo ?? null,
        regola: parsed.data.regola ?? null,
        importo: parsed.data.importo ?? null,
        valoreRiferimento: parsed.data.valoreRiferimento ?? null,
        preparationInstructions: parsed.data.preparationInstructions ?? "",
      })
      .where(eq(examsTable.id, id))
      .returning();
    if (!exam) return res.status(404).json({ error: "Esame non trovato" });
    res.json(exam);
  } catch (err) {
    req.log.error({ err }, "Failed to update exam");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/exams/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID non valido" });
  try {
    const deleted = await db.delete(examsTable).where(eq(examsTable.id, id)).returning();
    if (deleted.length === 0) return res.status(404).json({ error: "Esame non trovato" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete exam");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
