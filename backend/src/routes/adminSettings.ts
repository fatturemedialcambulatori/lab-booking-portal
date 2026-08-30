import { Router } from "express";
import { db, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAnyPermission, requireAuth } from "../lib/auth";

const router = Router();
const SETTINGS_KEY = "admin-settings";
const AGENDA_APPOINTMENTS_KEY = "agenda-appointments";
const AGENDA_WAITLIST_KEY = "agenda-waitlist";
const AGENDA_RESOURCE_ASSIGNMENTS_KEY = "agenda-resource-assignments";
const requireSettingsWrite = requireAnyPermission(["impostazioni"]);
const requireAgendaAccess = requireAnyPermission([
  "laboratorio.accettazione",
  "ambulatorio.accettazione",
  "laboratorio.agenda",
  "ambulatorio.agenda",
]);

type AgendaAppointmentValue = Record<string, unknown>;

const isPlainObject = (value: unknown): value is AgendaAppointmentValue =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const loadAgendaAppointments = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, AGENDA_APPOINTMENTS_KEY))
    .limit(1);

  return Array.isArray(settings?.value) ? (settings.value as AgendaAppointmentValue[]) : [];
};

const loadAgendaWaitlist = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, AGENDA_WAITLIST_KEY))
    .limit(1);

  return Array.isArray(settings?.value) ? (settings.value as AgendaAppointmentValue[]) : [];
};

const loadAgendaResourceAssignments = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, AGENDA_RESOURCE_ASSIGNMENTS_KEY))
    .limit(1);

  return Array.isArray(settings?.value) ? (settings.value as AgendaAppointmentValue[]) : [];
};

const saveAgendaAppointments = async (appointments: AgendaAppointmentValue[]) => {
  const now = new Date();
  const [settings] = await db
    .insert(adminSettingsTable)
    .values({
      key: AGENDA_APPOINTMENTS_KEY,
      value: appointments,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: {
        value: appointments,
        updatedAt: now,
      },
    })
    .returning();

  return settings.value;
};

const saveAgendaWaitlist = async (items: AgendaAppointmentValue[]) => {
  const now = new Date();
  const [settings] = await db
    .insert(adminSettingsTable)
    .values({
      key: AGENDA_WAITLIST_KEY,
      value: items,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: {
        value: items,
        updatedAt: now,
      },
    })
    .returning();

  return settings.value;
};

const saveAgendaResourceAssignments = async (items: AgendaAppointmentValue[]) => {
  const now = new Date();
  const [settings] = await db
    .insert(adminSettingsTable)
    .values({
      key: AGENDA_RESOURCE_ASSIGNMENTS_KEY,
      value: items,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: {
        value: items,
        updatedAt: now,
      },
    })
    .returning();

  return settings.value;
};

router.get("/admin-settings", requireAuth, async (req, res) => {
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

router.put("/admin-settings", requireSettingsWrite, async (req, res) => {
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

router.get("/agenda-appointments", requireAgendaAccess, async (req, res) => {
  try {
    res.json(await loadAgendaAppointments());
  } catch (err) {
    req.log.error({ err }, "Failed to load agenda appointments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agenda-appointments", requireAgendaAccess, async (req, res) => {
  if (!isPlainObject(req.body) || typeof req.body.id !== "string" || req.body.id.trim() === "") {
    res.status(400).json({ error: "Appuntamento non valido" });
    return;
  }

  try {
    const appointment = req.body;
    const appointments = await loadAgendaAppointments();
    const nextAppointments = [
      ...appointments.filter((item) => item.id !== appointment.id),
      appointment,
    ];

    await saveAgendaAppointments(nextAppointments);
    res.status(201).json(appointment);
  } catch (err) {
    req.log.error({ err }, "Failed to save agenda appointment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/agenda-appointments", requireAgendaAccess, async (req, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ error: "Lista appuntamenti non valida" });
    return;
  }

  try {
    const appointments = req.body.filter(isPlainObject);
    res.json(await saveAgendaAppointments(appointments));
  } catch (err) {
    req.log.error({ err }, "Failed to replace agenda appointments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agenda-waitlist", requireAgendaAccess, async (req, res) => {
  try {
    res.json(await loadAgendaWaitlist());
  } catch (err) {
    req.log.error({ err }, "Failed to load agenda waitlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agenda-waitlist", requireAgendaAccess, async (req, res) => {
  if (!isPlainObject(req.body) || typeof req.body.id !== "string" || req.body.id.trim() === "") {
    res.status(400).json({ error: "Richiesta lista d'attesa non valida" });
    return;
  }

  try {
    const item = req.body;
    const items = await loadAgendaWaitlist();
    const nextItems = [
      ...items.filter((existing) => existing.id !== item.id),
      item,
    ];

    await saveAgendaWaitlist(nextItems);
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to save agenda waitlist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/agenda-waitlist/:id", requireAgendaAccess, async (req, res) => {
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0]?.trim() : idParam?.trim();
  if (!id) {
    res.status(400).json({ error: "ID richiesta mancante" });
    return;
  }

  try {
    const items = await loadAgendaWaitlist();
    const nextItems = items.filter((item) => item.id !== id);
    await saveAgendaWaitlist(nextItems);
    res.json({ id, deleted: items.length !== nextItems.length });
  } catch (err) {
    req.log.error({ err }, "Failed to delete agenda waitlist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agenda-resource-assignments", requireAgendaAccess, async (req, res) => {
  try {
    res.json(await loadAgendaResourceAssignments());
  } catch (err) {
    req.log.error({ err }, "Failed to load agenda resource assignments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agenda-resource-assignments", requireAgendaAccess, async (req, res) => {
  if (!isPlainObject(req.body) || typeof req.body.id !== "string" || req.body.id.trim() === "") {
    res.status(400).json({ error: "Assegnazione risorsa non valida" });
    return;
  }

  try {
    const item = req.body;
    const items = await loadAgendaResourceAssignments();
    const nextItems = [
      ...items.filter((existing) => existing.id !== item.id),
      item,
    ];

    await saveAgendaResourceAssignments(nextItems);
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to save agenda resource assignment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/agenda-resource-assignments", requireAgendaAccess, async (req, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ error: "Lista assegnazioni risorse non valida" });
    return;
  }

  try {
    const items = req.body.filter(isPlainObject);
    res.json(await saveAgendaResourceAssignments(items));
  } catch (err) {
    req.log.error({ err }, "Failed to replace agenda resource assignments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/agenda-resource-assignments/:id", requireAgendaAccess, async (req, res) => {
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0]?.trim() : idParam?.trim();
  if (!id) {
    res.status(400).json({ error: "ID assegnazione mancante" });
    return;
  }

  try {
    const items = await loadAgendaResourceAssignments();
    const nextItems = items.filter((item) => item.id !== id);
    await saveAgendaResourceAssignments(nextItems);
    res.json({ id, deleted: items.length !== nextItems.length });
  } catch (err) {
    req.log.error({ err }, "Failed to delete agenda resource assignment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
