import { Router } from "express";
import { ListSlotsQueryParams } from "@workspace/api-zod";

const router = Router();

const ALL_SLOTS = [
  "07:30", "08:00", "08:30", "09:00", "09:30", "10:00",
  "10:30", "11:00", "11:30", "12:00", "14:00", "14:30",
  "15:00", "15:30", "16:00",
];

router.get("/slots", async (req, res) => {
  const parsed = ListSlotsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing required parameter: date" });
  }

  const { date } = parsed.data;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requestedDate = new Date(date);

  if (requestedDate < today) {
    return res.json([]);
  }

  const isToday = requestedDate.toDateString() === today.toDateString();
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  const slots = ALL_SLOTS.map((time) => {
    const [h, m] = time.split(":").map(Number);
    let available = true;

    if (isToday) {
      if (h < currentHour || (h === currentHour && m <= currentMinute)) {
        available = false;
      }
    }

    const dayOfWeek = requestedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      available = false;
    }

    return { time, available };
  });

  res.json(slots);
});

export default router;
