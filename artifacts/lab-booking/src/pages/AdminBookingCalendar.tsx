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
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileText,
  MoreVertical,
  Printer,
  Search,
  Settings,
  UserRound,
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

const DEMO_TODAY = new Date("2026-07-24T12:00:00");
const ORA_INIZIO = 7;
const ORA_FINE = 19;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 40;
const CURRENT_TIME = "13:40";

const SEDI: Array<{ id: SedeId; label: string }> = [
  { id: "tutte", label: "Tutte le sedi" },
  { id: "modena", label: "Modena" },
  { id: "sassuolo", label: "Sassuolo" },
];

const VIEWS: Array<{ id: CalendarView; label: string }> = [
  { id: "giorno", label: "Giorno" },
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
    id: "gennari",
    nome: "Dott.ssa Loretta Gennari",
    specialita: "Fisiatria",
    area: "ambulatorio",
    sedi: ["modena"],
    colore: "bg-lime-600",
  },
  {
    id: "leoni",
    nome: "Dott. Luigi Leoni",
    specialita: "Ecografia",
    area: "ambulatorio",
    sedi: ["modena", "sassuolo"],
    colore: "bg-green-700",
  },
  {
    id: "rosa",
    nome: "Dott. Sandro Rosa",
    specialita: "Medicina dello sport",
    area: "ambulatorio",
    sedi: ["sassuolo"],
    colore: "bg-red-600",
  },
  {
    id: "barbieri",
    nome: "Dott.ssa Paola Barbieri",
    specialita: "Medicina dello sport",
    area: "ambulatorio",
    sedi: ["modena"],
    colore: "bg-amber-600",
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
  {
    id: "moc",
    nome: "Medical MOC",
    specialita: "Tecnico sanitario",
    area: "laboratorio",
    sedi: ["modena", "sassuolo"],
    colore: "bg-green-700",
  },
  {
    id: "costa",
    nome: "Laboratorio Costa",
    specialita: "Analista clinico",
    area: "laboratorio",
    sedi: ["modena"],
    colore: "bg-emerald-700",
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
  {
    id: "amb-024-001",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "rossi",
    paziente: "Nicola Burrascano",
    prestazione: "Visita cardiologica",
    data: "2026-07-24",
    ora: "08:30",
    durata: 30,
    stato: "confermata",
  },
  {
    id: "amb-024-002",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "rossi",
    paziente: "Andrea Curci",
    prestazione: "ECG",
    data: "2026-07-24",
    ora: "09:00",
    durata: 20,
    stato: "accettata",
  },
  {
    id: "amb-024-003",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "rossi",
    paziente: "Lorenza Bertolani",
    prestazione: "Controllo cardiologico",
    data: "2026-07-24",
    ora: "09:40",
    durata: 70,
    stato: "confermata",
  },
  {
    id: "amb-024-004",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "bianchi",
    paziente: "Hamza Agnaou",
    prestazione: "Ecografia addome",
    data: "2026-07-24",
    ora: "09:20",
    durata: 20,
    stato: "accettata",
  },
  {
    id: "amb-024-005",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "bianchi",
    paziente: "Alberto Barbolini",
    prestazione: "Ecografia tiroide",
    data: "2026-07-24",
    ora: "09:40",
    durata: 20,
    stato: "completata",
  },
  {
    id: "amb-024-006",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "gennari",
    paziente: "Giulia Silvestri",
    prestazione: "Valutazione fisiatrica",
    data: "2026-07-24",
    ora: "08:00",
    durata: 20,
    stato: "confermata",
  },
  {
    id: "amb-024-007",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "leoni",
    paziente: "Anna Maria Panico",
    prestazione: "Ecografia muscolare",
    data: "2026-07-24",
    ora: "09:20",
    durata: 20,
    stato: "confermata",
  },
  {
    id: "amb-024-008",
    area: "ambulatorio",
    sede: "sassuolo",
    medicoId: "rosa",
    paziente: "Andrea Aldrovandi",
    prestazione: "Certificato sportivo",
    data: "2026-07-24",
    ora: "09:00",
    durata: 25,
    stato: "accettata",
  },
  {
    id: "amb-024-009",
    area: "ambulatorio",
    sede: "sassuolo",
    medicoId: "rosa",
    paziente: "Gianluca Spina",
    prestazione: "Medicina sportiva",
    data: "2026-07-24",
    ora: "09:25",
    durata: 25,
    stato: "confermata",
  },
  {
    id: "amb-024-010",
    area: "ambulatorio",
    sede: "modena",
    medicoId: "barbieri",
    paziente: "Fabiano Righi",
    prestazione: "Test sotto sforzo",
    data: "2026-07-24",
    ora: "10:35",
    durata: 30,
    stato: "confermata",
  },
  {
    id: "lab-024-001",
    area: "laboratorio",
    sede: "modena",
    medicoId: "moretti",
    paziente: "Francesca Bergonzini",
    prestazione: "Prelievo ematico",
    data: "2026-07-24",
    ora: "08:00",
    durata: 15,
    stato: "accettata",
  },
  {
    id: "lab-024-002",
    area: "laboratorio",
    sede: "modena",
    medicoId: "fontana",
    paziente: "Paolo Galli",
    prestazione: "Emocromo completo",
    data: "2026-07-24",
    ora: "09:40",
    durata: 20,
    stato: "completata",
  },
  {
    id: "lab-024-003",
    area: "laboratorio",
    sede: "sassuolo",
    medicoId: "rinaldi",
    paziente: "Margherita Barbieri",
    prestazione: "Curva glicemica",
    data: "2026-07-24",
    ora: "10:00",
    durata: 60,
    stato: "confermata",
  },
  {
    id: "lab-024-004",
    area: "laboratorio",
    sede: "modena",
    medicoId: "moc",
    paziente: "Pietro Cirelli",
    prestazione: "MOC femorale",
    data: "2026-07-24",
    ora: "11:00",
    durata: 25,
    stato: "confermata",
  },
  {
    id: "lab-024-005",
    area: "laboratorio",
    sede: "modena",
    medicoId: "costa",
    paziente: "Andrea Braglia",
    prestazione: "Profilo metabolico",
    data: "2026-07-24",
    ora: "10:30",
    durata: 20,
    stato: "accettata",
  },
];

const agendaSlots = Array.from(
  { length: ((ORA_FINE - ORA_INIZIO) * 60) / SLOT_MINUTES },
  (_, index) => ORA_INIZIO * 60 + index * SLOT_MINUTES,
);

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

const formattaOraMinuti = (totale: number) =>
  `${String(Math.floor(totale / 60)).padStart(2, "0")}:${String(totale % 60).padStart(2, "0")}`;

const aggiungiMinutiOra = (ora: string, durata: number) => {
  const totale = minutiDaOra(ora) + durata;
  return formattaOraMinuti(totale);
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

const statoLabel = (stato: StatoPrenotazione) => {
  if (stato === "completata") return "Completata";
  if (stato === "accettata") return "Accettata";
  if (stato === "annullata") return "Annullata";
  return "Confermata";
};

export function AdminBookingCalendar({ area }: { area: AreaId }) {
  const [view, setView] = React.useState<CalendarView>("giorno");
  const [currentDate, setCurrentDate] = React.useState(DEMO_TODAY);
  const [sede, setSede] = React.useState<SedeId>("tutte");
  const [specialitaFiltro, setSpecialitaFiltro] = React.useState("tutte");
  const [medicoId, setMedicoId] = React.useState("tutti");
  const [search, setSearch] = React.useState("");
  const [agendaSearch, setAgendaSearch] = React.useState("");
  const [soloMediciConPrenotazioni, setSoloMediciConPrenotazioni] = React.useState(false);
  const [workListDate, setWorkListDate] = React.useState<string | null>(null);
  const [workListDoctorId, setWorkListDoctorId] = React.useState("tutti");

  const visibleDates = React.useMemo(() => periodoVista(view, currentDate), [currentDate, view]);
  const visibleDateKeys = React.useMemo(() => new Set(visibleDates.map(dateKey)), [visibleDates]);

  const mediciArea = React.useMemo(
    () =>
      MEDICI_AGENDA.filter((medico) => {
        const sedeCompatibile = sede === "tutte" || medico.sedi.includes(sede);
        const query = normalizza(agendaSearch);
        const matchAgenda =
          !query ||
          [medico.nome, medico.specialita].some((campo) => normalizza(campo).includes(query));
        const matchSpecialita = specialitaFiltro === "tutte" || medico.specialita === specialitaFiltro;
        return medico.area === area && sedeCompatibile && matchAgenda && matchSpecialita;
      }),
    [agendaSearch, area, sede, specialitaFiltro],
  );

  const specialitaDisponibili = React.useMemo(() => {
    const nomi = MEDICI_AGENDA.filter((medico) => {
      const sedeCompatibile = sede === "tutte" || medico.sedi.includes(sede);
      return medico.area === area && sedeCompatibile;
    }).map((medico) => medico.specialita);

    return Array.from(new Set(nomi)).sort((a, b) => a.localeCompare(b, "it"));
  }, [area, sede]);

  React.useEffect(() => {
    if (specialitaFiltro === "tutte" || specialitaDisponibili.includes(specialitaFiltro)) return;
    setSpecialitaFiltro("tutte");
  }, [specialitaDisponibili, specialitaFiltro]);

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

  const miniCalendarDates = periodoVista("mese", currentDate);
  const selectedDateKey = dateKey(currentDate);
  const sedeLabel = SEDI.find((item) => item.id === sede)?.label ?? "Tutte le sedi";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
      <div className="grid min-h-[760px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-[#f7faf8] lg:border-b-0 lg:border-r">
          <div className="space-y-5 p-4">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate((date) => addMonths(date, -1))}
                aria-label="Mese precedente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-semibold capitalize text-foreground">
                {format(currentDate, "MMMM yyyy", { locale: it })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate((date) => addMonths(date, 1))}
                aria-label="Mese successivo"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
                <div key={day} className="py-1 text-[11px] font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {miniCalendarDates.map((date) => {
                const dayKey = dateKey(date);
                const selected = dayKey === selectedDateKey;
                const today = isSameDay(date, DEMO_TODAY);
                const hasWork = PRENOTAZIONI_AGENDA.some(
                  (prenotazione) =>
                    prenotazione.area === area &&
                    prenotazione.data === dayKey &&
                    (sede === "tutte" || prenotazione.sede === sede),
                );

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => setCurrentDate(date)}
                    className={`relative flex h-8 items-center justify-center rounded-md text-sm transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : isSameMonth(date, currentDate)
                          ? "text-foreground hover:bg-white"
                          : "text-muted-foreground/55 hover:bg-white"
                    } ${today && !selected ? "ring-1 ring-primary/30" : ""}`}
                  >
                    {format(date, "d")}
                    {hasWork && (
                      <span
                        className={`absolute bottom-1 h-1 w-1 rounded-full ${
                          selected ? "bg-primary-foreground" : "bg-primary"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <button
                type="button"
                className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-primary hover:bg-white"
              >
                <ClipboardList className="h-4 w-4" />
                Lista d'attesa
              </button>
              <button
                type="button"
                className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-primary hover:bg-white"
              >
                <CalendarDays className="h-4 w-4" />
                Imposta blocchi e ferie
              </button>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <Field label="Indirizzi">
                <Select value={sede} onValueChange={(value: SedeId) => setSede(value)}>
                  <SelectTrigger className="bg-white">
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

              <Field label="Specializzazione">
                <Select value={specialitaFiltro} onValueChange={setSpecialitaFiltro}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutte">Tutte le specializzazioni</SelectItem>
                    {specialitaDisponibili.map((specialita) => (
                      <SelectItem key={specialita} value={specialita}>
                        {specialita}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Agende</p>
                <Badge variant="secondary">{mediciVisibili.length}</Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={agendaSearch}
                  onChange={(event) => setAgendaSearch(event.target.value)}
                  placeholder="Cerca per agenda"
                  className="bg-white pl-9"
                />
              </div>
              <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                <span className="text-sm font-medium text-foreground">Lavorano oggi</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soloMediciConPrenotazioni}
                  onClick={() => setSoloMediciConPrenotazioni((current) => !current)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    soloMediciConPrenotazioni ? "bg-primary" : "bg-muted-foreground/35"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      soloMediciConPrenotazioni ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="max-h-[250px] space-y-1 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setMedicoId("tutti")}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
                    medicoId === "tutti" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-white"
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  Tutti i medici
                </button>
                {mediciArea.map((medico) => (
                  <button
                    key={medico.id}
                    type="button"
                    onClick={() => setMedicoId(medico.id)}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
                      medicoId === medico.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-white"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${medico.colore}`} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{medico.nome}</span>
                      <span className="block truncate text-xs opacity-75">{medico.specialita}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="flex flex-col gap-3 border-b border-border bg-white px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCurrentDate(DEMO_TODAY)}>
                Oggi
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={goPrevious} aria-label="Giorno precedente">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={goNext} aria-label="Giorno successivo">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="min-w-[190px] px-2">
                <p className="text-base font-semibold text-foreground">
                  {format(currentDate, "EEE, d MMM yyyy", { locale: it })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {areaLabel} · {sedeLabel} · {prenotazioniFiltrate.length} appuntamenti
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <div className="relative min-w-[260px] flex-1 xl:max-w-[430px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cerca il paziente per nome, numero di telefono..."
                  className="pl-9"
                />
              </div>
              <Button type="button" variant="outline" size="icon" aria-label="Cerca">
                <Search className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => apriListaLavoro(currentDate)} aria-label="Stampa lista lavoro">
                <Printer className="h-4 w-4" />
              </Button>
              <Select value={view} onValueChange={(value: CalendarView) => setView(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEWS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" aria-label="Impostazioni agenda">
                <Settings className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Altre azioni">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <DayCalendar
              date={currentDate}
              doctors={mediciVisibili}
              appointments={prenotazioniFiltrate}
            />
          </div>
        </section>
      </div>

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
}: {
  date: Date;
  doctors: MedicoAgenda[];
  appointments: PrenotazioneAgenda[];
}) {
  const appointmentsByDoctor = new Map<string, PrenotazioneAgenda[]>();
  appointments.forEach((appointment) => {
    if (appointment.data !== dateKey(date)) return;
    appointmentsByDoctor.set(appointment.medicoId, [...(appointmentsByDoctor.get(appointment.medicoId) ?? []), appointment]);
  });

  const gridTemplateColumns = `76px repeat(${Math.max(doctors.length, 1)}, minmax(190px, 1fr))`;
  const totalHeight = agendaSlots.length * SLOT_HEIGHT;
  const currentLineTop = ((minutiDaOra(CURRENT_TIME) - ORA_INIZIO * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="min-w-[1120px]">
        <div
          className="sticky top-0 z-20 grid border-b border-border bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]"
          style={{ gridTemplateColumns }}
        >
          <div className="border-r border-border bg-white px-3 py-4 text-xs font-medium uppercase text-muted-foreground">
            Ora
          </div>
          {doctors.map((doctor) => (
            <div key={doctor.id} className="min-w-0 border-r border-border px-3 py-3 last:border-r-0">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${doctor.colore}`}>
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">{doctor.nome}</p>
                    <Printer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {doctor.specialita} · {doctor.sedi.map((item) => (item === "modena" ? "Modena" : "Sassuolo")).join(", ")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns, minHeight: `${totalHeight}px` }}
        >
          <div className="sticky left-0 z-10 border-r border-border bg-white">
            {agendaSlots.map((slot) => (
              <div
                key={slot}
                className="border-b border-border/75 px-3 pt-1 text-xs text-muted-foreground"
                style={{ height: SLOT_HEIGHT }}
              >
                {formattaOraMinuti(slot)}
              </div>
            ))}
          </div>

          {doctors.length > 0 ? (
            doctors.map((doctor) => (
              <div key={doctor.id} className="relative border-r border-border bg-white last:border-r-0">
                <div
                  className="absolute left-0 right-0 bg-emerald-50/60"
                  style={{
                    top: ((8 * 60 - ORA_INIZIO * 60) / SLOT_MINUTES) * SLOT_HEIGHT,
                    height: ((13 * 60 - 8 * 60) / SLOT_MINUTES) * SLOT_HEIGHT,
                  }}
                />
                {agendaSlots.map((slot) => (
                  <div
                    key={slot}
                    className={`relative border-b border-border/70 ${slot % 60 === 30 ? "border-dashed" : ""}`}
                    style={{ height: SLOT_HEIGHT }}
                  />
                ))}
                {isSameDay(date, DEMO_TODAY) && currentLineTop >= 0 && currentLineTop <= totalHeight && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-600"
                    style={{ top: currentLineTop }}
                  />
                )}
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
          style={{ minHeight: `${agendaSlots.length * SLOT_HEIGHT}px` }}
        >
          <div className="border-r border-border">
            {agendaSlots.map((slot) => (
              <div
                key={slot}
                className="border-b border-border px-3 pt-1 text-xs text-muted-foreground"
                style={{ height: SLOT_HEIGHT }}
              >
                {formattaOraMinuti(slot)}
              </div>
            ))}
          </div>
          {dates.map((date) => {
            const dayKey = dateKey(date);
            const dayAppointments = appointments.filter((appointment) => appointment.data === dayKey);
            return (
              <div key={dayKey} className="relative border-r border-border last:border-r-0">
                {agendaSlots.map((slot) => (
                  <div key={slot} className="border-b border-border" style={{ height: SLOT_HEIGHT }} />
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
  const top = ((start - ORA_INIZIO * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  const height = Math.max(28, (appointment.durata / SLOT_MINUTES) * SLOT_HEIGHT - 4);
  const statusClass =
    appointment.stato === "annullata"
      ? "border-red-200 bg-red-50 text-red-900"
      : appointment.stato === "accettata"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : appointment.stato === "completata"
          ? "border-emerald-200 bg-emerald-100 text-emerald-950"
          : "border-emerald-200 bg-emerald-50 text-emerald-950";

  return (
    <div
      className={`absolute left-1.5 right-1.5 z-20 overflow-hidden rounded-md border p-1.5 shadow-sm ${statusClass}`}
      style={{ top, height }}
      title={`${appointment.ora} ${appointment.paziente} - ${appointment.prestazione}`}
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold leading-none">
        <Clock className="h-3 w-3" />
        <span>
          {appointment.ora}
          {height > 42 ? ` - ${aggiungiMinutiOra(appointment.ora, appointment.durata)}` : ""}
        </span>
      </div>
      <p className="mt-1 truncate text-xs font-semibold">{appointment.paziente}</p>
      <p className="truncate text-[10px] opacity-80">{appointment.prestazione}</p>
      {!compact && (
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-80">
          <span className="truncate">{statoLabel(appointment.stato)}</span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {appointment.sede === "modena" ? "MO" : "SASS"}
          </span>
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
