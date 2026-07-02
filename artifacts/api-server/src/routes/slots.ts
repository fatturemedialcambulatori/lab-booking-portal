import { Router } from "express";

const router = Router();

const ALL_SLOTS = [
  "07:30", "08:00", "08:30", "09:00", "09:30", "10:00",
  "10:30", "11:00", "11:30", "12:00", "14:00", "14:30",
  "15:00", "15:30", "16:00",
];

router.get("/slots", (req, res) => {
  const dateParam = req.query.date as string | undefined;

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return res.status(400).json({ error: "Missing required parameter: date (YYYY-MM-DD)" });
  }

  const [year, month, day] = dateParam.split("-").map(Number);
  const requestedDate = new Date(year, month - 1, day);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (requestedDate < today) {
    return res.json([]);
  }

  const isToday = requestedDate.getTime() === today.getTime();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const dayOfWeek = requestedDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const slots = ALL_SLOTS.map((time) => {
    const [h, m] = time.split(":").map(Number);
    let available = true;

    if (isWeekend) {
      available = false;
    } else if (isToday) {
      if (h < currentHour || (h === currentHour && m <= currentMinute)) {
        available = false;
      }
    }

    return { time, available };
  });

  return res.json(slots);
});

export default router;
