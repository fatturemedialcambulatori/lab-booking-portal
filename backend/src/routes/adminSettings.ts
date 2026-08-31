import { Router, type Request, type Response } from "express";
import { db, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  canAccessSedeForPermission,
  requireAnyPermission,
  requireAuth,
  type SedeScopedPermissionBase,
} from "../lib/auth";

const router = Router();
const SETTINGS_KEY = "admin-settings";
const AGENDA_APPOINTMENTS_KEY = "agenda-appointments";
const AGENDA_WAITLIST_KEY = "agenda-waitlist";
const AGENDA_RESOURCE_ASSIGNMENTS_KEY = "agenda-resource-assignments";
const requireSettingsWrite = requireAnyPermission(["impostazioni"]);
const requireAmbulatorioPrestazioniAccess = requireAnyPermission([
  "ambulatorio.prestazioni",
  "ambulatorio.prestazioni.write",
  "impostazioni",
]);
const requireAgendaAccess = requireAnyPermission([
  "laboratorio.accettazione",
  "ambulatorio.accettazione",
  "laboratorio.agenda",
  "ambulatorio.agenda",
]);

type AgendaAppointmentValue = Record<string, unknown>;

const isPlainObject = (value: unknown): value is AgendaAppointmentValue =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readText = (value: unknown) => String(value ?? "").trim();

const readNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readBoolean = (value: unknown, fallback = true) =>
  typeof value === "boolean" ? value : fallback;

const readAgendaId = (item: AgendaAppointmentValue) => readText(item.id);

const readAgendaSede = (item: AgendaAppointmentValue) =>
  readText(item.sede) || readText(item.sedeId);

const agendaPermissionForItem = (item: AgendaAppointmentValue): SedeScopedPermissionBase =>
  readText(item.area) === "laboratorio" ? "laboratorio.agenda" : "ambulatorio.agenda";

const canAccessAgendaItem = (
  req: Request,
  item: AgendaAppointmentValue,
) => canAccessSedeForPermission(req, agendaPermissionForItem(item), readAgendaSede(item));

const rejectForbiddenAgendaItems = (
  req: Request,
  res: Response,
  items: AgendaAppointmentValue[],
) => {
  if (items.every((item) => canAccessAgendaItem(req, item))) return false;
  res.status(403).json({ error: "Permesso insufficiente per una o piu sedi" });
  return true;
};

const mergeAllowedAgendaItems = (
  req: Request,
  currentItems: AgendaAppointmentValue[],
  incomingItems: AgendaAppointmentValue[],
) => [
  ...currentItems.filter((item) => !canAccessAgendaItem(req, item)),
  ...incomingItems,
];

const replaceAllowedAgendaItem = (
  req: Request,
  currentItems: AgendaAppointmentValue[],
  incomingItem: AgendaAppointmentValue,
) => {
  const incomingId = readAgendaId(incomingItem);
  const existing = currentItems.find((item) => readAgendaId(item) === incomingId);
  if (existing && !canAccessAgendaItem(req, existing)) return null;

  return [
    ...currentItems.filter((item) => readAgendaId(item) !== incomingId),
    incomingItem,
  ];
};

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

const loadAdminSettingsValue = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, SETTINGS_KEY))
    .limit(1);

  return settings?.value ?? null;
};

router.get("/admin-settings", requireAuth, async (req, res) => {
  try {
    res.json(await loadAdminSettingsValue());
  } catch (err) {
    req.log.error({ err }, "Failed to load admin settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ambulatorio/prestazioni", requireAmbulatorioPrestazioniAccess, async (req, res) => {
  try {
    const settings = await loadAdminSettingsValue();
    const data = isPlainObject(settings) ? settings : {};

    const specialita = (Array.isArray(data.specialita) ? data.specialita : [])
      .filter(isPlainObject)
      .map((item, index) => ({
        id: readText(item.id) || `specialita-${index + 1}`,
        nome: readText(item.nome),
        attiva: readBoolean(item.attiva, true),
      }))
      .filter((item) => item.nome);

    const prestazioni = (Array.isArray(data.prestazioni) ? data.prestazioni : [])
      .filter(isPlainObject)
      .map((item, index) => ({
        id: readText(item.id) || `prestazione-${index + 1}`,
        nome: readText(item.nome),
        specialita: readText(item.specialita) || "Generale",
        durata: Math.max(5, readNumber(item.durata, 30)),
        attiva: readBoolean(item.attiva, true),
      }))
      .filter((item) => item.nome);

    const medici = (Array.isArray(data.medici) ? data.medici : [])
      .filter(isPlainObject)
      .map((item, index) => ({
        id: readText(item.id) || `medico-${index + 1}`,
        nome: readText(item.nome),
        specialita: readText(item.specialita) || "Generale",
        agendaAperta: readBoolean(item.agendaAperta, true),
      }))
      .filter((item) => item.nome);

    const prestazioneIds = new Set(prestazioni.map((item) => item.id));
    const medicoIds = new Set(medici.map((item) => item.id));
    const listini = (Array.isArray(data.listini) ? data.listini : [])
      .filter(isPlainObject)
      .map((item, index) => ({
        id: readText(item.id) || `listino-${index + 1}`,
        prestazioneId: readText(item.prestazioneId),
        medicoId: readText(item.medicoId),
        durata: Math.max(5, readNumber(item.durata, 30)),
        prezzo: Math.max(0, readNumber(item.prezzo, 0)),
      }))
      .filter((item) => prestazioneIds.has(item.prestazioneId) && medicoIds.has(item.medicoId));

    res.json({ specialita, prestazioni, medici, listini });
  } catch (err) {
    req.log.error({ err }, "Failed to load ambulatorio prestazioni");
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
    res.json((await loadAgendaAppointments()).filter((item) => canAccessAgendaItem(req, item)));
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
    if (!canAccessAgendaItem(req, appointment)) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }
    const appointments = await loadAgendaAppointments();
    const nextAppointments = replaceAllowedAgendaItem(req, appointments, appointment);
    if (!nextAppointments) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }

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
    if (rejectForbiddenAgendaItems(req, res, appointments)) return;
    const nextAppointments = mergeAllowedAgendaItems(req, await loadAgendaAppointments(), appointments);
    const saved = await saveAgendaAppointments(nextAppointments) as AgendaAppointmentValue[];
    res.json(saved.filter((item) => canAccessAgendaItem(req, item)));
  } catch (err) {
    req.log.error({ err }, "Failed to replace agenda appointments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agenda-waitlist", requireAgendaAccess, async (req, res) => {
  try {
    res.json((await loadAgendaWaitlist()).filter((item) => canAccessAgendaItem(req, item)));
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
    if (!canAccessAgendaItem(req, item)) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }
    const items = await loadAgendaWaitlist();
    const nextItems = replaceAllowedAgendaItem(req, items, item);
    if (!nextItems) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }

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
    const existing = items.find((item) => readAgendaId(item) === id);
    if (existing && !canAccessAgendaItem(req, existing)) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }
    const nextItems = items.filter((item) => readAgendaId(item) !== id);
    await saveAgendaWaitlist(nextItems);
    res.json({ id, deleted: items.length !== nextItems.length });
  } catch (err) {
    req.log.error({ err }, "Failed to delete agenda waitlist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agenda-resource-assignments", requireAgendaAccess, async (req, res) => {
  try {
    res.json((await loadAgendaResourceAssignments()).filter((item) => canAccessAgendaItem(req, item)));
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
    if (!canAccessAgendaItem(req, item)) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }
    const items = await loadAgendaResourceAssignments();
    const nextItems = replaceAllowedAgendaItem(req, items, item);
    if (!nextItems) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }

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
    if (rejectForbiddenAgendaItems(req, res, items)) return;
    const nextItems = mergeAllowedAgendaItems(req, await loadAgendaResourceAssignments(), items);
    const saved = await saveAgendaResourceAssignments(nextItems) as AgendaAppointmentValue[];
    res.json(saved.filter((item) => canAccessAgendaItem(req, item)));
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
    const existing = items.find((item) => readAgendaId(item) === id);
    if (existing && !canAccessAgendaItem(req, existing)) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }
    const nextItems = items.filter((item) => readAgendaId(item) !== id);
    await saveAgendaResourceAssignments(nextItems);
    res.json({ id, deleted: items.length !== nextItems.length });
  } catch (err) {
    req.log.error({ err }, "Failed to delete agenda resource assignment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
