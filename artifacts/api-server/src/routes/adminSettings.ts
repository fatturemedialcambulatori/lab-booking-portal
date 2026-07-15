import { Router } from "express";
import { db, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const SETTINGS_KEY = "admin-settings";

router.get("/admin-settings", async (req, res) => {
  try {
    const [settings] = await db
      .select()
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, SETTINGS_KEY))
      .limit(1);

    res.json(settings?.value ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to load admin settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin-settings", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Dati impostazioni non validi" });
    return;
  }

  try {
    const now = new Date();
    const [settings] = await db
      .insert(adminSettingsTable)
      .values({
        key: SETTINGS_KEY,
        value: req.body,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set: {
          value: req.body,
          updatedAt: now,
        },
      })
      .returning();

    res.json(settings.value);
  } catch (err) {
    req.log.error({ err }, "Failed to save admin settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
