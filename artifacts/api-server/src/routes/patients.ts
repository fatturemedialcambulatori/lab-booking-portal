import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { CreatePatientBody, UpdatePatientBody } from "@workspace/api-zod";

const router = Router();

const toDateStr = (v: string | Date | null): string =>
  !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

function formatPatient(p: typeof patientsTable.$inferSelect) {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: toDateStr(p.dateOfBirth as string | Date),
    codiceFiscale: p.codiceFiscale,
    gender: p.gender,
    email: p.email,
    phone: p.phone,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/patients", async (req, res) => {
  try {
    const search = (req.query["search"] as string | undefined)?.trim();
    let rows;
    if (search) {
      const pattern = `%${search}%`;
      rows = await db
        .select()
        .from(patientsTable)
        .where(
          or(
            ilike(patientsTable.firstName, pattern),
            ilike(patientsTable.lastName, pattern),
            ilike(patientsTable.email, pattern),
            ilike(patientsTable.phone, pattern)
          )
        )
        .orderBy(patientsTable.lastName, patientsTable.firstName);
    } else {
      rows = await db
        .select()
        .from(patientsTable)
        .orderBy(patientsTable.lastName, patientsTable.firstName);
    }
    res.json(rows.map(formatPatient));
  } catch (err) {
    req.log.error({ err }, "Failed to list patients");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/patients", async (req, res) => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid patient data" });
    return;
  }
  try {
    const d = parsed.data;
    const [inserted] = await db
      .insert(patientsTable)
      .values({
        firstName: d.firstName,
        lastName: d.lastName,
        dateOfBirth: toDateStr(d.dateOfBirth as string | Date),
        codiceFiscale: d.codiceFiscale ?? null,
        gender: d.gender ?? null,
        email: d.email,
        phone: d.phone,
        notes: d.notes ?? null,
      })
      .returning();
    res.status(201).json(formatPatient(inserted));
  } catch (err) {
    req.log.error({ err }, "Failed to create patient");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/patients/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid patient ID" });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid patient data" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const d = parsed.data;
    const update: Partial<typeof patientsTable.$inferInsert> = {
      ...(d.firstName !== undefined && { firstName: d.firstName }),
      ...(d.lastName !== undefined && { lastName: d.lastName }),
      ...(d.dateOfBirth !== undefined && { dateOfBirth: toDateStr(d.dateOfBirth as string | Date) }),
      ...(d.codiceFiscale !== undefined && { codiceFiscale: d.codiceFiscale }),
      ...(d.gender !== undefined && { gender: d.gender }),
      ...(d.email !== undefined && { email: d.email }),
      ...(d.phone !== undefined && { phone: d.phone }),
      ...(d.notes !== undefined && { notes: d.notes }),
    };

    const [updated] = await db
      .update(patientsTable)
      .set(update)
      .where(eq(patientsTable.id, id))
      .returning();
    res.json(formatPatient(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update patient");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/patients/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid patient ID" });
    return;
  }

  try {
    const deleted = await db
      .delete(patientsTable)
      .where(eq(patientsTable.id, id))
      .returning();
    if (!deleted.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete patient");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
