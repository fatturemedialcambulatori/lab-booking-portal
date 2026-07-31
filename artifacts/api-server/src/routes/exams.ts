import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { examsTable, examComponentsTable, examReferenceRangesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { CreateExamBody, UpdateExamBody } from "@workspace/api-zod";

const router = Router();
const CONTAINER_EXAM_TYPES = new Set(["composito", "pacchetto"]);

const isContainerExamType = (tipo: unknown) =>
  typeof tipo === "string" && CONTAINER_EXAM_TYPES.has(tipo);

async function loadExamComponents(packageExamId: number) {
  const components = await db
    .select({
      id: examComponentsTable.id,
      packageExamId: examComponentsTable.packageExamId,
      componentExamId: examComponentsTable.componentExamId,
      ordinamento: examComponentsTable.ordinamento,
      componentExam: examsTable,
    })
    .from(examComponentsTable)
    .leftJoin(examsTable, eq(examComponentsTable.componentExamId, examsTable.id))
    .where(eq(examComponentsTable.packageExamId, packageExamId))
    .orderBy(examComponentsTable.ordinamento);

  return components
    .filter((component) => component.componentExam)
    .map((component) => ({ ...component, componentExam: component.componentExam! }));
}

async function updateExamById(id: number, body: unknown, req: Request, res: Response) {
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID non valido" });
  }

  const parsed = UpdateExamBody.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dati non validi" });
  }

  try {
    const { componentIds, ...examData } = parsed.data as typeof parsed.data & { componentIds?: number[] };
    const [exam] = await db.update(examsTable)
      .set({
        codiceAnalisi: examData.codiceAnalisi,
        descrizione: examData.descrizione,
        colorProvetta: examData.colorProvetta ?? null,
        synlab: examData.synlab ?? false,
        um: examData.um ?? null,
        metodo: examData.metodo ?? null,
        regola: examData.regola ?? null,
        importo: examData.importo ?? null,
        valoreRiferimento: examData.valoreRiferimento ?? null,
        preparationInstructions: examData.preparationInstructions ?? "",
        tipo: (examData as any).tipo ?? "singolo",
      })
      .where(eq(examsTable.id, id))
      .returning();
    if (!exam) return res.status(404).json({ error: "Esame non trovato" });

    if (isContainerExamType((examData as any).tipo)) {
      await db.delete(examComponentsTable).where(eq(examComponentsTable.packageExamId, id));
      if (componentIds?.length) {
        await db.insert(examComponentsTable).values(
          componentIds.map((cid, i) => ({ packageExamId: id, componentExamId: cid, ordinamento: i }))
        );
      }
    } else {
      await db.delete(examComponentsTable).where(eq(examComponentsTable.packageExamId, id));
    }

    const components = await loadExamComponents(id);
    return res.json({ ...exam, components });
  } catch (err) {
    req.log.error({ err }, "Failed to update exam");
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function deleteExamById(id: number, req: Request, res: Response) {
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID non valido" });
  }

  try {
    const deleted = await db.delete(examsTable).where(eq(examsTable.id, id)).returning();
    if (deleted.length === 0) return res.status(404).json({ error: "Esame non trovato" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete exam");
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/exams", async (req, res) => {
  try {
    const exams = await db.select().from(examsTable).orderBy(examsTable.codiceAnalisi);

    const packageIds = exams.filter((e) => isContainerExamType(e.tipo)).map((e) => e.id);
    let componentsByPackage = new Map<number, { id: number; packageExamId: number; componentExamId: number; ordinamento: number; componentExam: typeof exams[0] }[]>();

    if (packageIds.length > 0) {
      const components = await db
        .select({
          id: examComponentsTable.id,
          packageExamId: examComponentsTable.packageExamId,
          componentExamId: examComponentsTable.componentExamId,
          ordinamento: examComponentsTable.ordinamento,
          componentExam: examsTable,
        })
        .from(examComponentsTable)
        .leftJoin(examsTable, eq(examComponentsTable.componentExamId, examsTable.id))
        .where(inArray(examComponentsTable.packageExamId, packageIds))
        .orderBy(examComponentsTable.ordinamento);

      for (const c of components) {
        if (!c.componentExam) continue;
        if (!componentsByPackage.has(c.packageExamId)) componentsByPackage.set(c.packageExamId, []);
        componentsByPackage.get(c.packageExamId)!.push({
          id: c.id,
          packageExamId: c.packageExamId,
          componentExamId: c.componentExamId,
          ordinamento: c.ordinamento,
          componentExam: c.componentExam,
        });
      }
    }

    const allRanges = await db
      .select()
      .from(examReferenceRangesTable)
      .orderBy(examReferenceRangesTable.ordinamento);

    const rangesByExam = new Map<number, typeof allRanges>();
    for (const r of allRanges) {
      if (!rangesByExam.has(r.examId)) rangesByExam.set(r.examId, []);
      rangesByExam.get(r.examId)!.push(r);
    }

    const result = exams.map((e) => ({
      ...e,
      tipo: e.tipo ?? "singolo",
      components: componentsByPackage.get(e.id) ?? [],
      referenceRanges: rangesByExam.get(e.id) ?? [],
    }));

    res.json(result);
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
    const { componentIds, ...examData } = parsed.data as typeof parsed.data & { componentIds?: number[] };
    const [exam] = await db.insert(examsTable).values({
      codiceAnalisi: examData.codiceAnalisi,
      descrizione: examData.descrizione,
      colorProvetta: examData.colorProvetta ?? null,
      synlab: examData.synlab ?? false,
      um: examData.um ?? null,
      metodo: examData.metodo ?? null,
      regola: examData.regola ?? null,
      importo: examData.importo ?? null,
      valoreRiferimento: examData.valoreRiferimento ?? null,
      preparationInstructions: examData.preparationInstructions ?? "",
      tipo: (examData as any).tipo ?? "singolo",
    }).returning();

    if (isContainerExamType((examData as any).tipo) && componentIds?.length) {
      await db.insert(examComponentsTable).values(
        componentIds.map((cid, i) => ({ packageExamId: exam.id, componentExamId: cid, ordinamento: i }))
      );
    }

    const components = isContainerExamType((examData as any).tipo) ? await loadExamComponents(exam.id) : [];
    return res.status(201).json({ ...exam, components });
  } catch (err) {
    req.log.error({ err }, "Failed to create exam");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/exams/:id", async (req, res) => {
  return updateExamById(Number(req.params.id), req.body, req, res);
});

router.post("/exams-update", async (req, res) => {
  const rawBody = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const { id: rawId, ...body } = rawBody;
  return updateExamById(Number(rawId), body, req, res);
});

router.delete("/exams/:id", async (req, res) => {
  return deleteExamById(Number(req.params.id), req, res);
});

router.post("/exams-delete", async (req, res) => {
  const id = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? Number((req.body as Record<string, unknown>)["id"])
    : NaN;
  return deleteExamById(id, req, res);
});

export default router;
