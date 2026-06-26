import { Router } from "express";
import { db } from "@workspace/db";
import { examsTable } from "@workspace/db";

const router = Router();

router.get("/exams", async (req, res) => {
  try {
    const exams = await db.select().from(examsTable);
    res.json(exams);
  } catch (err) {
    req.log.error({ err }, "Failed to list exams");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
