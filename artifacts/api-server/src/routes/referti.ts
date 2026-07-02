import { Router } from "express";
import { db } from "@workspace/db";
import { refertiTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const router = Router();

router.get("/referti", async (req, res) => {
  const bookingId = Number(req.query.bookingId);
  if (!bookingId || isNaN(bookingId)) {
    return res.status(400).json({ error: "bookingId is required" });
  }
  try {
    const rows = await db
      .select()
      .from(refertiTable)
      .where(eq(refertiTable.bookingId, bookingId));
    return res.json(
      rows.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        examId: r.examId,
        parentExamId: r.parentExamId ?? null,
        valore: r.valore,
        note: r.note,
        refertataAt: r.refertataAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list referti");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/referti", async (req, res) => {
  const { bookingId, examId, parentExamId, valore, note } = req.body as {
    bookingId: number;
    examId: number;
    parentExamId?: number | null;
    valore: string;
    note?: string | null;
  };

  if (!bookingId || !examId || !valore?.trim()) {
    return res.status(400).json({ error: "bookingId, examId and valore are required" });
  }

  try {
    const conditions = parentExamId
      ? and(eq(refertiTable.bookingId, bookingId), eq(refertiTable.examId, examId), eq(refertiTable.parentExamId, parentExamId))
      : and(eq(refertiTable.bookingId, bookingId), eq(refertiTable.examId, examId), isNull(refertiTable.parentExamId));

    const existing = await db
      .select()
      .from(refertiTable)
      .where(conditions)
      .limit(1);

    if (existing[0]) {
      const updated = await db
        .update(refertiTable)
        .set({ valore: valore.trim(), note: note ?? null, refertataAt: new Date() })
        .where(eq(refertiTable.id, existing[0].id))
        .returning();
      const r = updated[0];
      return res.json({ id: r.id, bookingId: r.bookingId, examId: r.examId, parentExamId: r.parentExamId ?? null, valore: r.valore, note: r.note, refertataAt: r.refertataAt.toISOString() });
    } else {
      const inserted = await db
        .insert(refertiTable)
        .values({ bookingId, examId, parentExamId: parentExamId ?? null, valore: valore.trim(), note: note ?? null })
        .returning();
      const r = inserted[0];
      return res.json({ id: r.id, bookingId: r.bookingId, examId: r.examId, parentExamId: r.parentExamId ?? null, valore: r.valore, note: r.note, refertataAt: r.refertataAt.toISOString() });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to upsert referto");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
