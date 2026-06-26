import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, bookingExamsTable, examsTable, patientsTable, refertiTable } from "@workspace/db";
import { eq, desc, inArray, or, and, isNotNull, sql } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams } from "@workspace/api-zod";

const router = Router();

const toDateStr = (v: string | Date | null): string =>
  !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

async function formatBooking(bookingId: number) {
  const booking = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);
  if (!booking[0]) return null;

  const examLinks = await db
    .select({ examId: bookingExamsTable.examId, descrizione: examsTable.descrizione })
    .from(bookingExamsTable)
    .leftJoin(examsTable, eq(bookingExamsTable.examId, examsTable.id))
    .where(eq(bookingExamsTable.bookingId, bookingId));

  const b = booking[0];
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
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/bookings", async (req, res) => {
  try {
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
      })
      .from(bookingExamsTable)
      .leftJoin(examsTable, eq(bookingExamsTable.examId, examsTable.id))
      .where(inArray(bookingExamsTable.bookingId, bookingIds));

    const examsByBooking = new Map<number, { examId: number; descrizione: string }[]>();
    for (const link of examLinks) {
      if (!examsByBooking.has(link.bookingId)) examsByBooking.set(link.bookingId, []);
      examsByBooking.get(link.bookingId)!.push({ examId: link.examId, descrizione: link.descrizione ?? "Esame" });
    }

    const refertiCounts = await db
      .select({ bookingId: refertiTable.bookingId, count: sql<number>`cast(count(*) as int)` })
      .from(refertiTable)
      .where(inArray(refertiTable.bookingId, bookingIds))
      .groupBy(refertiTable.bookingId);
    const refertiByBooking = new Map(refertiCounts.map((r) => [r.bookingId, r.count]));

    const result = bookings.map((b) => {
      const exams = examsByBooking.get(b.id) ?? [];
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
        createdAt: b.createdAt.toISOString(),
        refertiCount: refertiByBooking.get(b.id) ?? 0,
      };
    });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", async (req, res) => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid booking data" });
  }

  const data = parsed.data;

  try {
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
      })
      .returning();

    await db.insert(bookingExamsTable).values(
      data.examIds.map((examId) => ({ bookingId: inserted.id, examId }))
    );

    // Upsert patient: usa il codice fiscale come chiave univoca (fallback: email)
    const cf = data.codiceFiscale?.trim().toUpperCase() ?? null;
    const existingCondition = cf
      ? and(isNotNull(patientsTable.codiceFiscale), eq(patientsTable.codiceFiscale, cf))
      : eq(patientsTable.email, data.email);

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

router.get("/bookings/:id", async (req, res) => {
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

router.patch("/bookings/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  const VALID_STATUSES = ["confirmed", "pending", "accepted", "completed", "cancelled"];
  const { status } = req.body as { status?: string };
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const existing = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    await db.update(bookingsTable).set({ status }).where(eq(bookingsTable.id, id));

    const result = await formatBooking(id);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update booking status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
