import { Router } from "express";
import {
  adminSettingsTable,
  bookingExamsTable,
  bookingsTable,
  db,
  examsTable,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { ensureBookingPaymentColumns, isPaymentStatus, normalizePaymentStatus } from "../lib/bookingPayments";
import { hasPermission, requireAnyPermission } from "../lib/auth";

const router = Router();
const SETTINGS_KEY = "admin-settings";
const AGENDA_APPOINTMENTS_KEY = "agenda-appointments";

const requirePaymentsAccess = requireAnyPermission([
  "cassa",
  "cassa.modena",
  "cassa.sassuolo",
]);

type SedeOperativa = "modena" | "sassuolo";
type AgendaAppointmentValue = Record<string, unknown>;
type AdminSettingsValue = {
  prestazioni?: Array<{ id?: string; nome?: string }>;
  medici?: Array<{ id?: string; nome?: string; specialita?: string }>;
  listini?: Array<{ medicoId?: string; prestazioneId?: string; prezzo?: number | string }>;
};
type PaymentStatusFilter = "unpaid" | "paid" | "all";

const toDateStr = (v: string | Date | null): string =>
  !v ? "" : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

const readText = (value: unknown) => String(value ?? "").trim();

const readAmount = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSede = (value: unknown): SedeOperativa | null => {
  const normalized = readText(value).toLocaleLowerCase("it-IT");
  if (normalized === "modena" || normalized === "sassuolo") return normalized;
  return null;
};

const normalizeAgendaPaymentStatus = (appointment: AgendaAppointmentValue): "paid" | "unpaid" => {
  const raw = appointment["paymentStatus"] ?? appointment["statoPagamento"];
  if (raw === "paid" || raw === "pagato" || raw === true) return "paid";
  if (appointment["pagata"] === true || appointment["pagato"] === true) return "paid";
  return "unpaid";
};

const normalizePaymentFilter = (value: unknown): PaymentStatusFilter => {
  if (value === "paid" || value === "all") return value;
  return "unpaid";
};

const loadAdminSettings = async (): Promise<AdminSettingsValue> => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, SETTINGS_KEY))
    .limit(1);

  return settings?.value && typeof settings.value === "object" && !Array.isArray(settings.value)
    ? (settings.value as AdminSettingsValue)
    : {};
};

const loadAgendaAppointments = async () => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, AGENDA_APPOINTMENTS_KEY))
    .limit(1);

  return Array.isArray(settings?.value) ? (settings.value as AgendaAppointmentValue[]) : [];
};

const saveAgendaAppointments = async (appointments: AgendaAppointmentValue[]) => {
  const now = new Date();
  await db
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
    });
};

const allowedSedi = (req: Parameters<typeof hasPermission>[0]) => {
  if (hasPermission(req, "cassa")) return ["modena", "sassuolo"] as SedeOperativa[];
  return [
    hasPermission(req, "cassa.modena") ? "modena" : null,
    hasPermission(req, "cassa.sassuolo") ? "sassuolo" : null,
  ].filter((item): item is SedeOperativa => Boolean(item));
};

const canSeeSede = (sede: SedeOperativa | null, sedi: SedeOperativa[], canSeeAll: boolean) => {
  if (!sede) return canSeeAll;
  return sedi.includes(sede);
};

const canMutatePaymentSede = (req: Parameters<typeof hasPermission>[0], sede: SedeOperativa | null) => {
  if (hasPermission(req, "cassa")) return true;
  if (sede === "modena") return hasPermission(req, "cassa.modena");
  if (sede === "sassuolo") return hasPermission(req, "cassa.sassuolo");
  return false;
};

const matchesPaymentFilter = (status: "paid" | "unpaid", filter: PaymentStatusFilter) =>
  filter === "all" || status === filter;

router.get("/payments", requirePaymentsAccess, async (req, res) => {
  try {
    await ensureBookingPaymentColumns();

    const filter = normalizePaymentFilter(req.query["status"]);
    const settings = await loadAdminSettings();
    const agendaAppointments = await loadAgendaAppointments();
    const sedi = allowedSedi(req);
    const canSeeAllSedi = hasPermission(req, "cassa") || sedi.length === 0;

    const prestazioni = settings.prestazioni ?? [];
    const medici = settings.medici ?? [];
    const listini = settings.listini ?? [];
    const doctorById = new Map(medici.map((medico) => [medico.id, medico]));
    const prestazioneById = new Map(prestazioni.map((prestazione) => [prestazione.id, prestazione]));
    const agendaByLabBooking = new Map<number, AgendaAppointmentValue>();

    for (const appointment of agendaAppointments) {
      const labBookingId = Number(appointment["labBookingId"]);
      if (Number.isInteger(labBookingId) && labBookingId > 0) {
        agendaByLabBooking.set(labBookingId, appointment);
      }
    }

    const bookings = await db
      .select()
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.date), bookingsTable.time)
      .limit(1000);

    const bookingIds = bookings.map((booking) => booking.id);
    const examLinks = bookingIds.length
      ? await db
          .select({
            bookingId: bookingExamsTable.bookingId,
            descrizione: examsTable.descrizione,
            importo: examsTable.importo,
          })
          .from(bookingExamsTable)
          .leftJoin(examsTable, eq(bookingExamsTable.examId, examsTable.id))
          .where(inArray(bookingExamsTable.bookingId, bookingIds))
      : [];

    const examsByBooking = new Map<number, Array<{ descrizione: string; importo: string | null }>>();
    for (const link of examLinks) {
      if (!examsByBooking.has(link.bookingId)) examsByBooking.set(link.bookingId, []);
      examsByBooking.get(link.bookingId)!.push({
        descrizione: link.descrizione ?? "Esame",
        importo: link.importo,
      });
    }

    const labPayments = bookings
      .filter((booking) => booking.status === "completed")
      .map((booking) => {
        const linkedAppointment = agendaByLabBooking.get(booking.id);
        const sede = normalizeSede(linkedAppointment?.["sede"]);
        const exams = examsByBooking.get(booking.id) ?? [];
        const paymentStatus = normalizePaymentStatus(booking.paymentStatus);
        return {
          id: `laboratorio-${booking.id}`,
          source: "laboratorio" as const,
          sourceId: booking.id,
          area: "Laboratorio",
          sede,
          date: toDateStr(booking.date as string | Date),
          time: booking.time,
          patientName: `${booking.firstName} ${booking.lastName}`.trim(),
          patientEmail: booking.email,
          patientPhone: booking.phone,
          description: exams.length ? exams.map((exam) => exam.descrizione).join(", ") : "Esami laboratorio",
          doctorName: readText(linkedAppointment?.["medicoNome"]) || readText(doctorById.get(readText(linkedAppointment?.["medicoId"]))?.nome) || null,
          amount: exams.reduce((sum, exam) => sum + readAmount(exam.importo), 0),
          clinicalStatus: booking.status,
          paymentStatus,
          paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
        };
      })
      .filter((payment) => matchesPaymentFilter(payment.paymentStatus, filter))
      .filter((payment) => canSeeSede(payment.sede, sedi, canSeeAllSedi));

    const agendaPayments = agendaAppointments
      .filter((appointment) => readText(appointment["stato"]) === "completata")
      .map((appointment) => {
        const id = readText(appointment["id"]);
        const medicoId = readText(appointment["medicoId"]);
        const prestazioneId = readText(appointment["prestazioneId"]);
        const medico = doctorById.get(medicoId);
        const prestazione = prestazioneById.get(prestazioneId);
        const listino = listini.find(
          (item) => item.medicoId === medicoId && item.prestazioneId === prestazioneId,
        );
        const amount =
          readAmount(appointment["importoFatturato"]) ||
          readAmount(appointment["importo"]) ||
          readAmount(appointment["prezzo"]) ||
          readAmount(listino?.prezzo);
        const sede = normalizeSede(appointment["sede"]);
        const paymentStatus = normalizeAgendaPaymentStatus(appointment);
        return {
          id: `agenda-${id}`,
          source: "agenda" as const,
          sourceId: id,
          area: readText(appointment["area"]) === "laboratorio" ? "Laboratorio" : "Ambulatorio",
          sede,
          date: readText(appointment["data"]),
          time: readText(appointment["ora"]),
          patientName: readText(appointment["paziente"]) || "Paziente",
          patientEmail: readText(appointment["pazienteEmail"]),
          patientPhone: readText(appointment["pazienteTelefono"]),
          description:
            readText(appointment["prestazione"]) ||
            readText(prestazione?.nome) ||
            "Prestazione ambulatoriale",
          doctorName: readText(medico?.nome) || readText(appointment["medicoNome"]) || null,
          amount,
          clinicalStatus: readText(appointment["stato"]),
          paymentStatus,
          paidAt: readText(appointment["paidAt"]) || null,
        };
      })
      .filter((payment) => payment.sourceId)
      .filter((payment) => matchesPaymentFilter(payment.paymentStatus, filter))
      .filter((payment) => canSeeSede(payment.sede, sedi, canSeeAllSedi));

    const payments = [...agendaPayments, ...labPayments].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
    );

    res.json({
      items: payments,
      totals: {
        count: payments.length,
        amount: payments.reduce((sum, payment) => sum + payment.amount, 0),
        unpaid: payments.filter((payment) => payment.paymentStatus === "unpaid").length,
        paid: payments.filter((payment) => payment.paymentStatus === "paid").length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list payments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments-status", requirePaymentsAccess, async (req, res) => {
  const { source, id, paymentStatus } = req.body as {
    source?: unknown;
    id?: unknown;
    paymentStatus?: unknown;
  };

  if (source !== "laboratorio" && source !== "agenda") {
    res.status(400).json({ error: "Origine pagamento non valida" });
    return;
  }
  if (!isPaymentStatus(paymentStatus)) {
    res.status(400).json({ error: "Stato pagamento non valido" });
    return;
  }

  try {
    await ensureBookingPaymentColumns();

    if (source === "laboratorio") {
      const bookingId = Number(id);
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        res.status(400).json({ error: "ID prenotazione non valido" });
        return;
      }

      const appointments = await loadAgendaAppointments();
      const linkedAppointment = appointments.find((appointment) => Number(appointment["labBookingId"]) === bookingId);
      if (!canMutatePaymentSede(req, normalizeSede(linkedAppointment?.["sede"]))) {
        res.status(403).json({ error: "Permesso insufficiente per questa sede" });
        return;
      }

      const [updated] = await db
        .update(bookingsTable)
        .set({
          paymentStatus,
          paidAt: paymentStatus === "paid" ? new Date() : null,
        })
        .where(eq(bookingsTable.id, bookingId))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Prenotazione non trovata" });
        return;
      }

      res.json({ ok: true });
      return;
    }

    const appointmentId = readText(id);
    if (!appointmentId) {
      res.status(400).json({ error: "ID appuntamento non valido" });
      return;
    }

    const appointments = await loadAgendaAppointments();
    let found = false;
    let forbidden = false;
    const paidAt = paymentStatus === "paid" ? new Date().toISOString() : null;
    const nextAppointments = appointments.map((appointment) => {
      if (readText(appointment["id"]) !== appointmentId) return appointment;
      found = true;
      if (!canMutatePaymentSede(req, normalizeSede(appointment["sede"]))) {
        forbidden = true;
        return appointment;
      }
      return {
        ...appointment,
        paymentStatus,
        statoPagamento: paymentStatus,
        pagata: paymentStatus === "paid",
        paidAt,
      };
    });

    if (!found) {
      res.status(404).json({ error: "Appuntamento non trovato" });
      return;
    }
    if (forbidden) {
      res.status(403).json({ error: "Permesso insufficiente per questa sede" });
      return;
    }

    await saveAgendaAppointments(nextAppointments);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update payment status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
