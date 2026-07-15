import React from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type AreaId = "laboratorio" | "ambulatorio";
type CalendarView = "giorno" | "settimana" | "mese";
type SedeId = "tutte" | "modena" | "sassuolo";
type StatoPrenotazione = "confermata" | "accettata" | "completata" | "annullata";

type MedicoAgenda = {
  id: string;
  nome: string;
  specialita: string;
  area: AreaId;
  sedi: Exclude<SedeId, "tutte">[];
  colore: string;
};

type PrenotazioneAgenda = {
  id: string;
  area: AreaId;
  sede: Exclude<SedeId, "tutte">;
  medicoId: string;
  paziente: string;
  prestazione: string;
  data: string;
  ora: string;
  durata: number;
  stato: StatoPrenotazione;
};

const DEMO_TODAY = new Date("2026-07-10T12:00:00");
const ORA_INIZIO = 8;
const ORA_FINE = 20;
const SLOT_HEIGHT = 64;

const SEDI: Array<{ id: SedeId; label: string }> = [
  { id: "tutte", label: "Tutte le sedi" },
  { id: "modena", label: "Modena" },
  { id: "sassuolo", label: "Sassuolo" },
];

const VIEWS: Array<{ id: CalendarView; label: string }> = [
  { id: "giorno", label: "Giorno" },
  { id: "settimana", label: "Settimana" },
  { id: "mese", label: "Mese" },
];

const MEDICI_AGENDA: MedicoAgenda[] = [
  {
    id: "rossi",
    nome: "Dott. Marco Rossi",
    specialita: "Cardiologia",
    area: "ambulatorio",
    sedi: ["modena", "sassuolo"],
    colore: "bg-sky-600",
  },
  {
    id: "neri",
    nome: "Dott.ssa Anna Neri",
    specialita: "Ortopedia",
    area: "ambulatorio",
    sedi: ["modena"],
    colore: "bg-emerald-600",
  },
  {
    id: "verdi",
    nome: "Dott. Paolo Verdi",
    specialita: "Dermatologia",
    area: "ambulatorio",
    sedi: ["sassuolo"],
    colore: "bg-violet-600",
  },
  {
    id: "bianchi",
    nome: "Dott.ssa Laura Bianchi",
    specialita: "Diagnostica",
    area: "ambulatorio",
    sedi: ["modena", "sassuolo"],
    colore: "bg-cyan-700",
  },
  {
    id: "moretti",
    nome: "Dott.ssa Elisa Moretti",
    specialita: "Laboratorio analisi",
    area: "laboratorio",
    sedi: ["modena"],
    colore: "bg-teal-700",
  },
  {
    id: "fontana",
    nome: "Dott. Enrico Fontana",
    specialita: "Ematologia",
    area: "laboratorio",
    sedi: ["modena", "sassuolo"],
    colore: "bg-indigo-600",
  },
  {
    id: "rinaldi",
    nome: "Dott.ssa Sara Rinaldi",
    specialita: "Prelievi",
    area: "laboratorio",
    sedi: ["sassuolo"],
    colore: "bg-rose-600",
  },
];

const PRENOTAZIONI_AGENDA: PrenotazioneAgenda[] = [
  {
    id: "amb-001",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "rossi",
    paziente: "Giulia Conti",
    prestazione: "Visita cardiologica",
    data: "2026-07-06",
    ora: "09:00",
    durata: 30,
    stato: "completata",
  },
  {
    id: "amb-002",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "neri",
    paziente: "Luca Ferri",
    prestazione: "Visita ortopedica",
    data: "2026-07-06",
    ora: "10:15",
    durata: 45,
    stato: "accettata",
  },
  {
    id: "amb-003",
    area: "ambulatorio",
    sede: "sassuolo",
    medicoId: "verdi",
    paziente: "Elena Russo",
    prestazione: "Controllo dermatologico",
    data: "2026-07-07",
    ora: "11:00",
    durata: 30,
    stato: "confermata",
  },
  {
    id: "amb-004",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "bianchi",
    paziente: "Andrea Riva",
    prestazione: "Ecografia addome",
    data: "2026-07-08",
    ora: "08:45",
    durata: 40,
    stato: "completata",
  },
  {
    id: "amb-005",
    area: "ambulatorio",
    sede: "sassuolo",
    medicoId: "rossi",
    paziente: "Marta Gallo",
    prestazione: "ECG",
    data: "2026-07-10",
    ora: "09:30",
    durata: 30,
    stato: "confermata",
  },
  {
    id: "amb-006",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "neri",
    paziente: "Paolo Greco",
    prestazione: "Infiltrazione articolare",
    data: "2026-07-10",
    ora: "11:15",
    durata: 30,
    stato: "accettata",
  },
  {
    id: "amb-007",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "bianchi",
    paziente: "Roberto Villa",
    prestazione: "Ecografia tiroide",
    data: "2026-07-10",
    ora: "15:00",
    durata: 40,
    stato: "confermata",
  },
  {
    id: "amb-008",
    area: "ambulatorio",
    sede: "sassuolo",
    medicoId: "verdi",
    paziente: "Chiara Neri",
    prestazione: "Mappatura nei",
    data: "2026-07-11",
    ora: "10:00",
    durata: 45,
    stato: "confermata",
  },
  {
    id: "amb-009",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "rossi",
    paziente: "Nadia Costa",
    prestazione: "Holter pressorio",
    data: "2026-07-14",
    ora: "12:00",
    durata: 30,
    stato: "confermata",
  },
  {
    id: "lab-001",
    area: "laboratorio",
    sede: "modena",
    medicoId: "moretti",
    paziente: "Sara Testa",
    prestazione: "Prelievo ematico",
    data: "2026-07-06",
    ora: "08:15",
    durata: 15,
    stato: "completata",
  },
  {
    id: "lab-002",
    area: "laboratorio",
    sede: "modena",
    medicoId: "fontana",
    paziente: "Marco Longo",
    prestazione: "Emocromo completo",
    data: "2026-07-07",
    ora: "09:20",
    durata: 20,
    stato: "completata",
  },
  {
    id: "lab-003",
    area: "laboratorio",
    sede: "sassuolo",
    medicoId: "rinaldi",
    paziente: "Anna Serra",
    prestazione: "Curva glicemica",
    data: "2026-07-08",
    ora: "08:30",
    durata: 120,
    stato: "accettata",
  },
  {
    id: "lab-004",
    area: "laboratorio",
    sede: "modena",
    medicoId: "moretti",
    paziente: "Francesco Gori",
    prestazione: "Check-up metabolico",
    data: "2026-07-10",
    ora: "08:45",
    durata: 20,
    stato: "confermata",
  },
  {
    id: "lab-005",
    area: "laboratorio",
    sede: "sassuolo",
    medicoId: "fontana",
    paziente: "Viola Martinelli",
    prestazione: "Coagulazione",
    data: "2026-07-10",
    ora: "10:30",
    durata: 20,
    stato: "accettata",
  },
  {
    id: "lab-006",
    area: "laboratorio",
    sede: "sassuolo",
    medicoId: "rinaldi",
    paziente: "Davide Ricci",
    prestazione: "Prelievo urine 24h",
    data: "2026-07-11",
    ora: "09:00",
    durata: 15,
    stato: "confermata",
  },
  {
    id: "lab-007",
    area: "laboratorio",
    sede: "modena",
    medicoId: "fontana",
    paziente: "Irene Barbieri",
    prestazione: "Profilo tiroideo",
    data: "2026-07-15",
    ora: "11:40",
    durata: 20,
    stato: "confermata",
  },
];

const oreAgenda = Array.from({ length: ORA_FINE - ORA_INIZIO }, (_, index) => ORA_INIZIO + index);

const dateKey = (date: Date) => format(date, "yyyy-MM-dd");

const normalizza = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const escapeCsv = (value: string | number) => {
  const text = String(value ?? "");
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const escapeHtml = (value: string | number) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const scaricaBlob = (content: BlobPart, fileName: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const minutiDaOra = (ora: string) => {
  const [ore, minuti] = ora.split(":").map(Number);
  return ore * 60 + minuti;
};

const aggiungiMinutiOra = (ora: string, durata: number) => {
  const totale = minutiDaOra(ora) + durata;
  return `${String(Math.floor(totale / 60)).padStart(2, "0")}:${String(totale % 60).padStart(2, "0")}`;
};

const slugFile = (value: string) =>
  normalizza(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lista";

const periodoVista = (view: CalendarView, date: Date) => {
  if (view === "giorno") return [date];
  if (view === "settimana") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const giorni: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    giorni.push(cursor);
  }
  return giorni;
};

const rangeLabel = (view: CalendarView, date: Date) => {
  if (view === "giorno") return format(date, "EEEE d MMMM yyyy", { locale: it });
  if (view === "settimana") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, "d MMM", { locale: it })} - ${format(end, "d MMM yyyy", { locale: it })}`;
  }
  return format(date, "MMMM yyyy", { locale: it });
};

const statoLabel = (stato: StatoPrenotazione) => {
  if (stato === "completata") return "Completata";
  if (stato === "accettata") return "Accettata";
  if (stato === "annullata") return "Annullata";
  return "Confermata";
};

export function AdminBookingCalendar({ area }: { area: AreaId }) {
  const [view, setView] = React.useState<CalendarView>("settimana");
  const [currentDate, setCurrentDate] = React.useState(DEMO_TODAY);
  const [sede, setSede] = React.useState<SedeId>("tutte");
  const [medicoId, setMedicoId] = React.useState("tutti");
  const [search, setSearch] = React.useState("");
  const [soloMediciConPrenotazioni, setSoloMediciConPrenotazioni] = React.useState(false);
  const [workListDate, setWorkListDate] = React.useState<string | null>(null);
  const [workListDoctorId, setWorkListDoctorId] = React.useState("tutti");

  const visibleDates = React.useMemo(() => periodoVista(view, currentDate), [currentDate, view]);
  const visibleDateKeys = React.useMemo(() => new Set(visibleDates.map(dateKey)), [visibleDates]);

  const mediciArea = React.useMemo(
    () =>
      MEDICI_AGENDA.filter((medico) => {
        const sedeCompatibile = sede === "tutte" || medico.sedi.includes(sede);
        const query = normalizza(search);
        const matchSearch =
          !query ||
          [medico.nome, medico.specialita].some((campo) => normalizza(campo).includes(query));
        return medico.area === area && sedeCompatibile && matchSearch;
      }),
    [area, search, sede],
  );

  const prenotazioniFiltrate = React.useMemo(() => {
    const mediciValidi = new Set(mediciArea.map((medico) => medico.id));
    return PRENOTAZIONI_AGENDA.filter((prenotazione) => {
      const medico = MEDICI_AGENDA.find((item) => item.id === prenotazione.medicoId);
      const query = normalizza(search);
      const matchSearch =
        !query ||
        [medico?.nome ?? "", medico?.specialita ?? "", prenotazione.paziente, prenotazione.prestazione].some(
          (campo) => normalizza(campo).includes(query),
        );

      return (
        prenotazione.area === area &&
        visibleDateKeys.has(prenotazione.data) &&
        (sede === "tutte" || prenotazione.sede === sede) &&
        (medicoId === "tutti" || prenotazione.medicoId === medicoId) &&
        mediciValidi.has(prenotazione.medicoId) &&
        matchSearch
      );
    }).sort((a, b) => `${a.data}${a.ora}`.localeCompare(`${b.data}${b.ora}`));
  }, [area, medicoId, mediciArea, search, sede, visibleDateKeys]);

  const mediciConPrenotazioni = React.useMemo(
    () => new Set(prenotazioniFiltrate.map((prenotazione) => prenotazione.medicoId)),
    [prenotazioniFiltrate],
  );

  const mediciVisibili = React.useMemo(
    () =>
      mediciArea.filter((medico) => {
        const matchMedico = medicoId === "tutti" || medico.id === medicoId;
        const matchAttivita = !soloMediciConPrenotazioni || mediciConPrenotazioni.has(medico.id);
        return matchMedico && matchAttivita;
      }),
    [mediciArea, medicoId, mediciConPrenotazioni, soloMediciConPrenotazioni],
  );

  const goPrevious = () =>
    setCurrentDate((date) => (view === "mese" ? addMonths(date, -1) : addDays(date, view === "giorno" ? -1 : -7)));
  const goNext = () =>
    setCurrentDate((date) => (view === "mese" ? addMonths(date, 1) : addDays(date, view === "giorno" ? 1 : 7)));

  const areaLabel = area === "ambulatorio" ? "Ambulatorio" : "Laboratorio";
  const prenotazioniCompletate = prenotazioniFiltrate.filter((prenotazione) => prenotazione.stato === "completata").length;

  const mediciListaLavoro = React.useMemo(() => {
    if (!workListDate) return [];
    const mediciConLavoro = new Set(
      PRENOTAZIONI_AGENDA.filter(
        (prenotazione) =>
          prenotazione.area === area &&
          prenotazione.data === workListDate &&
          prenotazione.stato !== "annullata" &&
          (sede === "tutte" || prenotazione.sede === sede),
      ).map((prenotazione) => prenotazione.medicoId),
    );
    return mediciArea.filter((medico) => mediciConLavoro.has(medico.id));
  }, [area, mediciArea, sede, workListDate]);

  const prenotazioniListaLavoro = React.useMemo(() => {
    if (!workListDate) return [];
    const mediciValidi = new Set(mediciListaLavoro.map((medico) => medico.id));
    return PRENOTAZIONI_AGENDA.filter(
      (prenotazione) =>
        prenotazione.area === area &&
        prenotazione.data === workListDate &&
        prenotazione.stato !== "annullata" &&
        (sede === "tutte" || prenotazione.sede === sede) &&
        (workListDoctorId === "tutti" || prenotazione.medicoId === workListDoctorId) &&
        mediciValidi.has(prenotazione.medicoId),
    ).sort((a, b) => `${a.medicoId}${a.ora}`.localeCompare(`${b.medicoId}${b.ora}`));
  }, [area, mediciListaLavoro, sede, workListDate, workListDoctorId]);

  const apriListaLavoro = (date: Date) => {
    const day = dateKey(date);
    const selectedDoctorHasWork =
      medicoId !== "tutti" &&
      PRENOTAZIONI_AGENDA.some(
        (prenotazione) =>
          prenotazione.area === area &&
          prenotazione.data === day &&
          prenotazione.medicoId === medicoId &&
          prenotazione.stato !== "annullata" &&
          (sede === "tutte" || prenotazione.sede === sede),
      );

    setWorkListDate(day);
    setWorkListDoctorId(selectedDoctorHasWork ? medicoId : "tutti");
  };

  const chiudiListaLavoro = () => setWorkListDate(null);

  const nomeFileListaLavoro = (extension: string) => {
    const doctor = MEDICI_AGENDA.find((medico) => medico.id === workListDoctorId);
    const doctorLabel = doctor ? doctor.nome : "tutti-medici";
    return `m-medical-lista-lavoro-${workListDate ?? "giorno"}-${slugFile(areaLabel)}-${slugFile(
      SEDI.find((item) => item.id === sede)?.label ?? "sede",
    )}-${slugFile(doctorLabel)}.${extension}`;
  };

  const esportaListaLavoroCsv = () => {
    if (prenotazioniListaLavoro.length === 0) {
      toast({
        title: "Attenzione",
        description: "Nessun appuntamento da scaricare per il giorno selezionato.",
        variant: "destructive",
      });
      return;
    }

    const mediciMap = new Map(MEDICI_AGENDA.map((medico) => [medico.id, medico]));
    const columns = ["Ora", "Paziente", "Medico", "Specializzazione", "Prestazione", "Sede", "Durata", "Stato"];
    const rows = prenotazioniListaLavoro.map((prenotazione) => {
      const medico = mediciMap.get(prenotazione.medicoId);
      return [
        prenotazione.ora,
        prenotazione.paziente,
        medico?.nome ?? "",
        medico?.specialita ?? "",
        prenotazione.prestazione,
        prenotazione.sede === "modena" ? "Modena" : "Sassuolo",
        `${prenotazione.durata} min`,
        statoLabel(prenotazione.stato),
      ];
    });
    const csv = [`\ufeff${columns.map(escapeCsv).join(";")}`, ...rows.map((row) => row.map(escapeCsv).join(";"))].join("\r\n");
    scaricaBlob(csv, nomeFileListaLavoro("csv"), "text/csv;charset=utf-8;");
    toast({ title: "Notifica", description: "Lista lavoro CSV scaricata." });
  };

  const esportaListaLavoroPdf = () => {
    if (prenotazioniListaLavoro.length === 0) {
      toast({
        title: "Attenzione",
        description: "Nessun appuntamento da scaricare per il giorno selezionato.",
        variant: "destructive",
      });
      return;
    }

    const mediciMap = new Map(MEDICI_AGENDA.map((medico) => [medico.id, medico]));
    const grouped = new Map<string, PrenotazioneAgenda[]>();
    prenotazioniListaLavoro.forEach((prenotazione) => {
      grouped.set(prenotazione.medicoId, [...(grouped.get(prenotazione.medicoId) ?? []), prenotazione]);
    });
    const dayLabel = workListDate ? format(new Date(`${workListDate}T12:00:00`), "EEEE d MMMM yyyy", { locale: it }) : "";
    const sedeLabel = SEDI.find((item) => item.id === sede)?.label ?? "Sede";
    const sections = Array.from(grouped.entries())
      .map(([doctorId, appointments]) => {
        const doctor = mediciMap.get(doctorId);
        const rows = appointments
          .sort((a, b) => a.ora.localeCompare(b.ora))
          .map(
            (appointment) => `
              <tr>
                <td>${escapeHtml(appointment.ora)}</td>
                <td>${escapeHtml(appointment.paziente)}</td>
                <td>${escapeHtml(appointment.prestazione)}</td>
                <td>${escapeHtml(appointment.sede === "modena" ? "Modena" : "Sassuolo")}</td>
                <td>${escapeHtml(`${appointment.durata} min`)}</td>
                <td>${escapeHtml(statoLabel(appointment.stato))}</td>
              </tr>
            `,
          )
          .join("");

        return `
          <section>
            <h2>${escapeHtml(doctor?.nome ?? "Medico")}</h2>
            <div class="specialita">${escapeHtml(doctor?.specialita ?? "")}</div>
            <table>
              <thead>
                <tr>
                  <th>Ora</th>
                  <th>Paziente</th>
                  <th>Prestazione</th>
                  <th>Sede</th>
                  <th>Durata</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    const windowRef = window.open("", "_blank");
    if (!windowRef) {
      toast({
        title: "Attenzione",
        description: "PDF non aperto. Controlla che il browser non blocchi le finestre popup.",
        variant: "destructive",
      });
      return;
    }

    windowRef.document.write(`
      <!doctype html>
      <html lang="it">
        <head>
          <meta charset="utf-8" />
          <title>Lista lavoro ${escapeHtml(dayLabel)}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { color: #17242b; font-family: Arial, sans-serif; margin: 0; }
            h1 { font-size: 22px; margin: 0 0 6px; }
            h2 { border-top: 1px solid #d7e2e7; font-size: 16px; margin: 20px 0 2px; padding-top: 12px; }
            .meta, .specialita { color: #5b6f7a; font-size: 12px; }
            .meta { margin-bottom: 14px; }
            table { border-collapse: collapse; font-size: 11px; margin-top: 10px; width: 100%; }
            th, td { border: 1px solid #d7e2e7; padding: 7px; text-align: left; vertical-align: top; }
            th { background: #eef5f7; color: #40535c; font-size: 10px; text-transform: uppercase; }
            tr:nth-child(even) td { background: #f8fbfc; }
          </style>
        </head>
        <body>
          <h1>Lista lavoro</h1>
          <div class="meta">${escapeHtml(dayLabel)} · ${escapeHtml(areaLabel)} · ${escapeHtml(sedeLabel)}</div>
          ${sections}
          <script>window.addEventListener("load", () => window.print());</script>
        </body>
      </html>
    `);
    windowRef.document.close();
    windowRef.focus();
    toast({ title: "Notifica", description: "Lista lavoro PDF preparata." });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Agenda {areaLabel.toLowerCase()} con vista giornaliera, settimanale e mensile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={goPrevious} aria-label="Periodo precedente">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCurrentDate(DEMO_TODAY)}>
            Oggi
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goNext} aria-label="Periodo successivo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex rounded-md border border-border bg-white p-1">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`h-8 rounded px-3 text-sm font-medium transition-colors ${
                  view === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="rounded-md border border-border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[220px_260px_minmax(260px,1fr)_220px]">
          <Field label="Agenda sede">
            <Select value={sede} onValueChange={(value: SedeId) => setSede(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEDI.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Medico">
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti i medici</SelectItem>
                {mediciArea.map((medico) => (
                  <SelectItem key={medico.id} value={medico.id}>
                    {medico.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ricerca medico o specializzazione">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Es. Rossi, Cardiologia, Prelievi"
                className="pl-9"
              />
            </div>
          </Field>
          <div className="flex items-end">
            <label className="flex min-h-10 w-full items-center gap-3 rounded-md border border-border bg-white px-3 text-sm">
              <Checkbox
                checked={soloMediciConPrenotazioni}
                onCheckedChange={(checked) => setSoloMediciConPrenotazioni(Boolean(checked))}
              />
              <span className="leading-tight">Solo medici del periodo</span>
            </label>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<CalendarDays className="h-4 w-4" />} label="Periodo" value={rangeLabel(view, currentDate)} />
        <Metric icon={<MapPin className="h-4 w-4" />} label="Sede" value={SEDI.find((item) => item.id === sede)?.label ?? "Sede"} />
        <Metric icon={<Users className="h-4 w-4" />} label="Medici visibili" value={String(mediciVisibili.length)} />
        <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Appuntamenti" value={`${prenotazioniFiltrate.length} (${prenotazioniCompletate} completati)`} />
      </div>

      <section className="overflow-hidden rounded-md border border-border bg-white">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold capitalize text-foreground">{rangeLabel(view, currentDate)}</h2>
            <p className="text-sm text-muted-foreground">
              Vista {view} · {areaLabel} · {SEDI.find((item) => item.id === sede)?.label}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mediciVisibili.map((medico) => (
              <Badge key={medico.id} variant="secondary" className="gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${medico.colore}`} />
                {medico.nome}
              </Badge>
            ))}
          </div>
        </div>

        {view === "giorno" && (
          <DayCalendar
            date={currentDate}
            doctors={mediciVisibili}
            appointments={prenotazioniFiltrate}
            onDayClick={apriListaLavoro}
          />
        )}
        {view === "settimana" && (
          <WeekCalendar
            dates={visibleDates}
            doctors={mediciVisibili}
            appointments={prenotazioniFiltrate}
            onDayClick={apriListaLavoro}
          />
        )}
        {view === "mese" && (
          <MonthCalendar
            dates={visibleDates}
            currentDate={currentDate}
            doctors={mediciVisibili}
            appointments={prenotazioniFiltrate}
            onDayClick={apriListaLavoro}
          />
        )}
      </section>

      <Dialog open={Boolean(workListDate)} onOpenChange={(open) => !open && chiudiListaLavoro()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lista lavoro</DialogTitle>
            <DialogDescription>
              Scarica la lista del giorno per un medico specifico o per tutti i medici visibili.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_260px]">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Giorno selezionato</p>
                <p className="mt-1 text-base font-semibold capitalize text-foreground">
                  {workListDate ? format(new Date(`${workListDate}T12:00:00`), "EEEE d MMMM yyyy", { locale: it }) : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {areaLabel} · {SEDI.find((item) => item.id === sede)?.label}
                </p>
              </div>
              <Field label="Medico">
                <Select value={workListDoctorId} onValueChange={setWorkListDoctorId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti i medici</SelectItem>
                    {mediciListaLavoro.map((medico) => (
                      <SelectItem key={medico.id} value={medico.id}>
                        {medico.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Anteprima lista</h3>
                <Badge variant="secondary">{prenotazioniListaLavoro.length} appuntamenti</Badge>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {prenotazioniListaLavoro.length > 0 ? (
                  <div className="divide-y divide-border">
                    {prenotazioniListaLavoro.map((prenotazione) => {
                      const medico = MEDICI_AGENDA.find((item) => item.id === prenotazione.medicoId);
                      return (
                        <div key={prenotazione.id} className="grid gap-3 px-4 py-3 md:grid-cols-[90px_minmax(0,1fr)_220px]">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{prenotazione.ora}</p>
                            <p className="text-xs text-muted-foreground">
                              {aggiungiMinutiOra(prenotazione.ora, prenotazione.durata)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{prenotazione.paziente}</p>
                            <p className="truncate text-xs text-muted-foreground">{prenotazione.prestazione}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{medico?.nome}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {medico?.specialita} · {prenotazione.sede === "modena" ? "Modena" : "Sassuolo"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nessun appuntamento da scaricare per questa selezione.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={chiudiListaLavoro}>
              Chiudi
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={esportaListaLavoroCsv}
              disabled={prenotazioniListaLavoro.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              type="button"
              onClick={esportaListaLavoroPdf}
              disabled={prenotazioniListaLavoro.length === 0}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayCalendar({
  date,
  doctors,
  appointments,
  onDayClick,
}: {
  date: Date;
  doctors: MedicoAgenda[];
  appointments: PrenotazioneAgenda[];
  onDayClick: (date: Date) => void;
}) {
  const appointmentsByDoctor = new Map<string, PrenotazioneAgenda[]>();
  appointments.forEach((appointment) => {
    if (appointment.data !== dateKey(date)) return;
    appointmentsByDoctor.set(appointment.medicoId, [...(appointmentsByDoctor.get(appointment.medicoId) ?? []), appointment]);
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="flex justify-end border-b border-border bg-white px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onDayClick(date)} className="gap-2">
            <FileText className="h-4 w-4" />
            Lista lavoro giorno
          </Button>
        </div>
        <div
          className="grid border-b border-border bg-muted/30"
          style={{ gridTemplateColumns: `72px repeat(${Math.max(doctors.length, 1)}, minmax(180px, 1fr))` }}
        >
          <div className="border-r border-border px-3 py-3 text-xs font-medium uppercase text-muted-foreground">Ora</div>
          {doctors.map((doctor) => (
            <div key={doctor.id} className="border-r border-border px-3 py-3 last:border-r-0">
              <p className="text-sm font-semibold text-foreground">{doctor.nome}</p>
              <p className="text-xs text-muted-foreground">{doctor.specialita}</p>
            </div>
          ))}
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `72px repeat(${Math.max(doctors.length, 1)}, minmax(180px, 1fr))`,
            minHeight: `${oreAgenda.length * SLOT_HEIGHT}px`,
          }}
        >
          <div className="border-r border-border">
            {oreAgenda.map((ora) => (
              <div key={ora} className="h-16 border-b border-border px-3 pt-1 text-xs text-muted-foreground">
                {String(ora).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {doctors.length > 0 ? (
            doctors.map((doctor) => (
              <div key={doctor.id} className="relative border-r border-border last:border-r-0">
                {oreAgenda.map((ora) => (
                  <div key={ora} className="h-16 border-b border-border" />
                ))}
                {(appointmentsByDoctor.get(doctor.id) ?? []).map((appointment) => (
                  <PositionedAppointment
                    key={appointment.id}
                    appointment={appointment}
                    doctor={doctor}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="col-span-full flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
              Nessun medico da mostrare con i filtri selezionati.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WeekCalendar({
  dates,
  doctors,
  appointments,
  onDayClick,
}: {
  dates: Date[];
  doctors: MedicoAgenda[];
  appointments: PrenotazioneAgenda[];
  onDayClick: (date: Date) => void;
}) {
  const doctorsMap = new Map(doctors.map((doctor) => [doctor.id, doctor]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1100px]">
        <div className="grid grid-cols-[72px_repeat(7,minmax(140px,1fr))] border-b border-border bg-muted/30">
          <div className="border-r border-border px-3 py-3 text-xs font-medium uppercase text-muted-foreground">Ora</div>
          {dates.map((date) => (
            <button
              key={dateKey(date)}
              type="button"
              onClick={() => onDayClick(date)}
              className={`border-r border-border px-3 py-3 text-center last:border-r-0 ${
                isSameDay(date, DEMO_TODAY) ? "bg-primary/10 text-primary" : ""
              } hover:bg-muted/60`}
            >
              <p className="text-xs font-medium uppercase">{format(date, "EEE", { locale: it })}</p>
              <p className="text-lg font-semibold">{format(date, "d", { locale: it })}</p>
            </button>
          ))}
        </div>
        <div
          className="grid grid-cols-[72px_repeat(7,minmax(140px,1fr))]"
          style={{ minHeight: `${oreAgenda.length * SLOT_HEIGHT}px` }}
        >
          <div className="border-r border-border">
            {oreAgenda.map((ora) => (
              <div key={ora} className="h-16 border-b border-border px-3 pt-1 text-xs text-muted-foreground">
                {String(ora).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {dates.map((date) => {
            const dayKey = dateKey(date);
            const dayAppointments = appointments.filter((appointment) => appointment.data === dayKey);
            return (
              <div key={dayKey} className="relative border-r border-border last:border-r-0">
                {oreAgenda.map((ora) => (
                  <div key={ora} className="h-16 border-b border-border" />
                ))}
                {dayAppointments.map((appointment) => {
                  const doctor = doctorsMap.get(appointment.medicoId);
                  if (!doctor) return null;
                  return <PositionedAppointment key={appointment.id} appointment={appointment} doctor={doctor} compact />;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthCalendar({
  dates,
  currentDate,
  doctors,
  appointments,
  onDayClick,
}: {
  dates: Date[];
  currentDate: Date;
  doctors: MedicoAgenda[];
  appointments: PrenotazioneAgenda[];
  onDayClick: (date: Date) => void;
}) {
  const doctorsMap = new Map(doctors.map((doctor) => [doctor.id, doctor]));

  return (
    <div className="grid grid-cols-7 border-t border-border">
      {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
        <div key={day} className="border-b border-r border-border bg-muted/30 px-3 py-2 text-xs font-medium uppercase text-muted-foreground last:border-r-0">
          {day}
        </div>
      ))}
      {dates.map((date) => {
        const dayKey = dateKey(date);
        const dayAppointments = appointments.filter((appointment) => appointment.data === dayKey);
        return (
          <button
            key={dayKey}
            type="button"
            onClick={() => onDayClick(date)}
            className={`min-h-[148px] border-b border-r border-border p-2 text-left last:border-r-0 ${
              isSameMonth(date, currentDate) ? "bg-white" : "bg-muted/20 text-muted-foreground"
            } hover:bg-muted/50`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isSameDay(date, DEMO_TODAY) ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {format(date, "d")}
              </span>
              {dayAppointments.length > 0 && (
                <span className="text-xs text-muted-foreground">{dayAppointments.length}</span>
              )}
            </div>
            <div className="space-y-1">
              {dayAppointments.slice(0, 4).map((appointment) => {
                const doctor = doctorsMap.get(appointment.medicoId);
                if (!doctor) return null;
                return (
                  <div
                    key={appointment.id}
                    className="truncate rounded border border-border bg-white px-2 py-1 text-xs shadow-sm"
                    title={`${appointment.ora} ${appointment.paziente} - ${doctor.nome}`}
                  >
                    <span className={`mr-1 inline-block h-2 w-2 rounded-full ${doctor.colore}`} />
                    <span className="font-medium">{appointment.ora}</span> {appointment.paziente}
                  </div>
                );
              })}
              {dayAppointments.length > 4 && (
                <div className="px-2 text-xs text-muted-foreground">+{dayAppointments.length - 4} altre</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PositionedAppointment({
  appointment,
  doctor,
  compact,
}: {
  appointment: PrenotazioneAgenda;
  doctor: MedicoAgenda;
  compact?: boolean;
}) {
  const start = minutiDaOra(appointment.ora);
  const top = ((start - ORA_INIZIO * 60) / 60) * SLOT_HEIGHT;
  const height = Math.max(34, (appointment.durata / 60) * SLOT_HEIGHT - 4);

  return (
    <div
      className={`absolute left-1 right-1 overflow-hidden rounded-md border border-white/80 p-2 text-white shadow-sm ${doctor.colore}`}
      style={{ top, height }}
    >
      <div className="flex items-center gap-1 text-[11px] font-semibold leading-none">
        <Clock className="h-3 w-3" />
        {appointment.ora} - {aggiungiMinutiOra(appointment.ora, appointment.durata)}
      </div>
      <p className="mt-1 truncate text-xs font-semibold">{appointment.paziente}</p>
      <p className="truncate text-[11px] opacity-90">{appointment.prestazione}</p>
      {!compact && (
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-90">
          <span className="truncate">{doctor.specialita}</span>
          <span>{appointment.sede === "modena" ? "MO" : "SASS"}</span>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
