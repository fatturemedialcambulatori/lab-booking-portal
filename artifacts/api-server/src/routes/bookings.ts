import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, examsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams } from "@workspace/api-zod";

const router = Router();

const toDateStr = (v: string | Date | null): string =>
  !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

router.get("/bookings", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(bookingsTable)
      .leftJoin(examsTable, eq(bookingsTable.examId, examsTable.id))
      .orderBy(desc(bookingsTable.date), bookingsTable.time);

    const bookings = rows.map(({ bookings, exams }) => ({
      id: bookings.id,
      examId: bookings.examId,
      examName: exams?.descrizione ?? "Esame",
      date: toDateStr(bookings.date as string | Date),
      time: bookings.time,
      firstName: bookings.firstName,
      lastName: bookings.lastName,
      dateOfBirth: toDateStr(bookings.dateOfBirth as string | Date),
      codiceFiscale: bookings.codiceFiscale,
      gender: bookings.gender,
      email: bookings.email,
      phone: bookings.phone,
      notes: bookings.notes,
      status: bookings.status,
      createdAt: bookings.createdAt.toISOString(),
    }));

    res.json(bookings);
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    res.status(500).json({ error: "Internal server error" });
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

    const insertRows = data.examIds.map((examId) => ({
      examId,
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
      status: "confirmed" as const,
    }));

    const inserted = await db.insert(bookingsTable).values(insertRows).returning();
    const first = inserted[0];
    const firstExam = exams.find((e) => e.id === first.examId);

    res.status(201).json({
      id: first.id,
      examId: first.examId,
      examName: firstExam?.descrizione ?? "Esame",
      date: toDateStr(first.date as string | Date),
      time: first.time,
      firstName: first.firstName,
      lastName: first.lastName,
      dateOfBirth: toDateStr(first.dateOfBirth as string | Date),
      codiceFiscale: first.codiceFiscale,
      gender: first.gender,
      email: first.email,
      phone: first.phone,
      notes: first.notes,
      status: first.status,
      createdAt: first.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  try {
    const rows = await db
      .select()
      .from(bookingsTable)
      .leftJoin(examsTable, eq(bookingsTable.examId, examsTable.id))
      .where(eq(bookingsTable.id, parsed.data.id))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const { bookings: b, exams: exam } = rows[0];
    res.json({
      id: b.id,
      examId: b.examId,
      examName: exam?.descrizione ?? "Esame",
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
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    res.status(500).json({ error: "Internal server error" });
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
    const rows = await db
      .select()
      .from(bookingsTable)
      .leftJoin(examsTable, eq(bookingsTable.examId, examsTable.id))
      .where(eq(bookingsTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    await db.update(bookingsTable).set({ status }).where(eq(bookingsTable.id, id));

    const { bookings: b, exams: exam } = rows[0];
    res.json({
      id: b.id,
      examId: b.examId,
      examName: exam?.descrizione ?? "Esame",
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
      status,
      createdAt: b.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update booking status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
