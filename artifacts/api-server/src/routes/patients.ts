import { Router, type Request, type RequestHandler, type Response } from "express";
import {
  adminSettingsTable,
  bookingExamsTable,
  bookingsTable,
  db,
  examsTable,
  patientsTable,
  pool,
} from "@workspace/db";
import { and, desc, eq, ilike, or, inArray, isNull, type SQL } from "drizzle-orm";
import { CreatePatientBody, UpdatePatientBody } from "@workspace/api-zod";
import { requireAnyPermission } from "../lib/auth";

const router = Router();
const MAX_BULK_ERRORS = 50;
const AGENDA_APPOINTMENTS_KEY = "agenda-appointments";
const RECORD_TYPES = ["privato", "azienda", "societa_sportiva"] as const;
type RecordType = typeof RECORD_TYPES[number];
type FormattedPatient = ReturnType<typeof formatPatient>;
type AgendaAppointmentValue = Record<string, unknown>;
type PatientHistoryVisit = {
  id: string;
  source: "ambulatorio" | "laboratorio";
  date: string;
  time: string;
  title: string;
  doctor: string | null;
  sede: string | null;
  status: string;
  amount: number | null;
  paid: boolean;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  notes: string | null;
};

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
  conventionActive: boolean;
  conventionExpiresAt: string | null;
  conventionText: string | null;
  conventionServices: string | null;
  linkedConventionIds: string | null;
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
      add column if not exists contact_person text,
      add column if not exists convention_active boolean not null default false,
      add column if not exists convention_expires_at text,
      add column if not exists convention_text text,
      add column if not exists convention_services text,
      add column if not exists linked_convention_ids text,
      add column if not exists deleted_at timestamptz
  `).then(() => undefined);
  return patientRegistryColumnsPromise;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const syncExpiredConventions = async () => {
  await pool.query(
    `
      update public.patients
      set convention_active = false
      where convention_active = true
        and convention_expires_at is not null
        and convention_expires_at <> ''
        and convention_expires_at < $1
    `,
    [todayKey()],
  );
};

const normalizeRecordType = (value: unknown): RecordType => {
  const text = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (text === "azienda" || text === "company" || text === "impresa") return "azienda";
  if (text === "societa_sportiva" || text === "società_sportiva" || text === "societa" || text === "sportiva") {
    return "societa_sportiva";
  }
  return "privato";
};

const readBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "si", "sì", "yes", "attiva", "attivo"].includes(text);
};

const normalizeLinkedConventionIds = (value: unknown) => {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0));
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0));
    }
  } catch {
    // fall back to comma-separated values
  }

  const ids = text
    .split(/[;,]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  return ids.length ? JSON.stringify(ids) : null;
};

const readAmount = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const readDiscountPercent = (value: unknown) =>
  Math.max(0, Math.min(100, readAmount(value)));

const readConventionPricingMode = (row: Record<string, unknown>) => {
  const raw = String(row["pricingMode"] ?? row["tipoPrezzo"] ?? row["modalitaPrezzo"] ?? "").trim().toLowerCase();
  const discountPercent = readDiscountPercent(row["discountPercent"] ?? row["scontoPercentuale"] ?? row["sconto"]);
  return raw.includes("discount") || raw.includes("sconto") || discountPercent > 0 ? "discount" : "fixed";
};

const normalizeConventionServices = (value: unknown) => {
  const normalizeList = (items: unknown[]) => {
    const services = items
      .map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        const prestazioneId = String(row["prestazioneId"] ?? row["id"] ?? "").trim();
        const nome = String(row["nome"] ?? row["prestazione"] ?? "").trim();
        const specialita = String(row["specialita"] ?? "").trim();
        const durata = Number(row["durata"] ?? 0);
        const pricingMode = readConventionPricingMode(row);
        const discountPercent = pricingMode === "discount"
          ? readDiscountPercent(row["discountPercent"] ?? row["scontoPercentuale"] ?? row["sconto"])
          : 0;
        const prezzo = pricingMode === "fixed"
          ? readAmount(row["prezzo"] ?? row["prezzoFinale"] ?? row["importo"])
          : 0;
        if (!prestazioneId && !nome) return null;

        return {
          id: String(row["id"] ?? "").trim() || prestazioneId || `convenzione-${index}`,
          prestazioneId,
          nome,
          specialita,
          durata: Number.isFinite(durata) ? Math.max(0, durata) : 0,
          pricingMode,
          discountPercent,
          prezzo: Number.isFinite(prezzo) ? Math.max(0, prezzo) : 0,
        };
      })
      .filter(Boolean);

    return services.length ? JSON.stringify(services) : null;
  };

  if (Array.isArray(value)) return normalizeList(value);

  const text = String(value ?? "").trim();
  if (!text) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? normalizeList(parsed) : null;
  } catch {
    return null;
  }
};

const parseConventionServices = (value: string | null) => {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        const prestazioneId = String(row["prestazioneId"] ?? row["id"] ?? "").trim();
        const nome = String(row["nome"] ?? "").trim();
        const durata = Number(row["durata"] ?? 0);
        const pricingMode = readConventionPricingMode(row);
        const discountPercent = pricingMode === "discount"
          ? readDiscountPercent(row["discountPercent"] ?? row["scontoPercentuale"] ?? row["sconto"])
          : 0;
        const prezzo = pricingMode === "fixed" ? readAmount(row["prezzo"] ?? row["prezzoFinale"]) : 0;
        if (!prestazioneId && !nome) return null;

        return {
          id: String(row["id"] ?? "").trim() || prestazioneId || `convenzione-${index}`,
          prestazioneId,
          nome,
          specialita: String(row["specialita"] ?? "").trim(),
          durata: Number.isFinite(durata) ? Math.max(0, durata) : 0,
          pricingMode,
          discountPercent,
          prezzo: Number.isFinite(prezzo) ? Math.max(0, prezzo) : 0,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const parseLinkedConventionIds = (value: string | null) => {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
      : [];
  } catch {
    return value
      .split(/[;,]/)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0);
  }
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
    conventionActive: recordType !== "privato" && readBoolean(data["conventionActive"] ?? data["convenzioneAttiva"]),
    conventionExpiresAt: toDateStr(String(data["conventionExpiresAt"] ?? data["scadenzaConvenzione"] ?? "").trim()) || null,
    conventionText: String(data["conventionText"] ?? data["testoConvenzione"] ?? "").trim() || null,
    conventionServices: normalizeConventionServices(data["conventionServices"] ?? data["prestazioniConvenzione"]),
    linkedConventionIds: normalizeLinkedConventionIds(data["linkedConventionIds"] ?? data["convenzioniAssociate"]),
    notes: String(data["notes"] ?? "").trim() || null,
    billingAddress: String(data["billingAddress"] ?? "").trim() || null,
    billingCap: String(data["billingCap"] ?? "").trim() || null,
    billingCity: String(data["billingCity"] ?? "").trim() || null,
    billingProvincia: String(data["billingProvincia"] ?? "").trim() || null,
  };
}

function formatPatient(p: typeof patientsTable.$inferSelect) {
  const expired = Boolean(p.conventionExpiresAt && p.conventionExpiresAt < todayKey());
  const conventionActive = Boolean(p.conventionActive && !expired);

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
    conventionActive,
    conventionExpiresAt: p.conventionExpiresAt,
    conventionText: p.conventionText,
    conventionServices: parseConventionServices(p.conventionServices),
    linkedConventionIds: parseLinkedConventionIds(p.linkedConventionIds),
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

const normalizeIdentityText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const normalizePhoneIdentity = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");

const readTextField = (row: AgendaAppointmentValue, keys: string[]) => {
  for (const key of keys) {
    const value = String(row[key] ?? "").trim();
    if (value) return value;
  }
  return "";
};

const readNumberField = (row: AgendaAppointmentValue, keys: string[]) => {
  for (const key of keys) {
    const value = readAmount(row[key]);
    if (value > 0) return value;
  }
  return null;
};

const loadAgendaAppointments = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, AGENDA_APPOINTMENTS_KEY))
    .limit(1);

  return Array.isArray(settings?.value) ? (settings.value as AgendaAppointmentValue[]) : [];
};

const isAgendaAppointmentForPatient = (appointment: AgendaAppointmentValue, patient: FormattedPatient) => {
  const appointmentPatientId = String(appointment["pazienteId"] ?? appointment["patientId"] ?? "").trim();
  if (appointmentPatientId && appointmentPatientId === String(patient.id)) return true;

  const patientEmail = normalizeIdentityText(patient.email);
  const appointmentEmail = normalizeIdentityText(readTextField(appointment, ["pazienteEmail", "email", "patientEmail"]));
  if (patientEmail && appointmentEmail && patientEmail === appointmentEmail) return true;

  const patientPhone = normalizePhoneIdentity(patient.phone);
  const appointmentPhone = normalizePhoneIdentity(readTextField(appointment, ["pazienteTelefono", "telefono", "phone", "patientPhone"]));
  if (patientPhone && appointmentPhone && patientPhone === appointmentPhone) return true;

  const patientName = normalizeIdentityText(`${patient.firstName} ${patient.lastName}`);
  const appointmentName =
    normalizeIdentityText(readTextField(appointment, ["paziente", "pazienteNome", "patientName"])) ||
    normalizeIdentityText(`${readTextField(appointment, ["firstName"])} ${readTextField(appointment, ["lastName"])}`);
  return Boolean(patientName && appointmentName && patientName === appointmentName);
};

const statusIsPaid = (status: string, billed: unknown) => {
  if (billed === true) return true;
  const normalized = normalizeIdentityText(status);
  return ["fatturata", "pagata", "pagato", "incassata", "incassato"].includes(normalized);
};

router.use(requireAnyPermission([
  "anagrafiche",
  "laboratorio.accettazione",
  "ambulatorio.accettazione",
  "laboratorio.agenda",
  "ambulatorio.agenda",
  "infortunistica",
]));

router.get("/patients", async (req, res) => {
  try {
    await ensurePatientRegistryColumns();
    await syncExpiredConventions();
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
        .where(hasRecordTypeFilter
          ? and(searchWhere, eq(patientsTable.recordType, recordType), isNull(patientsTable.deletedAt))
          : and(searchWhere, isNull(patientsTable.deletedAt)))
        .orderBy(patientsTable.lastName, patientsTable.firstName)
        .limit(limit)
        .offset(offset);
    } else if (hasRecordTypeFilter) {
      rows = await db
        .select()
        .from(patientsTable)
        .where(and(eq(patientsTable.recordType, recordType), isNull(patientsTable.deletedAt)))
        .orderBy(patientsTable.lastName, patientsTable.firstName)
        .limit(limit)
        .offset(offset);
    } else {
      rows = await db
        .select()
        .from(patientsTable)
        .where(isNull(patientsTable.deletedAt))
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

router.get("/patients/:id/history", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid patient ID" });
    return;
  }

  try {
    await ensurePatientRegistryColumns();
    await syncExpiredConventions();

    const [patientRow] = await db
      .select()
      .from(patientsTable)
      .where(and(eq(patientsTable.id, id), isNull(patientsTable.deletedAt)))
      .limit(1);

    if (!patientRow) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const patient = formatPatient(patientRow);
    const bookingMatches: SQL<unknown>[] = [];
    if (patient.codiceFiscale) bookingMatches.push(eq(bookingsTable.codiceFiscale, patient.codiceFiscale));
    if (patient.email) bookingMatches.push(eq(bookingsTable.email, patient.email));
    if (patient.phone) bookingMatches.push(eq(bookingsTable.phone, patient.phone));
    if (patient.firstName && patient.lastName && patient.dateOfBirth) {
      const sameIdentity = and(
        eq(bookingsTable.firstName, patient.firstName),
        eq(bookingsTable.lastName, patient.lastName),
        eq(bookingsTable.dateOfBirth, patient.dateOfBirth),
      );
      if (sameIdentity) bookingMatches.push(sameIdentity);
    }

    const labBookings = bookingMatches.length
      ? await db
          .select()
          .from(bookingsTable)
          .where(bookingMatches.length === 1 ? bookingMatches[0] : or(...bookingMatches))
          .orderBy(desc(bookingsTable.date), bookingsTable.time)
          .limit(200)
      : [];

    const bookingIds = labBookings.map((booking) => booking.id);
    const examLinks = bookingIds.length
      ? await db
          .select({
            bookingId: bookingExamsTable.bookingId,
            descrizione: examsTable.descrizione,
          })
          .from(bookingExamsTable)
          .leftJoin(examsTable, eq(bookingExamsTable.examId, examsTable.id))
          .where(inArray(bookingExamsTable.bookingId, bookingIds))
      : [];

    const examsByBooking = new Map<number, string[]>();
    for (const link of examLinks) {
      if (!examsByBooking.has(link.bookingId)) examsByBooking.set(link.bookingId, []);
      examsByBooking.get(link.bookingId)!.push(link.descrizione ?? "Esame");
    }

    const labVisits: PatientHistoryVisit[] = labBookings.map((booking) => {
      const examNames = examsByBooking.get(booking.id) ?? [];
      return {
        id: `lab-${booking.id}`,
        source: "laboratorio",
        date: toDateStr(booking.date as string | Date),
        time: booking.time,
        title: examNames.length ? examNames.join(", ") : "Accettazione laboratorio",
        doctor: null,
        sede: null,
        status: booking.status,
        amount: null,
        paid: false,
        invoiceNumber: null,
        invoiceDate: null,
        notes: booking.notes,
      };
    });

    const agendaAppointments = await loadAgendaAppointments();
    const agendaVisits: PatientHistoryVisit[] = agendaAppointments
      .filter((appointment) => isAgendaAppointmentForPatient(appointment, patient))
      .map((appointment) => {
        const status = readTextField(appointment, ["stato", "status"]) || "confermata";
        const amount = readNumberField(appointment, ["importoFatturato", "importo", "prezzo", "amount"]);
        return {
          id: String(appointment["id"] ?? `agenda-${readTextField(appointment, ["data"])}-${readTextField(appointment, ["ora"])}`),
          source: "ambulatorio",
          date: readTextField(appointment, ["data", "date"]),
          time: readTextField(appointment, ["ora", "time"]),
          title: readTextField(appointment, ["prestazione", "prestazioneNome", "serviceName"]) || "Prestazione ambulatoriale",
          doctor: readTextField(appointment, ["medicoNome", "medico", "doctorName"]) || null,
          sede: readTextField(appointment, ["sede", "site"]) || null,
          status,
          amount,
          paid: statusIsPaid(status, appointment["fatturata"] ?? appointment["pagata"]),
          invoiceNumber: readTextField(appointment, ["numeroFattura", "invoiceNumber"]) || null,
          invoiceDate: readTextField(appointment, ["dataFattura", "invoiceDate"]) || null,
          notes: readTextField(appointment, ["notaPrenotazione", "note", "notes"]) || null,
        };
      });

    const visits = [...agendaVisits, ...labVisits].sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
    );
    const payments = visits
      .filter((visit) => visit.amount !== null && visit.amount > 0)
      .map((visit) => ({
        id: visit.id,
        date: visit.invoiceDate || visit.date,
        description: visit.title,
        amount: visit.amount ?? 0,
        status: visit.paid ? "Incassato/fatturato" : "Da verificare",
        invoiceNumber: visit.invoiceNumber,
        source: visit.source,
      }));
    const paidTotal = payments
      .filter((payment) => payment.status === "Incassato/fatturato")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

    res.json({
      patient,
      visits,
      payments,
      totals: {
        visits: visits.length,
        payments: payments.length,
        totalAmount,
        paidTotal,
        openAmount: Math.max(0, totalAmount - paidTotal),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load patient history");
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
    await syncExpiredConventions();
    const d = parsed.data;
    const recordType = d.recordType ?? "privato";
    const [inserted] = await db
      .insert(patientsTable)
      .values({
        recordType,
        firstName: d.firstName,
        lastName: d.lastName,
        dateOfBirth: toDateStr(d.dateOfBirth as string | Date),
        codiceFiscale: d.codiceFiscale ?? null,
        gender: d.gender ?? null,
        companyName: d.companyName ?? null,
        vatNumber: d.vatNumber ?? null,
        contactPerson: d.contactPerson ?? null,
        conventionActive: recordType !== "privato" ? d.conventionActive ?? false : false,
        conventionExpiresAt: d.conventionExpiresAt ? toDateStr(d.conventionExpiresAt as string | Date) : null,
        conventionText: d.conventionText ?? null,
        conventionServices: recordType !== "privato" ? normalizeConventionServices(d.conventionServices) : null,
        linkedConventionIds: normalizeLinkedConventionIds(d.linkedConventionIds),
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

const updatePatientById = async (id: number, body: unknown, req: Request, res: Response) => {
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid patient ID" });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(body);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues }, "Invalid patient update data");
    res.status(400).json({ error: "Invalid patient data", details: parsed.error.issues });
    return;
  }

  try {
    await ensurePatientRegistryColumns();
    await syncExpiredConventions();
    const existing = await db
      .select()
      .from(patientsTable)
      .where(and(eq(patientsTable.id, id), isNull(patientsTable.deletedAt)))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const d = parsed.data;
    const nextRecordType = d.recordType ?? existing[0]?.recordType ?? "privato";
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
      ...(d.conventionActive !== undefined && { conventionActive: nextRecordType !== "privato" ? d.conventionActive : false }),
      ...(d.conventionExpiresAt !== undefined && {
        conventionExpiresAt: d.conventionExpiresAt ? toDateStr(d.conventionExpiresAt as string | Date) : null,
      }),
      ...(d.conventionText !== undefined && { conventionText: d.conventionText }),
      ...(d.conventionServices !== undefined && {
        conventionServices: nextRecordType !== "privato" ? normalizeConventionServices(d.conventionServices) : null,
      }),
      ...(d.linkedConventionIds !== undefined && { linkedConventionIds: normalizeLinkedConventionIds(d.linkedConventionIds) }),
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
};

router.patch("/patients/:id", async (req, res) => {
  await updatePatientById(Number(req.params["id"]), req.body, req, res);
});

router.post("/patients-update", async (req, res) => {
  const rawBody = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const { id: rawId, ...body } = rawBody;
  await updatePatientById(Number(rawId), body, req, res);
});

const deletePatientById = async (id: number, req: Request, res: Response) => {
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid patient ID" });
    return;
  }

  try {
    await ensurePatientRegistryColumns();
    await syncExpiredConventions();
    const deleted = await db
      .update(patientsTable)
      .set({ deletedAt: new Date() })
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
};

router.delete("/patients/:id", async (req, res) => {
  await deletePatientById(Number(req.params["id"]), req, res);
});

router.post("/patients-delete", async (req, res) => {
  const id = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? Number((req.body as Record<string, unknown>)["id"])
    : NaN;
  await deletePatientById(id, req, res);
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
    await syncExpiredConventions();
    const codiceFiscaleValues = uniqueNonEmpty(validRows.map((row) => row.codiceFiscale));
    const emailValues = uniqueNonEmpty(validRows.map((row) => row.email));
    const phoneValues = uniqueNonEmpty(validRows.map((row) => normalizePhoneKey(row.phone)));

    const [existingByCfRows, existingByEmailRows, existingByPhoneRows] = await Promise.all([
      codiceFiscaleValues.length
        ? db
            .select({ codiceFiscale: patientsTable.codiceFiscale })
            .from(patientsTable)
            .where(and(inArray(patientsTable.codiceFiscale, codiceFiscaleValues), isNull(patientsTable.deletedAt)))
        : Promise.resolve([]),
      emailValues.length
        ? db
            .select({ email: patientsTable.email })
            .from(patientsTable)
            .where(and(inArray(patientsTable.email, emailValues), isNull(patientsTable.deletedAt)))
        : Promise.resolve([]),
      phoneValues.length
        ? db
            .select({ phone: patientsTable.phone })
            .from(patientsTable)
            .where(and(inArray(patientsTable.phone, phoneValues), isNull(patientsTable.deletedAt)))
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
