import { Router, type RequestHandler } from "express";
import { db, pool } from "@workspace/db";
import { patientsTable } from "@workspace/db";
import { and, eq, ilike, or, inArray } from "drizzle-orm";
import { CreatePatientBody, UpdatePatientBody } from "@workspace/api-zod";

const router = Router();
const MAX_BULK_ERRORS = 50;
const RECORD_TYPES = ["privato", "azienda", "societa_sportiva"] as const;
type RecordType = typeof RECORD_TYPES[number];

const toDateStr = (v: string | Date | null): string =>
  !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

const importErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message.slice(0, 180) : "errore di inserimento";

type BulkPatient = {
  recordType: RecordType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  codiceFiscale: string | null;
  gender: "M" | "F" | null;
  companyName: string | null;
  vatNumber: string | null;
  contactPerson: string | null;
  notes: string | null;
  billingAddress: string | null;
  billingCap: string | null;
  billingCity: string | null;
  billingProvincia: string | null;
};

const normalizePhoneKey = (phone: string) => phone.replace(/\s+/g, "");

const uniqueNonEmpty = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));

let patientRegistryColumnsPromise: Promise<void> | null = null;

const ensurePatientRegistryColumns = () => {
  patientRegistryColumnsPromise ??= pool.query(`
    alter table public.patients
      add column if not exists record_type text not null default 'privato',
      add column if not exists company_name text,
      add column if not exists vat_number text,
      add column if not exists contact_person text
  `).then(() => undefined);
  return patientRegistryColumnsPromise;
};

const normalizeRecordType = (value: unknown): RecordType => {
  const text = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (text === "azienda" || text === "company" || text === "impresa") return "azienda";
  if (text === "societa_sportiva" || text === "società_sportiva" || text === "societa" || text === "sportiva") {
    return "societa_sportiva";
  }
  return "privato";
};

function normalizeBulkPatient(row: unknown): BulkPatient {
  const data = row && typeof row === "object" ? row as Record<string, unknown> : {};
  const companyName = String(data["companyName"] ?? data["ragioneSociale"] ?? data["azienda"] ?? "").trim();
  const rawRecordType = data["recordType"] ?? data["tipo"] ?? data["tipoAnagrafica"];
  const recordType = rawRecordType ? normalizeRecordType(rawRecordType) : companyName ? "azienda" : "privato";
  const firstName = String(data["firstName"] ?? "").trim() || (recordType === "privato" ? "" : "Referente");
  const lastName = String(data["lastName"] ?? "").trim() || (recordType === "privato" ? "" : companyName);
  const email = String(data["email"] ?? "").trim();
  const phone = String(data["phone"] ?? "").trim().replace(/^'+/, "").trim();
  const dateOfBirth = toDateStr(String(data["dateOfBirth"] ?? "").trim()) || (recordType === "privato" ? "1900-01-01" : "1900-01-01");
  const codiceFiscale = String(data["codiceFiscale"] ?? "").trim().toUpperCase() || null;
  const genderText = String(data["gender"] ?? "").trim().toUpperCase();
  const gender = genderText === "M" || genderText === "MALE" || genderText === "MASCHIO"
    ? "M"
    : genderText === "F" || genderText === "FEMALE" || genderText === "FEMMINA"
      ? "F"
      : null;

  return {
    recordType,
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    codiceFiscale,
    gender,
    companyName: companyName || null,
    vatNumber: String(data["vatNumber"] ?? data["partitaIva"] ?? data["piva"] ?? "").trim().toUpperCase() || null,
    contactPerson: String(data["contactPerson"] ?? data["referente"] ?? "").trim() || null,
    notes: String(data["notes"] ?? "").trim() || null,
    billingAddress: String(data["billingAddress"] ?? "").trim() || null,
    billingCap: String(data["billingCap"] ?? "").trim() || null,
    billingCity: String(data["billingCity"] ?? "").trim() || null,
    billingProvincia: String(data["billingProvincia"] ?? "").trim() || null,
  };
}

function formatPatient(p: typeof patientsTable.$inferSelect) {
  return {
    id: p.id,
    recordType: p.recordType ?? "privato",
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: toDateStr(p.dateOfBirth as string | Date),
    codiceFiscale: p.codiceFiscale,
    gender: p.gender,
    companyName: p.companyName,
    vatNumber: p.vatNumber,
    contactPerson: p.contactPerson,
    email: p.email,
    phone: p.phone,
    notes: p.notes,
    billingAddress: p.billingAddress,
    billingCap: p.billingCap,
    billingCity: p.billingCity,
    billingProvincia: p.billingProvincia,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/patients", async (req, res) => {
  try {
    await ensurePatientRegistryColumns();
    const search = (req.query["search"] as string | undefined)?.trim();
    const recordType = normalizeRecordType(req.query["recordType"]);
    const hasRecordTypeFilter = typeof req.query["recordType"] === "string" && RECORD_TYPES.includes(recordType);
    const rawLimit = Number(req.query["limit"] ?? 100);
    const rawOffset = Number(req.query["offset"] ?? 0);
    const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.floor(rawLimit))) : 100;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
    let rows;
    if (search) {
      const pattern = `%${search}%`;
      const searchWhere = or(
        ilike(patientsTable.firstName, pattern),
        ilike(patientsTable.lastName, pattern),
        ilike(patientsTable.email, pattern),
        ilike(patientsTable.phone, pattern),
        ilike(patientsTable.codiceFiscale, pattern),
        ilike(patientsTable.companyName, pattern),
        ilike(patientsTable.vatNumber, pattern),
        ilike(patientsTable.contactPerson, pattern)
      );
      rows = await db
        .select()
        .from(patientsTable)
        .where(hasRecordTypeFilter ? and(searchWhere, eq(patientsTable.recordType, recordType)) : searchWhere)
        .orderBy(patientsTable.lastName, patientsTable.firstName)
        .limit(limit)
        .offset(offset);
    } else if (hasRecordTypeFilter) {
      rows = await db
        .select()
        .from(patientsTable)
        .where(eq(patientsTable.recordType, recordType))
        .orderBy(patientsTable.lastName, patientsTable.firstName)
        .limit(limit)
        .offset(offset);
    } else {
      rows = await db
        .select()
        .from(patientsTable)
        .orderBy(patientsTable.lastName, patientsTable.firstName)
        .limit(limit)
        .offset(offset);
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
    await ensurePatientRegistryColumns();
    const d = parsed.data;
    const [inserted] = await db
      .insert(patientsTable)
      .values({
        recordType: d.recordType ?? "privato",
        firstName: d.firstName,
        lastName: d.lastName,
        dateOfBirth: toDateStr(d.dateOfBirth as string | Date),
        codiceFiscale: d.codiceFiscale ?? null,
        gender: d.gender ?? null,
        companyName: d.companyName ?? null,
        vatNumber: d.vatNumber ?? null,
        contactPerson: d.contactPerson ?? null,
        email: d.email,
        phone: d.phone,
        notes: d.notes ?? null,
        billingAddress: d.billingAddress ?? null,
        billingCap: d.billingCap ?? null,
        billingCity: d.billingCity ?? null,
        billingProvincia: d.billingProvincia ?? null,
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
    await ensurePatientRegistryColumns();
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
      ...(d.recordType !== undefined && { recordType: d.recordType }),
      ...(d.firstName !== undefined && { firstName: d.firstName }),
      ...(d.lastName !== undefined && { lastName: d.lastName }),
      ...(d.dateOfBirth !== undefined && { dateOfBirth: toDateStr(d.dateOfBirth as string | Date) }),
      ...(d.codiceFiscale !== undefined && { codiceFiscale: d.codiceFiscale }),
      ...(d.gender !== undefined && { gender: d.gender }),
      ...(d.companyName !== undefined && { companyName: d.companyName }),
      ...(d.vatNumber !== undefined && { vatNumber: d.vatNumber }),
      ...(d.contactPerson !== undefined && { contactPerson: d.contactPerson }),
      ...(d.email !== undefined && { email: d.email }),
      ...(d.phone !== undefined && { phone: d.phone }),
      ...(d.notes !== undefined && { notes: d.notes }),
      ...(d.billingAddress !== undefined && { billingAddress: d.billingAddress }),
      ...(d.billingCap !== undefined && { billingCap: d.billingCap }),
      ...(d.billingCity !== undefined && { billingCity: d.billingCity }),
      ...(d.billingProvincia !== undefined && { billingProvincia: d.billingProvincia }),
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
    await ensurePatientRegistryColumns();
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

const bulkImportPatients: RequestHandler = async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Provide a non-empty array of patients" });
    return;
  }

  let created = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];

  const addError = (message: string) => {
    errorCount++;
    if (errors.length < MAX_BULK_ERRORS) errors.push(message);
  };

  const normalizedRows = rows.map(normalizeBulkPatient);
  const validRows: BulkPatient[] = [];

  for (const row of normalizedRows) {
    if (!row.firstName || !row.lastName) {
      addError(`Riga saltata (nome o cognome mancante): ${row.firstName} ${row.lastName}`);
    } else {
      validRows.push(row);
    }
  }

  try {
    await ensurePatientRegistryColumns();
    const codiceFiscaleValues = uniqueNonEmpty(validRows.map((row) => row.codiceFiscale));
    const emailValues = uniqueNonEmpty(validRows.map((row) => row.email));
    const phoneValues = uniqueNonEmpty(validRows.map((row) => normalizePhoneKey(row.phone)));

    const [existingByCfRows, existingByEmailRows, existingByPhoneRows] = await Promise.all([
      codiceFiscaleValues.length
        ? db
            .select({ codiceFiscale: patientsTable.codiceFiscale })
            .from(patientsTable)
            .where(inArray(patientsTable.codiceFiscale, codiceFiscaleValues))
        : Promise.resolve([]),
      emailValues.length
        ? db
            .select({ email: patientsTable.email })
            .from(patientsTable)
            .where(inArray(patientsTable.email, emailValues))
        : Promise.resolve([]),
      phoneValues.length
        ? db
            .select({ phone: patientsTable.phone })
            .from(patientsTable)
            .where(inArray(patientsTable.phone, phoneValues))
        : Promise.resolve([]),
    ]);

    const existingCfs = new Set(existingByCfRows.map((row) => String(row.codiceFiscale ?? "").toUpperCase()).filter(Boolean));
    const existingEmails = new Set(existingByEmailRows.map((row) => row.email.trim().toLocaleLowerCase("it-IT")).filter(Boolean));
    const existingPhones = new Set(existingByPhoneRows.map((row) => normalizePhoneKey(row.phone)).filter(Boolean));
    const seenCfs = new Set<string>();
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const insertRows: Array<typeof patientsTable.$inferInsert> = [];

    for (const row of validRows) {
      const cfKey = row.codiceFiscale?.toUpperCase() ?? "";
      const emailKey = row.email.toLocaleLowerCase("it-IT");
      const phoneKey = normalizePhoneKey(row.phone);
      const duplicate =
        (cfKey && (existingCfs.has(cfKey) || seenCfs.has(cfKey))) ||
        (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) ||
        (phoneKey && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey)));

      if (duplicate) {
        skipped++;
        continue;
      }

      if (cfKey) seenCfs.add(cfKey);
      if (emailKey) seenEmails.add(emailKey);
      if (phoneKey) seenPhones.add(phoneKey);
      insertRows.push(row);
    }

    if (insertRows.length > 0) {
      await db.insert(patientsTable).values(insertRows);
      created = insertRows.length;
    }
  } catch (err) {
    req.log.error({ err }, "Bulk import batch error");
    addError(`Errore import batch: ${importErrorMessage(err)}`);
  }

  if (errorCount > errors.length) {
    errors.push(`Altri ${errorCount - errors.length} errori non mostrati.`);
  }

  res.json({ created, skipped, errors, errorCount });
};

router.post("/patients-bulk", bulkImportPatients);
router.post("/patients/bulk", bulkImportPatients);

export default router;
