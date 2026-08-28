import { Router, type RequestHandler } from "express";
import { db } from "@workspace/db";
import { bookingsTable, bookingExamsTable, examsTable, patientsTable, refertiTable, examComponentsTable } from "@workspace/db";
import { eq, desc, inArray, or, and, isNotNull, sql } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams } from "@workspace/api-zod";
import { requireAnyPermission } from "../lib/auth";
import {
  ensureBookingPaymentColumns,
  isPaymentStatus,
  normalizePaymentStatus,
  type PaymentStatusValue,
} from "../lib/bookingPayments";

const router = Router();
const VALID_BOOKING_STATUSES = ["confirmed", "pending", "accepted", "completed", "cancelled"] as const;
const CONTAINER_EXAM_TYPES = new Set(["composito", "pacchetto"]);
const requireBookingAccess = requireAnyPermission([
  "laboratorio.accettazione",
  "ambulatorio.accettazione",
  "laboratorio.agenda",
  "ambulatorio.agenda",
]);
const requireBookingPaymentAccess = requireAnyPermission([
  "cassa",
]);
const PUBLIC_BOOKING_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_BOOKING_MAX_PER_WINDOW = Number(process.env["PUBLIC_BOOKING_MAX_PER_WINDOW"] ?? 12);
const publicBookingHits = new Map<string, { count: number; resetAt: number }>();

type BookingStatusValue = (typeof VALID_BOOKING_STATUSES)[number];

const toDateStr = (v: string | Date | null): string =>
  !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

function isBookingStatus(value: unknown): value is BookingStatusValue {
  return typeof value === "string" && (VALID_BOOKING_STATUSES as readonly string[]).includes(value);
}

const publicBookingRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const key = req.ip ?? "unknown";
  const current = publicBookingHits.get(key);

  if (!current || current.resetAt <= now) {
    publicBookingHits.set(key, { count: 1, resetAt: now + PUBLIC_BOOKING_WINDOW_MS });
    next();
    return;
  }

  if (current.count >= PUBLIC_BOOKING_MAX_PER_WINDOW) {
    res.status(429).json({ error: "Troppe prenotazioni inviate. Riprova tra qualche minuto." });
    return;
  }

  publicBookingHits.set(key, { ...current, count: current.count + 1 });
  next();
};

const isContainerExamType = (tipo: unknown) =>
  typeof tipo === "string" && CONTAINER_EXAM_TYPES.has(tipo);

async function persistBookingStatus(id: number, status: BookingStatusValue) {
  await ensureBookingPaymentColumns();
  const existing = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, id))
    .limit(1);

  if (existing.length === 0) {
    return null;
  }

  await db.update(bookingsTable).set({ status }).where(eq(bookingsTable.id, id));

  return formatBooking(id);
}

async function persistBookingPaymentStatus(id: number, paymentStatus: PaymentStatusValue) {
  await ensureBookingPaymentColumns();
  const existing = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, id))
    .limit(1);

  if (existing.length === 0) {
    return null;
  }

  await db
    .update(bookingsTable)
    .set({
      paymentStatus,
      paidAt: paymentStatus === "paid" ? new Date() : null,
    })
    .where(eq(bookingsTable.id, id));

  return formatBooking(id);
}

async function formatBooking(bookingId: number) {
  await ensureBookingPaymentColumns();
  const booking = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);
  if (!booking[0]) return null;

  const examLinks = await db
    .select({ examId: bookingExamsTable.examId, descrizione: examsTable.descrizione, importo: examsTable.importo })
    .from(bookingExamsTable)
    .leftJoin(examsTable, eq(bookingExamsTable.examId, examsTable.id))
    .where(eq(bookingExamsTable.bookingId, bookingId));

  const b = booking[0];
  const amountDue = examLinks.reduce((sum, e) => sum + (Number(e.importo) || 0), 0);
  return {
    id: b.id,
    examIds: examLinks.map((e) => e.examId),
    examNames: examLinks.map((e) => e.descrizione ?? "Esame"),
    date: toDateStr(b.date as string | Date),
    time: b.time,
    firstName: b.firstName,
    lastName: b.lastName,
    dateOfBirth: toDateStr(b.dateOfBirth as string | Date),
    codiceFiscale: b.codiceFiscale,
    gender: b.gender,
    email: b.email,
    phone: b.phone,
    notes: b.notes,
    status: b.status,
    paymentStatus: normalizePaymentStatus(b.paymentStatus),
    paidAt: b.paidAt ? b.paidAt.toISOString() : null,
    amountDue,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/bookings", requireBookingAccess, async (req, res) => {
  try {
    await ensureBookingPaymentColumns();
    const bookings = await db
      .select()
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.date), bookingsTable.time);

    if (bookings.length === 0) {
      return res.json([]);
    }

    const bookingIds = bookings.map((b) => b.id);
    const examLinks = await db
      .select({
        bookingId: bookingExamsTable.bookingId,
        examId: bookingExamsTable.examId,
        descrizione: examsTable.descrizione,
        tipo: examsTable.tipo,
        importo: examsTable.importo,
      })
      .from(bookingExamsTable)
      .leftJoin(examsTable, eq(bookingExamsTable.examId, examsTable.id))
      .where(inArray(bookingExamsTable.bookingId, bookingIds));

    const examsByBooking = new Map<number, { examId: number; descrizione: string; tipo: string; importo: string | null }[]>();
    for (const link of examLinks) {
      if (!examsByBooking.has(link.bookingId)) examsByBooking.set(link.bookingId, []);
      examsByBooking.get(link.bookingId)!.push({
        examId: link.examId,
        descrizione: link.descrizione ?? "Esame",
        tipo: link.tipo ?? "singolo",
        importo: link.importo,
      });
    }

    const packageExamIds = examLinks.filter((e) => isContainerExamType(e.tipo)).map((e) => e.examId);
    const componentCounts = new Map<number, number>();
    if (packageExamIds.length > 0) {
      const counts = await db
        .select({ packageExamId: examComponentsTable.packageExamId, count: sql<number>`cast(count(*) as int)` })
        .from(examComponentsTable)
        .where(inArray(examComponentsTable.packageExamId, packageExamIds))
        .groupBy(examComponentsTable.packageExamId);
      for (const c of counts) componentCounts.set(c.packageExamId, c.count);
    }

    const refertiCounts = await db
      .select({ bookingId: refertiTable.bookingId, count: sql<number>`cast(count(*) as int)` })
      .from(refertiTable)
      .where(inArray(refertiTable.bookingId, bookingIds))
      .groupBy(refertiTable.bookingId);
    const refertiByBooking = new Map(refertiCounts.map((r) => [r.bookingId, r.count]));

    const result = bookings.map((b) => {
      const exams = examsByBooking.get(b.id) ?? [];
      const expectedRefertiCount = exams.reduce((sum, e) => {
        if (isContainerExamType(e.tipo)) return sum + (componentCounts.get(e.examId) ?? 1);
        return sum + 1;
      }, 0);
      return {
        id: b.id,
        examIds: exams.map((e) => e.examId),
        examNames: exams.map((e) => e.descrizione),
        date: toDateStr(b.date as string | Date),
        time: b.time,
        firstName: b.firstName,
        lastName: b.lastName,
        dateOfBirth: toDateStr(b.dateOfBirth as string | Date),
        codiceFiscale: b.codiceFiscale,
        gender: b.gender,
        email: b.email,
        phone: b.phone,
        notes: b.notes,
        status: b.status,
        paymentStatus: normalizePaymentStatus(b.paymentStatus),
        paidAt: b.paidAt ? b.paidAt.toISOString() : null,
        amountDue: exams.reduce((sum, e) => sum + (Number(e.importo) || 0), 0),
        createdAt: b.createdAt.toISOString(),
        refertiCount: refertiByBooking.get(b.id) ?? 0,
        expectedRefertiCount,
      };
    });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", publicBookingRateLimit, async (req, res) => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid booking data" });
  }

  const data = parsed.data;

  try {
    await ensureBookingPaymentColumns();
    const exams = await db
      .select()
      .from(examsTable)
      .where(inArray(examsTable.id, data.examIds));

    if (exams.length !== data.examIds.length) {
      return res.status(400).json({ error: "One or more exams not found" });
    }

    const dateStr = toDateStr(data.date as string | Date);
    const dobStr = toDateStr(data.dateOfBirth as string | Date);

    const [inserted] = await db
      .insert(bookingsTable)
      .values({
        date: dateStr,
        time: data.time,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: dobStr,
        codiceFiscale: data.codiceFiscale ?? null,
        gender: data.gender ?? null,
        email: data.email,
        phone: data.phone,
        notes: data.notes ?? null,
        status: "confirmed",
        paymentStatus: "unpaid",
      })
      .returning();

    await db.insert(bookingExamsTable).values(
      data.examIds.map((examId) => ({ bookingId: inserted.id, examId }))
    );

    // Upsert patient: usa il codice fiscale come chiave univoca (fallback: email)
    const cf = data.codiceFiscale?.trim().toUpperCase() ?? null;
    const existingCondition = cf
      ? and(isNotNull(patientsTable.codiceFiscale), eq(patientsTable.codiceFiscale, cf), sql`${patientsTable.deletedAt} is null`)
      : and(eq(patientsTable.email, data.email), sql`${patientsTable.deletedAt} is null`);

    const existing = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(existingCondition)
      .limit(1);

    if (existing.length === 0) {
      await db.insert(patientsTable).values({
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: dobStr,
        codiceFiscale: cf,
        gender: data.gender ?? null,
        email: data.email,
        phone: data.phone,
        notes: null,
      });
    }

    const result = await formatBooking(inserted.id);
    return res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", requireBookingAccess, async (req, res) => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  try {
    const result = await formatBooking(parsed.data.id);
    if (!result) {
      return res.status(404).json({ error: "Booking not found" });
    }
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bookings/:id/status", requireBookingAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  const { status } = req.body as { status?: unknown };
  if (!isBookingStatus(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await persistBookingStatus(id, status);
    if (!result) {
      return res.status(404).json({ error: "Booking not found" });
    }
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update booking status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings-status", requireBookingAccess, async (req, res) => {
  const { id: rawId, status } = req.body as { id?: unknown; status?: unknown };
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  if (!isBookingStatus(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await persistBookingStatus(id, status);
    if (!result) {
      return res.status(404).json({ error: "Booking not found" });
    }
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update booking status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bookings/:id/payment-status", requireBookingPaymentAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  const { paymentStatus } = req.body as { paymentStatus?: unknown };
  if (!isPaymentStatus(paymentStatus)) {
    return res.status(400).json({ error: "Invalid payment status" });
  }

  try {
    const result = await persistBookingPaymentStatus(id, paymentStatus);
    if (!result) {
      return res.status(404).json({ error: "Booking not found" });
    }
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update booking payment status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings-payment-status", requireBookingPaymentAccess, async (req, res) => {
  const { id: rawId, paymentStatus } = req.body as { id?: unknown; paymentStatus?: unknown };
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  if (!isPaymentStatus(paymentStatus)) {
    return res.status(400).json({ error: "Invalid payment status" });
  }

  try {
    const result = await persistBookingPaymentStatus(id, paymentStatus);
    if (!result) {
      return res.status(404).json({ error: "Booking not found" });
    }
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update booking payment status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
