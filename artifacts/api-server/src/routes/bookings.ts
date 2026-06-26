import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, examsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams } from "@workspace/api-zod";

const router = Router();

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

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        examId: data.examId,
        date: data.date,
        time: data.time,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
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

    const b = booking[0];
    res.json({
      id: b.id,
      examId: b.examId,
      examName: exam[0]?.name ?? "Esame",
      date: b.date,
      time: b.time,
      firstName: b.firstName,
      lastName: b.lastName,
      dateOfBirth: b.dateOfBirth,
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
