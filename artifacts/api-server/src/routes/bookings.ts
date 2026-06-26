import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, examsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams } from "@workspace/api-zod";

const router = Router();

router.get("/bookings", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(bookingsTable)
      .leftJoin(examsTable, eq(bookingsTable.examId, examsTable.id))
      .orderBy(desc(bookingsTable.date), bookingsTable.time);

    const toDateStr = (v: string | Date | null): string =>
      !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

    const bookings = rows.map(({ bookings, exams }) => ({
      id: bookings.id,
      examId: bookings.examId,
      examName: exams?.name ?? "Esame",
      date: toDateStr(bookings.date as string | Date),
      time: bookings.time,
      firstName: bookings.firstName,
      lastName: bookings.lastName,
      dateOfBirth: toDateStr(bookings.dateOfBirth as string | Date),
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
    const exam = await db.select().from(examsTable).where(eq(examsTable.id, data.examId)).limit(1);
    if (exam.length === 0) {
      return res.status(400).json({ error: "Exam not found" });
    }

    const toDateStr = (v: string | Date): string =>
      typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        examId: data.examId,
        date: toDateStr(data.date as string | Date),
        time: data.time,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: toDateStr(data.dateOfBirth as string | Date),
        email: data.email,
        phone: data.phone,
        notes: data.notes ?? null,
        status: "confirmed",
      })
      .returning();

    res.status(201).json({
      id: booking.id,
      examId: booking.examId,
      examName: exam[0].name,
      date: booking.date,
      time: booking.time,
      firstName: booking.firstName,
      lastName: booking.lastName,
      dateOfBirth: booking.dateOfBirth,
      email: booking.email,
      phone: booking.phone,
      notes: booking.notes,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
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
    const booking = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parsed.data.id))
      .limit(1);

    if (booking.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const exam = await db
      .select()
      .from(examsTable)
      .where(eq(examsTable.id, booking[0].examId))
      .limit(1);

    const toDateStr2 = (v: string | Date | null): string =>
      !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

    const b = booking[0];
    res.json({
      id: b.id,
      examId: b.examId,
      examName: exam[0]?.name ?? "Esame",
      date: toDateStr2(b.date as string | Date),
      time: b.time,
      firstName: b.firstName,
      lastName: b.lastName,
      dateOfBirth: toDateStr2(b.dateOfBirth as string | Date),
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

export default router;
