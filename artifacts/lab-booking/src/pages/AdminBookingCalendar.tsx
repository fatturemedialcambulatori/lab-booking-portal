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
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Clock,
  Download,
  FileText,
  MoreVertical,
  Plane,
  Plus,
  Printer,
  Search,
  Settings,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type AreaId = "laboratorio" | "ambulatorio";
type CalendarView = "giorno" | "ore-disponibili";
type SedeId = "tutte" | "modena" | "sassuolo";
type SedeOperativa = Exclude<SedeId, "tutte">;
type StatoPrenotazione = "confermata" | "accettata" | "completata" | "annullata";
type PeriodoOrarioDisponibile = "tutto" | "mattina" | "pomeriggio";
type WorkListPeriodo = "giorno" | "periodo";

type FasciaDisponibilita = {
  id?: string;
  giorno: string;
  dalle: string;
  alle: string;
};

type FasceDisponibilitaPerSede = Record<SedeOperativa, FasciaDisponibilita[]>;

type EccezioneAgendaMedico = {
  id?: string;
  sedeId: SedeOperativa;
  data: string;
  dalle: string;
  alle: string;
  note?: string;
};

type PianoFerieMedico = {
  id?: string;
  sedeId: SedeOperativa | "tutte";
  dal: string;
  al: string;
  dalle: string;
  alle: string;
  note?: string;
};

type MedicoSettings = {
  id: string;
  nome: string;
  specialita: string;
  agendaAperta?: boolean;
  disponibilita?: string[];
  disponibilitaPerSede?: Partial<Record<SedeOperativa, string[]>>;
  fasceDisponibilitaPerSede?: Partial<FasceDisponibilitaPerSede>;
  eccezioniAgenda?: EccezioneAgendaMedico[];
  pianoFerie?: PianoFerieMedico[];
};

type ListinoSettings = {
  id?: string;
  medicoId: string;
  prestazioneId?: string;
  durata: number;
};

type AdminSettingsData = {
  specialita?: Array<{ id: string; nome: string; attiva?: boolean }>;
  prestazioni?: Array<{ id: string; nome: string; specialita: string; durata?: number; attiva?: boolean }>;
  medici: MedicoSettings[];
  listini?: ListinoSettings[];
};

type MedicoAgenda = {
  id: string;
  nome: string;
  specialita: string;
  area: AreaId;
  sedi: SedeOperativa[];
  colore: string;
  agendaAperta: boolean;
  durataSlot: number;
  fasceDisponibilitaPerSede: FasceDisponibilitaPerSede;
  eccezioniAgenda: EccezioneAgendaMedico[];
  pianoFerie: PianoFerieMedico[];
};

type PrenotazioneAgenda = {
  id: string;
  area: AreaId;
  sede: Exclude<SedeId, "tutte">;
  medicoId: string;
  pazienteId?: number | string;
  paziente: string;
  pazienteEmail?: string;
  pazienteTelefono?: string;
  prestazione: string;
  note?: string;
  data: string;
  ora: string;
  durata: number;
  stato: StatoPrenotazione;
  overbooking?: boolean;
};

type PazienteAgenda = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  codiceFiscale?: string | null;
  gender?: "M" | "F" | null;
  email: string;
  phone: string;
  notes?: string | null;
};

type NuovoAppuntamentoDraft = {
  medicoId: string;
  data: string;
  ora: string;
  durata: number;
  sede: SedeOperativa;
  prestazioneId: string;
  prestazioneNome: string;
  pazienteId: string;
  pazienteSearch: string;
  creaNuovoPaziente: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  notes: string;
  notaPrenotazione: string;
  overbooking: boolean;
  overbookingReason: string;
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

const SEDI_OPERATIVE: SedeOperativa[] = ["modena", "sassuolo"];
const GIORNI_AGENDA = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const GIORNI_PREFERITI = [
  { id: "Lun", label: "L" },
  { id: "Mar", label: "M" },
  { id: "Mer", label: "M" },
  { id: "Gio", label: "G" },
  { id: "Ven", label: "V" },
  { id: "Sab", label: "S" },
  { id: "Dom", label: "D" },
];
const GIORNO_DA_DATE = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const DEFAULT_DURATA_SLOT = 20;
const DEFAULT_FASCE_DEMO: FasceDisponibilitaPerSede = {
  modena: [
    { giorno: "Lun", dalle: "09:00", alle: "13:00" },
    { giorno: "Mer", dalle: "09:00", alle: "13:00" },
    { giorno: "Ven", dalle: "09:00", alle: "13:00" },
  ],
  sassuolo: [
    { giorno: "Mar", dalle: "15:00", alle: "19:00" },
    { giorno: "Gio", dalle: "15:00", alle: "19:00" },
  ],
};
const COLORI_MEDICI = [
  "bg-sky-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-cyan-700",
  "bg-lime-600",
  "bg-green-700",
  "bg-red-600",
  "bg-amber-600",
  "bg-teal-700",
  "bg-indigo-600",
  "bg-rose-600",
];

const VIEWS: Array<{ id: CalendarView; label: string }> = [
  { id: "giorno", label: "Giorno" },
  { id: "ore-disponibili", label: "Ore disponibili" },
];

const MEDICI_AGENDA: Array<
  Omit<MedicoAgenda, "agendaAperta" | "durataSlot" | "fasceDisponibilitaPerSede" | "eccezioniAgenda" | "pianoFerie">
> = [
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

const MEDICI_AGENDA_DEMO: MedicoAgenda[] = MEDICI_AGENDA.map((medico, index) => ({
  ...medico,
  agendaAperta: true,
  durataSlot: DEFAULT_DURATA_SLOT,
  fasceDisponibilitaPerSede: DEFAULT_FASCE_DEMO,
  eccezioniAgenda: [],
  pianoFerie: [],
  colore: medico.colore || COLORI_MEDICI[index % COLORI_MEDICI.length],
}));

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
const AGENDA_APPOINTMENTS_STORAGE_KEY = "m-medical-agenda-appointments";

const normalizza = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isSedeOperativa = (value: unknown): value is SedeOperativa =>
  value === "modena" || value === "sassuolo";

const isStatoPrenotazione = (value: unknown): value is StatoPrenotazione =>
  value === "confermata" || value === "accettata" || value === "completata" || value === "annullata";

const isPrenotazioneAgenda = (value: unknown): value is PrenotazioneAgenda => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<PrenotazioneAgenda>;
  return (
    typeof item.id === "string" &&
    (item.area === "laboratorio" || item.area === "ambulatorio") &&
    isSedeOperativa(item.sede) &&
    typeof item.medicoId === "string" &&
    typeof item.paziente === "string" &&
    typeof item.prestazione === "string" &&
    typeof item.data === "string" &&
    typeof item.ora === "string" &&
    typeof item.durata === "number" &&
    isStatoPrenotazione(item.stato)
  );
};

const normalizzaPrenotazioniAgenda = (value: unknown): PrenotazioneAgenda[] =>
  Array.isArray(value) ? value.filter(isPrenotazioneAgenda) : [];

const unisciPrenotazioniAgenda = (...fonti: PrenotazioneAgenda[][]) => {
  const map = new Map<string, PrenotazioneAgenda>();
  fonti.flat().forEach((prenotazione) => {
    map.set(prenotazione.id, prenotazione);
  });
  return Array.from(map.values()).sort((a, b) => `${a.data}${a.ora}`.localeCompare(`${b.data}${b.ora}`));
};

const leggiPrenotazioniAgendaLocali = () => {
  if (typeof window === "undefined") return [];
  try {
    return normalizzaPrenotazioniAgenda(JSON.parse(window.localStorage.getItem(AGENDA_APPOINTMENTS_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
};

const salvaPrenotazioniAgendaLocali = (prenotazioni: PrenotazioneAgenda[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENDA_APPOINTMENTS_STORAGE_KEY, JSON.stringify(prenotazioni));
};

const isPazienteAgenda = (value: unknown): value is PazienteAgenda => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<PazienteAgenda>;
  return (
    typeof item.id === "number" &&
    typeof item.firstName === "string" &&
    typeof item.lastName === "string" &&
    typeof item.dateOfBirth === "string" &&
    typeof item.email === "string" &&
    typeof item.phone === "string"
  );
};

const normalizzaPazientiAgenda = (value: unknown): PazienteAgenda[] =>
  Array.isArray(value) ? value.filter(isPazienteAgenda) : [];

const nomePazienteAgenda = (paziente: PazienteAgenda) =>
  `${paziente.firstName} ${paziente.lastName}`.trim();

const isAdminSettingsData = (value: unknown): value is AdminSettingsData => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<AdminSettingsData>;
  return Array.isArray(data.medici);
};

const normalizzaOrario = (orario: string | undefined, fallback: string) =>
  /^\d{2}:\d{2}$/.test(orario ?? "") ? (orario as string) : fallback;

const normalizzaFascia = (fascia: Partial<FasciaDisponibilita>, fallbackGiorno = "Lun"): FasciaDisponibilita => ({
  id: fascia.id,
  giorno: GIORNI_AGENDA.includes(fascia.giorno ?? "") ? (fascia.giorno as string) : fallbackGiorno,
  dalle: normalizzaOrario(fascia.dalle, "09:00"),
  alle: normalizzaOrario(fascia.alle, "13:00"),
});

const fasceDaGiorni = (giorni: string[]) =>
  giorni.map((giorno) => normalizzaFascia({ giorno, dalle: "09:00", alle: "13:00" }, giorno));

const normalizzaFasceDisponibilita = (medico: MedicoSettings): FasceDisponibilitaPerSede => {
  const fallback: Record<SedeOperativa, string[]> = {
    modena: medico.disponibilitaPerSede?.modena ?? medico.disponibilita ?? [],
    sassuolo: medico.disponibilitaPerSede?.sassuolo ?? [],
  };

  return {
    modena: Array.isArray(medico.fasceDisponibilitaPerSede?.modena)
      ? medico.fasceDisponibilitaPerSede.modena.map((fascia, index) =>
          normalizzaFascia(fascia, fallback.modena[index] ?? "Lun"),
        )
      : fasceDaGiorni(fallback.modena),
    sassuolo: Array.isArray(medico.fasceDisponibilitaPerSede?.sassuolo)
      ? medico.fasceDisponibilitaPerSede.sassuolo.map((fascia, index) =>
          normalizzaFascia(fascia, fallback.sassuolo[index] ?? "Lun"),
        )
      : fasceDaGiorni(fallback.sassuolo),
  };
};

const normalizzaEccezioniAgenda = (medico: MedicoSettings): EccezioneAgendaMedico[] =>
  (medico.eccezioniAgenda ?? [])
    .filter((eccezione) => eccezione.data && eccezione.dalle && eccezione.alle)
    .map((eccezione) => ({
      ...eccezione,
      sedeId: SEDI_OPERATIVE.includes(eccezione.sedeId) ? eccezione.sedeId : "modena",
      dalle: normalizzaOrario(eccezione.dalle, "09:00"),
      alle: normalizzaOrario(eccezione.alle, "13:00"),
    }));

const normalizzaPianoFerie = (medico: MedicoSettings): PianoFerieMedico[] =>
  (medico.pianoFerie ?? [])
    .filter((ferie) => ferie.dal && ferie.al)
    .map((ferie, index) => {
      const dal = ferie.dal;
      const al = ferie.al >= dal ? ferie.al : dal;
      const sedeId = ferie.sedeId === "tutte" || SEDI_OPERATIVE.includes(ferie.sedeId as SedeOperativa)
        ? ferie.sedeId
        : "tutte";

      return {
        id: ferie.id ?? `ferie-${index}`,
        sedeId,
        dal,
        al,
        dalle: normalizzaOrario(ferie.dalle, "00:00"),
        alle: normalizzaOrario(ferie.alle, "23:59"),
        note: ferie.note ?? "",
      };
    });

const mediciDaAdminSettings = (data: AdminSettingsData, area: AreaId): MedicoAgenda[] => {
  const listini = data.listini ?? [];

  return (data.medici ?? [])
    .filter((medico) => medico.id && medico.nome)
    .map((medico, index) => {
      const fasceDisponibilitaPerSede = normalizzaFasceDisponibilita(medico);
      const sediConfigurate = SEDI_OPERATIVE.filter((sede) => fasceDisponibilitaPerSede[sede].length > 0);
      const durateMedico = listini
        .filter((listino) => listino.medicoId === medico.id && Number.isFinite(listino.durata) && listino.durata > 0)
        .map((listino) => listino.durata);

      return {
        id: medico.id,
        nome: medico.nome,
        specialita: medico.specialita || "Generale",
        area,
        sedi: sediConfigurate.length > 0 ? sediConfigurate : SEDI_OPERATIVE,
        colore: COLORI_MEDICI[index % COLORI_MEDICI.length],
        agendaAperta: true,
        durataSlot: durateMedico.length > 0 ? Math.max(5, Math.min(...durateMedico)) : DEFAULT_DURATA_SLOT,
        fasceDisponibilitaPerSede,
        eccezioniAgenda: normalizzaEccezioniAgenda(medico),
        pianoFerie: normalizzaPianoFerie(medico),
      } satisfies MedicoAgenda;
    });
};

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

const periodoVista = (view: CalendarView | "mese", date: Date) => {
  if (view === "giorno") return [date];
  if (view === "ore-disponibili") return Array.from({ length: 7 }, (_, index) => addDays(date, index));

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

const giornoAgendaDaData = (date: Date) => GIORNO_DA_DATE[date.getDay()];

const sediDaFiltro = (doctor: MedicoAgenda, sede: SedeId): SedeOperativa[] =>
  sede === "tutte" ? doctor.sedi : doctor.sedi.includes(sede) ? [sede] : [];

const fasceMedicoNelGiorno = (doctor: MedicoAgenda, date: Date, sede: SedeId) => {
  const dayKey = dateKey(date);
  const giorno = giornoAgendaDaData(date);
  return sediDaFiltro(doctor, sede).flatMap((sedeOperativa) => {
    const ricorrenti = doctor.fasceDisponibilitaPerSede[sedeOperativa]
      .filter((fascia) => fascia.giorno === giorno)
      .map((fascia) => ({ ...fascia, sede: sedeOperativa, eccezione: false }));
    const eccezioni = doctor.eccezioniAgenda
      .filter((eccezione) => eccezione.data === dayKey && eccezione.sedeId === sedeOperativa)
      .map((eccezione) => ({
        giorno,
        dalle: eccezione.dalle,
        alle: eccezione.alle,
        sede: sedeOperativa,
        eccezione: true,
      }));
    return [...ricorrenti, ...eccezioni];
  });
};

const ferieMedicoNelGiorno = (doctor: MedicoAgenda, date: Date, sede: SedeId) => {
  const dayKey = dateKey(date);
  const sediFiltro = sediDaFiltro(doctor, sede);

  return doctor.pianoFerie
    .filter((ferie) => {
      const sedeCompatibile = ferie.sedeId === "tutte" || sediFiltro.includes(ferie.sedeId);
      return sedeCompatibile && ferie.dal <= dayKey && ferie.al >= dayKey;
    })
    .map((ferie) => ({
      ...ferie,
      start: Math.max(minutiDaOra(ferie.dalle), ORA_INIZIO * 60),
      end: Math.min(minutiDaOra(ferie.alle), ORA_FINE * 60),
    }))
    .filter((ferie) => ferie.end > ferie.start);
};

const slotBloccatoDaFerie = (
  doctor: MedicoAgenda,
  date: Date,
  sede: SedeId,
  start: number,
  end: number,
) =>
  ferieMedicoNelGiorno(doctor, date, sede).find((ferie) => start < ferie.end && end > ferie.start);

const ferieCopreInteraAgenda = (doctor: MedicoAgenda, date: Date, sede: SedeId) => {
  const start = ORA_INIZIO * 60;
  const end = ORA_FINE * 60;
  return ferieMedicoNelGiorno(doctor, date, sede).some((ferie) => ferie.start <= start && ferie.end >= end);
};

const medicoLavoraNelGiorno = (doctor: MedicoAgenda, date: Date, sede: SedeId) =>
  fasceMedicoNelGiorno(doctor, date, sede).length > 0 && !ferieCopreInteraAgenda(doctor, date, sede);

const slotInFasciaPreferita = (time: number, fascia: PeriodoOrarioDisponibile) => {
  if (fascia === "mattina") return time < 13 * 60;
  if (fascia === "pomeriggio") return time >= 13 * 60;
  return true;
};

const slotHaConflitto = (
  doctorId: string,
  dayKey: string,
  start: number,
  end: number,
  appointments: PrenotazioneAgenda[],
  sede?: SedeOperativa,
) =>
  appointments.some((appointment) => {
    if (appointment.medicoId !== doctorId || appointment.data !== dayKey || appointment.stato === "annullata") {
      return false;
    }
    if (sede && appointment.sede !== sede) return false;
    const appointmentStart = minutiDaOra(appointment.ora);
    const appointmentEnd = appointmentStart + appointment.durata;
    return appointmentStart < end && appointmentEnd > start;
  });

const dettaglioDisponibilitaSlot = (
  doctor: MedicoAgenda,
  date: Date,
  sede: SedeId,
  start: number,
  durata: number,
  appointments: PrenotazioneAgenda[],
  sedeForzata?: SedeOperativa,
) => {
  const end = start + durata;
  const fasce = fasceMedicoNelGiorno(doctor, date, sedeForzata ?? sede);
  const fasceCompatibili = fasce.filter((fascia) => {
    const inizioFascia = minutiDaOra(fascia.dalle);
    const fineFascia = minutiDaOra(fascia.alle);
    return start >= inizioFascia && end <= fineFascia;
  });
  const fasciaCompatibile =
    fasceCompatibili.find((fascia) => !slotBloccatoDaFerie(doctor, date, fascia.sede, start, end)) ??
    fasceCompatibili[0];
  const sedeSlot = sedeForzata ?? fasciaCompatibile?.sede ?? (doctor.sedi[0] ?? "modena");
  const ferie = slotBloccatoDaFerie(doctor, date, sedeSlot, start, end);
  const haConflitto = slotHaConflitto(doctor.id, dateKey(date), start, end, appointments, sedeSlot);

  if (ferie) {
    return {
      disponibile: false,
      sede: sedeSlot,
      reason: `Stai inserendo un overbooking: il medico risulta in ferie${
        ferie.note ? ` (${ferie.note})` : ""
      }.`,
    };
  }

  if (!fasciaCompatibile) {
    return {
      disponibile: false,
      sede: sedeSlot,
      reason: "Stai inserendo un overbooking: il medico non risulta disponibile in questo orario.",
    };
  }

  if (haConflitto) {
    return {
      disponibile: false,
      sede: sedeSlot,
      reason: "Stai inserendo un overbooking: esiste gia un appuntamento sovrapposto.",
    };
  }

  return {
    disponibile: true,
    sede: sedeSlot,
    reason: "",
  };
};

const creaSlotDisponibili = (
  doctor: MedicoAgenda,
  date: Date,
  sede: SedeId,
  appointments: PrenotazioneAgenda[],
  fasciaPreferita: PeriodoOrarioDisponibile,
) => {
  const dayKey = dateKey(date);
  const durata = Math.max(5, doctor.durataSlot || DEFAULT_DURATA_SLOT);
  const fasce = fasceMedicoNelGiorno(doctor, date, sede);

  return fasce.flatMap((fascia) => {
    const start = minutiDaOra(fascia.dalle);
    const end = minutiDaOra(fascia.alle);
    const slots: Array<{ time: string; sede: SedeOperativa; occupato: boolean; eccezione: boolean }> = [];

    for (let current = start; current + durata <= end; current += durata) {
      if (!slotInFasciaPreferita(current, fasciaPreferita)) continue;
      if (slotBloccatoDaFerie(doctor, date, fascia.sede, current, current + durata)) continue;
      slots.push({
        time: formattaOraMinuti(current),
        sede: fascia.sede,
        occupato: slotHaConflitto(doctor.id, dayKey, current, current + durata, appointments),
        eccezione: fascia.eccezione,
      });
    }

    return slots;
  });
};

export function AdminBookingCalendar({
  area,
  onOpenDoctor,
}: {
  area: AreaId;
  onOpenDoctor?: (doctorId: string) => void;
}) {
  const [view, setView] = React.useState<CalendarView>("giorno");
  const [currentDate, setCurrentDate] = React.useState(DEMO_TODAY);
  const [settingsAgenda, setSettingsAgenda] = React.useState<AdminSettingsData | null>(null);
  const [mediciConfigurati, setMediciConfigurati] = React.useState<MedicoAgenda[] | null>(null);
  const [settingsCaricate, setSettingsCaricate] = React.useState(false);
  const [sede, setSede] = React.useState<SedeId>("tutte");
  const [specialitaFiltro, setSpecialitaFiltro] = React.useState("tutte");
  const [prestazioneFiltro, setPrestazioneFiltro] = React.useState("tutte");
  const [medicoId, setMedicoId] = React.useState("tutti");
  const [search, setSearch] = React.useState("");
  const [agendaSearch, setAgendaSearch] = React.useState("");
  const [giorniPreferiti, setGiorniPreferiti] = React.useState(GIORNI_AGENDA);
  const [periodoOrario, setPeriodoOrario] = React.useState<PeriodoOrarioDisponibile>("tutto");
  const [soloMediciConPrenotazioni, setSoloMediciConPrenotazioni] = React.useState(false);
  const [workListDate, setWorkListDate] = React.useState<string | null>(null);
  const [workListPeriodo, setWorkListPeriodo] = React.useState<WorkListPeriodo>("giorno");
  const [workListDal, setWorkListDal] = React.useState(dateKey(DEMO_TODAY));
  const [workListAl, setWorkListAl] = React.useState(dateKey(DEMO_TODAY));
  const [workListSede, setWorkListSede] = React.useState<SedeId>("tutte");
  const [workListDoctorId, setWorkListDoctorId] = React.useState("tutti");
  const [workListDoctorSearch, setWorkListDoctorSearch] = React.useState("");
  const [workListDoctorOpen, setWorkListDoctorOpen] = React.useState(false);
  const [prenotazioniSalvate, setPrenotazioniSalvate] = React.useState<PrenotazioneAgenda[]>(() =>
    leggiPrenotazioniAgendaLocali(),
  );
  const [appuntamentoDraft, setAppuntamentoDraft] = React.useState<NuovoAppuntamentoDraft | null>(null);
  const [pazientiAgenda, setPazientiAgenda] = React.useState<PazienteAgenda[]>([]);
  const [pazientiLoading, setPazientiLoading] = React.useState(false);
  const [salvataggioAppuntamento, setSalvataggioAppuntamento] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const caricaImpostazioniAgenda = async () => {
      try {
        const response = await fetch("/api/admin-settings");
        if (!response.ok) throw new Error("Impostazioni non disponibili");
        const data: unknown = await response.json();
        if (!active) return;

        if (isAdminSettingsData(data)) {
          setSettingsAgenda(data);
          setMediciConfigurati(mediciDaAdminSettings(data, area));
        } else {
          setSettingsAgenda(null);
          setMediciConfigurati([]);
        }
      } catch {
        if (!active) return;
        setSettingsAgenda(null);
        setMediciConfigurati(null);
        toast({
          title: "Attenzione",
          description: "Agenda non collegata alle impostazioni DB. Sto mostrando i dati demo.",
          variant: "destructive",
        });
      } finally {
        if (active) setSettingsCaricate(true);
      }
    };

    void caricaImpostazioniAgenda();

    return () => {
      active = false;
    };
  }, [area]);

  React.useEffect(() => {
    let active = true;

    const caricaAppuntamenti = async () => {
      try {
        const response = await fetch("/api/agenda-appointments");
        if (!response.ok) throw new Error("Appuntamenti agenda non disponibili");
        const data: unknown = await response.json();
        if (!active) return;

        const remoteAppointments = normalizzaPrenotazioniAgenda(data);
        setPrenotazioniSalvate((localAppointments) =>
          unisciPrenotazioniAgenda(remoteAppointments, localAppointments),
        );
      } catch {
        if (!active) return;
        setPrenotazioniSalvate(leggiPrenotazioniAgendaLocali());
      }
    };

    void caricaAppuntamenti();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    salvaPrenotazioniAgendaLocali(prenotazioniSalvate);
  }, [prenotazioniSalvate]);

  const caricaPazientiAgenda = React.useCallback(async (searchTerm = "") => {
    setPazientiLoading(true);
    try {
      const params = new URLSearchParams({ limit: "80" });
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const response = await fetch(`/api/patients?${params.toString()}`);
      if (!response.ok) throw new Error("Pazienti non disponibili");
      const data: unknown = await response.json();
      const nuoviPazienti = normalizzaPazientiAgenda(data);
      setPazientiAgenda((correnti) => {
        const map = new Map(correnti.map((paziente) => [paziente.id, paziente]));
        nuoviPazienti.forEach((paziente) => map.set(paziente.id, paziente));
        return Array.from(map.values()).sort((a, b) =>
          `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, "it"),
        );
      });
    } catch {
      setPazientiAgenda([]);
      toast({
        title: "Attenzione",
        description: "Non riesco a caricare i pazienti dall'anagrafica.",
        variant: "destructive",
      });
    } finally {
      setPazientiLoading(false);
    }
  }, []);

  const pazienteSearchDraft = appuntamentoDraft?.pazienteSearch ?? "";
  const appuntamentoDialogAperto = Boolean(appuntamentoDraft);
  const creaNuovoPazienteDraft = appuntamentoDraft?.creaNuovoPaziente ?? false;

  React.useEffect(() => {
    if (!appuntamentoDialogAperto || creaNuovoPazienteDraft) return;
    if (pazienteSearchDraft.trim().length > 0 && pazienteSearchDraft.trim().length < 2) return;

    const timer = window.setTimeout(() => {
      void caricaPazientiAgenda(pazienteSearchDraft);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [appuntamentoDialogAperto, caricaPazientiAgenda, creaNuovoPazienteDraft, pazienteSearchDraft]);

  const usaDatiDb = settingsCaricate && mediciConfigurati !== null;
  const mediciAgenda = React.useMemo(
    () => {
      if (!settingsCaricate) return [];
      return usaDatiDb ? mediciConfigurati ?? [] : MEDICI_AGENDA_DEMO;
    },
    [mediciConfigurati, settingsCaricate, usaDatiDb],
  );
  const prenotazioniBaseAgenda = React.useMemo(
    () => (!settingsCaricate || usaDatiDb ? [] : PRENOTAZIONI_AGENDA),
    [settingsCaricate, usaDatiDb],
  );
  const prenotazioniAgenda = React.useMemo(
    () => unisciPrenotazioniAgenda(prenotazioniBaseAgenda, prenotazioniSalvate),
    [prenotazioniBaseAgenda, prenotazioniSalvate],
  );

  const visibleDates = React.useMemo(() => periodoVista(view, currentDate), [currentDate, view]);
  const visibleDateKeys = React.useMemo(() => new Set(visibleDates.map(dateKey)), [visibleDates]);
  const prestazioniDisponibili = React.useMemo(
    () =>
      (settingsAgenda?.prestazioni ?? [])
        .filter((prestazione) => prestazione.attiva !== false)
        .sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    [settingsAgenda],
  );
  const prestazioneSelezionata = React.useMemo(
    () => prestazioniDisponibili.find((prestazione) => prestazione.id === prestazioneFiltro) ?? null,
    [prestazioneFiltro, prestazioniDisponibili],
  );
  const mediciCompatibiliPrestazione = React.useMemo(() => {
    if (prestazioneFiltro === "tutte") return null;
    return new Set(
      (settingsAgenda?.listini ?? [])
        .filter((listino) => listino.prestazioneId === prestazioneFiltro)
        .map((listino) => listino.medicoId),
    );
  }, [prestazioneFiltro, settingsAgenda]);

  const mediciArea = React.useMemo(
    () =>
      mediciAgenda.filter((medico) => {
        const sedeCompatibile = sede === "tutte" || medico.sedi.includes(sede);
        const query = normalizza(agendaSearch);
        const matchAgenda =
          !query ||
          [medico.nome, medico.specialita].some((campo) => normalizza(campo).includes(query));
        const matchSpecialita = specialitaFiltro === "tutte" || medico.specialita === specialitaFiltro;
        const matchPrestazione =
          prestazioneFiltro === "tutte" ||
          mediciCompatibiliPrestazione?.has(medico.id) ||
          (prestazioneSelezionata ? normalizza(prestazioneSelezionata.specialita) === normalizza(medico.specialita) : false);
        return medico.area === area && sedeCompatibile && matchAgenda && matchSpecialita && matchPrestazione;
      }),
    [
      agendaSearch,
      area,
      mediciAgenda,
      mediciCompatibiliPrestazione,
      prestazioneFiltro,
      prestazioneSelezionata,
      sede,
      specialitaFiltro,
    ],
  );

  const specialitaDisponibili = React.useMemo(() => {
    const nomi = new Set<string>();

    (settingsAgenda?.specialita ?? []).forEach((specialita) => {
      if (specialita.attiva !== false && specialita.nome) nomi.add(specialita.nome);
    });
    (settingsAgenda?.prestazioni ?? []).forEach((prestazione) => {
      if (prestazione.attiva !== false && prestazione.specialita) nomi.add(prestazione.specialita);
    });
    mediciAgenda.forEach((medico) => {
      if (medico.specialita) nomi.add(medico.specialita);
    });

    return Array.from(nomi).sort((a, b) => a.localeCompare(b, "it"));
  }, [mediciAgenda, settingsAgenda]);

  React.useEffect(() => {
    if (specialitaFiltro === "tutte" || specialitaDisponibili.includes(specialitaFiltro)) return;
    setSpecialitaFiltro("tutte");
  }, [specialitaDisponibili, specialitaFiltro]);

  React.useEffect(() => {
    if (prestazioneFiltro === "tutte" || prestazioniDisponibili.some((prestazione) => prestazione.id === prestazioneFiltro)) return;
    setPrestazioneFiltro("tutte");
  }, [prestazioneFiltro, prestazioniDisponibili]);

  const prenotazioniFiltrate = React.useMemo(() => {
    const mediciValidi = new Set(mediciArea.map((medico) => medico.id));
    return prenotazioniAgenda.filter((prenotazione) => {
      const medico = mediciAgenda.find((item) => item.id === prenotazione.medicoId);
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
  }, [area, medicoId, mediciAgenda, mediciArea, prenotazioniAgenda, search, sede, visibleDateKeys]);

  const mediciConDisponibilita = React.useMemo(
    () =>
      new Set(
        mediciArea
          .filter((medico) => medicoLavoraNelGiorno(medico, currentDate, sede))
          .map((medico) => medico.id),
      ),
    [currentDate, mediciArea, sede],
  );

  const mediciVisibili = React.useMemo(
    () =>
      mediciArea.filter((medico) => {
        const matchMedico = medicoId === "tutti" || medico.id === medicoId;
        const matchAttivita = !soloMediciConPrenotazioni || mediciConDisponibilita.has(medico.id);
        return matchMedico && matchAttivita;
      }),
    [mediciArea, medicoId, mediciConDisponibilita, soloMediciConPrenotazioni],
  );

  const prestazioniPerMedico = React.useCallback(
    (doctorId: string) => {
      const medico = mediciAgenda.find((item) => item.id === doctorId);
      const idsDaListino = new Set(
        (settingsAgenda?.listini ?? [])
          .filter((listino) => listino.medicoId === doctorId && listino.prestazioneId)
          .map((listino) => listino.prestazioneId as string),
      );

      const prestazioni = prestazioniDisponibili.filter((prestazione) => {
        const stessaSpecialita = medico
          ? normalizza(prestazione.specialita) === normalizza(medico.specialita)
          : false;
        return idsDaListino.has(prestazione.id) || stessaSpecialita;
      });

      return Array.from(new Map(prestazioni.map((prestazione) => [prestazione.id, prestazione])).values());
    },
    [mediciAgenda, prestazioniDisponibili, settingsAgenda],
  );

  const calcolaDraftAppuntamento = React.useCallback(
    (draft: NuovoAppuntamentoDraft): NuovoAppuntamentoDraft => {
      const doctor = mediciAgenda.find((item) => item.id === draft.medicoId);
      if (!doctor) return draft;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.data) || !/^\d{2}:\d{2}$/.test(draft.ora)) {
        return {
          ...draft,
          overbooking: true,
          overbookingReason: "Inserisci data e ora valide.",
        };
      }
      const date = new Date(`${draft.data}T12:00:00`);
      const start = minutiDaOra(draft.ora);
      if (!Number.isFinite(start)) {
        return {
          ...draft,
          overbooking: true,
          overbookingReason: "Inserisci un orario valido.",
        };
      }
      const dettaglio = dettaglioDisponibilitaSlot(
        doctor,
        date,
        draft.sede,
        start,
        Math.max(5, Number(draft.durata) || DEFAULT_DURATA_SLOT),
        prenotazioniAgenda,
        draft.sede,
      );

      return {
        ...draft,
        sede: dettaglio.sede,
        overbooking: !dettaglio.disponibile,
        overbookingReason: dettaglio.reason,
      };
    },
    [mediciAgenda, prenotazioniAgenda],
  );

  const aggiornaDraftAppuntamento = React.useCallback(
    (patch: Partial<NuovoAppuntamentoDraft>) => {
      setAppuntamentoDraft((current) => {
        if (!current) return current;
        return calcolaDraftAppuntamento({ ...current, ...patch });
      });
    },
    [calcolaDraftAppuntamento],
  );

  const apriNuovoAppuntamento = React.useCallback(
    (doctor: MedicoAgenda, date: Date, slot: number, sedeSlot?: SedeOperativa) => {
      const durata = Math.max(5, doctor.durataSlot || DEFAULT_DURATA_SLOT);
      const prestazioni = prestazioniPerMedico(doctor.id);
      const prestazioneDefault = prestazioni[0];
      const dettaglio = dettaglioDisponibilitaSlot(
        doctor,
        date,
        sede,
        slot,
        durata,
        prenotazioniAgenda,
        sedeSlot,
      );

      setAppuntamentoDraft({
        medicoId: doctor.id,
        data: dateKey(date),
        ora: formattaOraMinuti(slot),
        durata,
        sede: dettaglio.sede,
        prestazioneId: prestazioneDefault?.id ?? "",
        prestazioneNome: prestazioneDefault?.nome ?? "",
        pazienteId: "",
        pazienteSearch: "",
        creaNuovoPaziente: false,
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        email: "",
        phone: "",
        notes: "",
        notaPrenotazione: "",
        overbooking: !dettaglio.disponibile,
        overbookingReason: dettaglio.reason,
      });
    },
    [prenotazioniAgenda, prestazioniPerMedico, sede],
  );

  const medicoAppuntamento = React.useMemo(
    () => mediciAgenda.find((medico) => medico.id === appuntamentoDraft?.medicoId) ?? null,
    [appuntamentoDraft?.medicoId, mediciAgenda],
  );
  const prestazioniMedicoAppuntamento = React.useMemo(
    () => (appuntamentoDraft ? prestazioniPerMedico(appuntamentoDraft.medicoId) : []),
    [appuntamentoDraft, prestazioniPerMedico],
  );
  const pazientiFiltratiDialog = React.useMemo(() => {
    const query = normalizza(appuntamentoDraft?.pazienteSearch ?? "");
    if (!query) return pazientiAgenda.slice(0, 8);
    return pazientiAgenda
      .filter((paziente) =>
        [
          nomePazienteAgenda(paziente),
          paziente.email,
          paziente.phone,
          paziente.codiceFiscale ?? "",
        ].some((campo) => normalizza(campo).includes(query)),
      )
      .slice(0, 8);
  }, [appuntamentoDraft?.pazienteSearch, pazientiAgenda]);
  const pazienteSelezionatoDialog = React.useMemo(
    () =>
      pazientiAgenda.find((paziente) => String(paziente.id) === appuntamentoDraft?.pazienteId) ?? null,
    [appuntamentoDraft?.pazienteId, pazientiAgenda],
  );

  const salvaNuovoAppuntamento = async () => {
    if (!appuntamentoDraft || !medicoAppuntamento) return;

    const prestazione = appuntamentoDraft.prestazioneNome.trim();
    if (!prestazione) {
      toast({
        title: "Attenzione",
        description: "Inserisci la prestazione dell'appuntamento.",
        variant: "destructive",
      });
      return;
    }

    if (!appuntamentoDraft.creaNuovoPaziente && !pazienteSelezionatoDialog) {
      toast({
        title: "Attenzione",
        description: "Seleziona un paziente oppure creane uno nuovo.",
        variant: "destructive",
      });
      return;
    }

    if (appuntamentoDraft.creaNuovoPaziente && (!appuntamentoDraft.firstName.trim() || !appuntamentoDraft.lastName.trim())) {
      toast({
        title: "Attenzione",
        description: "Per creare un nuovo paziente servono nome e cognome.",
        variant: "destructive",
      });
      return;
    }

    setSalvataggioAppuntamento(true);

    try {
      let pazienteId: number | string | undefined = pazienteSelezionatoDialog?.id;
      let pazienteNome = pazienteSelezionatoDialog ? nomePazienteAgenda(pazienteSelezionatoDialog) : "";
      let pazienteEmail = pazienteSelezionatoDialog?.email ?? "";
      let pazienteTelefono = pazienteSelezionatoDialog?.phone ?? "";

      if (appuntamentoDraft.creaNuovoPaziente) {
        const firstName = appuntamentoDraft.firstName.trim();
        const lastName = appuntamentoDraft.lastName.trim();
        const response = await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            dateOfBirth: appuntamentoDraft.dateOfBirth || "1900-01-01",
            codiceFiscale: null,
            gender: null,
            email: appuntamentoDraft.email.trim() || `${slugFile(`${firstName}-${lastName}`)}-${Date.now()}@mmedical.local`,
            phone: appuntamentoDraft.phone.trim() || "N/D",
            notes: appuntamentoDraft.notes.trim() || null,
            billingAddress: null,
            billingCap: null,
            billingCity: null,
            billingProvincia: null,
          }),
        });

        if (!response.ok) throw new Error("Creazione paziente non riuscita");
        const pazienteCreato: unknown = await response.json();
        if (!isPazienteAgenda(pazienteCreato)) throw new Error("Risposta paziente non valida");

        pazienteId = pazienteCreato.id;
        pazienteNome = nomePazienteAgenda(pazienteCreato);
        pazienteEmail = pazienteCreato.email;
        pazienteTelefono = pazienteCreato.phone;
        setPazientiAgenda((correnti) => [pazienteCreato, ...correnti.filter((paziente) => paziente.id !== pazienteCreato.id)]);
      }

      const appuntamento = calcolaDraftAppuntamento(appuntamentoDraft);
      const nuovaPrenotazione: PrenotazioneAgenda = {
        id: `agenda-${Date.now()}`,
        area,
        sede: appuntamento.sede,
        medicoId: appuntamento.medicoId,
        pazienteId,
        paziente: pazienteNome,
        pazienteEmail,
        pazienteTelefono,
        prestazione,
        note: appuntamento.notaPrenotazione.trim() || undefined,
        data: appuntamento.data,
        ora: appuntamento.ora,
        durata: Math.max(5, Number(appuntamento.durata) || DEFAULT_DURATA_SLOT),
        stato: "confermata",
        overbooking: appuntamento.overbooking,
      };

      const response = await fetch("/api/agenda-appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuovaPrenotazione),
      });
      if (!response.ok) throw new Error("Salvataggio appuntamento non riuscito");

      setPrenotazioniSalvate((correnti) => unisciPrenotazioniAgenda(correnti, [nuovaPrenotazione]));
      setAppuntamentoDraft(null);
      toast({
        title: "Notifica",
        description: appuntamento.overbooking
          ? "Appuntamento salvato come overbooking."
          : "Appuntamento salvato in agenda.",
      });
    } catch (error) {
      toast({
        title: "Attenzione",
        description:
          error instanceof Error
            ? error.message
            : "Salvataggio appuntamento non riuscito. Verifica Supabase e Vercel.",
        variant: "destructive",
      });
    } finally {
      setSalvataggioAppuntamento(false);
    }
  };

  const goPrevious = () =>
    setCurrentDate((date) => addDays(date, view === "giorno" ? -1 : -7));
  const goNext = () =>
    setCurrentDate((date) => addDays(date, view === "giorno" ? 1 : 7));

  const areaLabel = area === "ambulatorio" ? "Ambulatorio" : "Laboratorio";

  const workListRange = React.useMemo(() => {
    const dal = workListDal || workListDate || dateKey(currentDate);
    const al = workListPeriodo === "periodo" ? workListAl || dal : dal;
    return dal <= al ? { dal, al } : { dal: al, al: dal };
  }, [currentDate, workListAl, workListDal, workListDate, workListPeriodo]);

  const workListSedeLabel = SEDI.find((item) => item.id === workListSede)?.label ?? "Tutte le sedi";
  const workListPeriodoLabel =
    workListRange.dal === workListRange.al
      ? format(new Date(`${workListRange.dal}T12:00:00`), "EEEE d MMMM yyyy", { locale: it })
      : `${format(new Date(`${workListRange.dal}T12:00:00`), "dd/MM/yyyy", { locale: it })} - ${format(
          new Date(`${workListRange.al}T12:00:00`),
          "dd/MM/yyyy",
          { locale: it },
        )}`;

  const mediciListaLavoro = React.useMemo(
    () =>
      mediciAgenda.filter(
        (medico) =>
          medico.area === area &&
          (workListSede === "tutte" || medico.sedi.includes(workListSede)),
      ),
    [area, mediciAgenda, workListSede],
  );

  const mediciListaLavoroFiltrati = React.useMemo(() => {
    const query = normalizza(workListDoctorSearch);
    if (!query) return mediciListaLavoro;
    return mediciListaLavoro.filter((medico) =>
      [medico.nome, medico.specialita].some((campo) => normalizza(campo).includes(query)),
    );
  }, [mediciListaLavoro, workListDoctorSearch]);

  const medicoListaLavoroSelezionato = React.useMemo(
    () => mediciListaLavoro.find((medico) => medico.id === workListDoctorId) ?? null,
    [mediciListaLavoro, workListDoctorId],
  );

  const prenotazioniListaLavoro = React.useMemo(() => {
    if (!workListDate) return [];
    const mediciValidi = new Set(mediciListaLavoro.map((medico) => medico.id));
    return prenotazioniAgenda.filter(
      (prenotazione) =>
        prenotazione.area === area &&
        prenotazione.data >= workListRange.dal &&
        prenotazione.data <= workListRange.al &&
        prenotazione.stato !== "annullata" &&
        (workListSede === "tutte" || prenotazione.sede === workListSede) &&
        (workListDoctorId === "tutti" || prenotazione.medicoId === workListDoctorId) &&
        mediciValidi.has(prenotazione.medicoId),
    ).sort((a, b) => `${a.medicoId}${a.data}${a.ora}`.localeCompare(`${b.medicoId}${b.data}${b.ora}`));
  }, [area, mediciListaLavoro, prenotazioniAgenda, workListDate, workListDoctorId, workListRange, workListSede]);

  const apriListaLavoro = (date: Date) => {
    const day = dateKey(date);
    const selectedDoctorStampabile =
      medicoId !== "tutti" &&
      mediciAgenda.some(
        (medico) =>
          medico.id === medicoId &&
          medico.area === area &&
          (sede === "tutte" || medico.sedi.includes(sede)),
      );

    setWorkListDate(day);
    setWorkListPeriodo("giorno");
    setWorkListDal(day);
    setWorkListAl(day);
    setWorkListSede(sede);
    setWorkListDoctorId(selectedDoctorStampabile ? medicoId : "tutti");
    setWorkListDoctorSearch("");
  };

  const chiudiListaLavoro = () => {
    setWorkListDate(null);
    setWorkListDoctorSearch("");
    setWorkListDoctorOpen(false);
  };

  const nomeFileListaLavoro = (extension: string) => {
    const doctor = mediciAgenda.find((medico) => medico.id === workListDoctorId);
    const doctorLabel = doctor ? doctor.nome : "tutti-medici";
    const periodo = workListRange.dal === workListRange.al ? workListRange.dal : `${workListRange.dal}-${workListRange.al}`;
    return `m-medical-lista-lavoro-${periodo}-${slugFile(areaLabel)}-${slugFile(
      SEDI.find((item) => item.id === workListSede)?.label ?? "sede",
    )}-${slugFile(doctorLabel)}.${extension}`;
  };

  const esportaListaLavoroCsv = () => {
    if (prenotazioniListaLavoro.length === 0) {
      toast({
        title: "Attenzione",
        description: "Nessun appuntamento da scaricare con il filtro selezionato.",
        variant: "destructive",
      });
      return;
    }

    const mediciMap = new Map(mediciAgenda.map((medico) => [medico.id, medico]));
    const columns = ["Data", "Ora", "Paziente", "Medico", "Specializzazione", "Prestazione", "Note", "Sede", "Durata", "Stato"];
    const rows = prenotazioniListaLavoro.map((prenotazione) => {
      const medico = mediciMap.get(prenotazione.medicoId);
      return [
        prenotazione.data,
        prenotazione.ora,
        prenotazione.paziente,
        medico?.nome ?? "",
        medico?.specialita ?? "",
        prenotazione.prestazione,
        prenotazione.note ?? "",
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
        description: "Nessun appuntamento da scaricare con il filtro selezionato.",
        variant: "destructive",
      });
      return;
    }

    const mediciMap = new Map(mediciAgenda.map((medico) => [medico.id, medico]));
    const grouped = new Map<string, PrenotazioneAgenda[]>();
    prenotazioniListaLavoro.forEach((prenotazione) => {
      grouped.set(prenotazione.medicoId, [...(grouped.get(prenotazione.medicoId) ?? []), prenotazione]);
    });
    const periodoLabel = workListPeriodoLabel;
    const sedeLabel = workListSedeLabel;
    const sections = Array.from(grouped.entries())
      .map(([doctorId, appointments]) => {
        const doctor = mediciMap.get(doctorId);
        const rows = appointments
          .sort((a, b) => `${a.data}${a.ora}`.localeCompare(`${b.data}${b.ora}`))
          .map(
            (appointment) => `
              <tr>
                <td>${escapeHtml(format(new Date(`${appointment.data}T12:00:00`), "dd/MM/yyyy", { locale: it }))}</td>
                <td>${escapeHtml(appointment.ora)}</td>
                <td>${escapeHtml(appointment.paziente)}</td>
                <td>${escapeHtml(appointment.prestazione)}</td>
                <td>${escapeHtml(appointment.note ?? "")}</td>
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
                  <th>Data</th>
                  <th>Ora</th>
                  <th>Paziente</th>
                  <th>Prestazione</th>
                  <th>Note</th>
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
          <title>Lista lavoro ${escapeHtml(periodoLabel)}</title>
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
          <div class="meta">${escapeHtml(periodoLabel)} · ${escapeHtml(areaLabel)} · ${escapeHtml(sedeLabel)}</div>
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
  const ultimoGiornoVisibile = visibleDates[visibleDates.length - 1] ?? currentDate;
  const titoloAgenda =
    view === "ore-disponibili"
      ? `Orari disponibili dal ${format(currentDate, "dd/MM/yyyy", { locale: it })} al ${format(
          ultimoGiornoVisibile,
          "dd/MM/yyyy",
          { locale: it },
        )}`
      : format(currentDate, "EEE, d MMM yyyy", { locale: it });
  const sottotitoloAgenda =
    view === "ore-disponibili"
      ? `${areaLabel} · ${sedeLabel} · ${mediciVisibili.length} medici`
      : `${areaLabel} · ${sedeLabel} · ${prenotazioniFiltrate.length} appuntamenti`;

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
                const hasWork = prenotazioniAgenda.some(
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

              {view === "ore-disponibili" && (
                <>
                  <Field label="Prestazioni">
                    <Select value={prestazioneFiltro} onValueChange={setPrestazioneFiltro}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tutte">Tutte le prestazioni</SelectItem>
                        {prestazioniDisponibili.map((prestazione) => (
                          <SelectItem key={prestazione.id} value={prestazione.id}>
                            {prestazione.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Giorni preferiti">
                    <div className="grid grid-cols-7 gap-1">
                      {GIORNI_PREFERITI.map((giorno) => {
                        const attivo = giorniPreferiti.includes(giorno.id);
                        return (
                          <button
                            key={giorno.id}
                            type="button"
                            onClick={() =>
                              setGiorniPreferiti((correnti) =>
                                attivo
                                  ? correnti.filter((item) => item !== giorno.id)
                                  : [...correnti, giorno.id],
                              )
                            }
                            className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                              attivo
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-white text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {giorno.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Orari preferiti">
                    <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border bg-white">
                      {[
                        ["tutto", "Tutti"],
                        ["mattina", "Mattina"],
                        ["pomeriggio", "Pomeriggio"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPeriodoOrario(value as PeriodoOrarioDisponibile)}
                          className={`h-9 border-r border-border px-2 text-sm last:border-r-0 ${
                            periodoOrario === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}
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
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2 shadow-sm">
                <span className="min-w-0 text-sm font-semibold text-foreground">Lavorano oggi</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soloMediciConPrenotazioni}
                  onClick={() => setSoloMediciConPrenotazioni((current) => !current)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    soloMediciConPrenotazioni
                      ? "border-primary bg-primary"
                      : "border-border bg-muted-foreground/25"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform ${
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
                  {titoloAgenda}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sottotitoloAgenda}
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
            {view === "ore-disponibili" ? (
              <AvailableHoursView
                dates={visibleDates}
                doctors={mediciVisibili}
                appointments={prenotazioniFiltrate}
                sede={sede}
                giorniPreferiti={giorniPreferiti}
                periodoOrario={periodoOrario}
                onOpenDoctor={onOpenDoctor}
                onSlotClick={apriNuovoAppuntamento}
              />
            ) : (
              <DayCalendar
                date={currentDate}
                doctors={mediciVisibili}
                appointments={prenotazioniFiltrate}
                sede={sede}
                onOpenDoctor={onOpenDoctor}
                onSlotClick={apriNuovoAppuntamento}
              />
            )}
          </div>
        </section>
      </div>

      <Dialog open={Boolean(appuntamentoDraft)} onOpenChange={(open) => !open && setAppuntamentoDraft(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo appuntamento</DialogTitle>
            <DialogDescription>
              Assegna paziente, prestazione e orario direttamente dall'agenda del medico.
            </DialogDescription>
          </DialogHeader>

          {appuntamentoDraft && medicoAppuntamento && (
            <div className="space-y-5">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agenda medico</p>
                <p className="mt-1 text-base font-semibold text-foreground">{medicoAppuntamento.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {medicoAppuntamento.specialita} · {appuntamentoDraft.sede === "modena" ? "Modena" : "Sassuolo"}
                </p>
              </div>

              {appuntamentoDraft.overbooking && (
                <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Overbooking</p>
                    <p className="text-sm">{appuntamentoDraft.overbookingReason}</p>
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Data">
                  <Input
                    type="date"
                    value={appuntamentoDraft.data}
                    onChange={(event) => aggiornaDraftAppuntamento({ data: event.target.value })}
                  />
                </Field>
                <Field label="Ora">
                  <Input
                    type="time"
                    value={appuntamentoDraft.ora}
                    onChange={(event) => aggiornaDraftAppuntamento({ ora: event.target.value })}
                  />
                </Field>
                <Field label="Durata">
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={appuntamentoDraft.durata}
                    onChange={(event) => aggiornaDraftAppuntamento({ durata: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Sede">
                  <Select
                    value={appuntamentoDraft.sede}
                    onValueChange={(value: SedeOperativa) => aggiornaDraftAppuntamento({ sede: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {medicoAppuntamento.sedi.map((sedeMedico) => (
                        <SelectItem key={sedeMedico} value={sedeMedico}>
                          {sedeMedico === "modena" ? "Modena" : "Sassuolo"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
                <Field label="Prestazioni del medico">
                  <Select
                    value={appuntamentoDraft.prestazioneId || "manuale"}
                    onValueChange={(value) => {
                      if (value === "manuale") {
                        aggiornaDraftAppuntamento({ prestazioneId: "" });
                        return;
                      }
                      const prestazione = prestazioniMedicoAppuntamento.find((item) => item.id === value);
                      const listino = settingsAgenda?.listini?.find(
                        (item) => item.medicoId === appuntamentoDraft.medicoId && item.prestazioneId === value,
                      );
                      aggiornaDraftAppuntamento({
                        prestazioneId: value,
                        prestazioneNome: prestazione?.nome ?? appuntamentoDraft.prestazioneNome,
                        durata: listino?.durata ?? prestazione?.durata ?? appuntamentoDraft.durata,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manuale">Prestazione manuale</SelectItem>
                      {prestazioniMedicoAppuntamento.map((prestazione) => (
                        <SelectItem key={prestazione.id} value={prestazione.id}>
                          {prestazione.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Nome prestazione">
                  <Input
                    value={appuntamentoDraft.prestazioneNome}
                    onChange={(event) => aggiornaDraftAppuntamento({ prestazioneNome: event.target.value })}
                    placeholder="Es. Visita ortopedica"
                  />
                </Field>
              </div>

              <Field label="Nota prenotazione">
                <Textarea
                  value={appuntamentoDraft.notaPrenotazione}
                  onChange={(event) => setAppuntamentoDraft((current) =>
                    current ? { ...current, notaPrenotazione: event.target.value } : current,
                  )}
                  placeholder="Es. portare esami precedenti, urgenza, richiesta specifica..."
                  className="min-h-20 resize-y"
                />
              </Field>

              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Paziente</p>
                    <p className="text-xs text-muted-foreground">Seleziona dall'anagrafica o crea un paziente al volo.</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={appuntamentoDraft.creaNuovoPaziente}
                      onCheckedChange={(checked) =>
                        setAppuntamentoDraft((current) =>
                          current
                            ? {
                                ...current,
                                creaNuovoPaziente: checked === true,
                                pazienteId: "",
                                pazienteSearch: "",
                              }
                            : current,
                        )
                      }
                    />
                    Nuovo paziente
                  </label>
                </div>

                {!appuntamentoDraft.creaNuovoPaziente ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={appuntamentoDraft.pazienteSearch}
                        onChange={(event) =>
                          setAppuntamentoDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  pazienteSearch: event.target.value,
                                  pazienteId: "",
                                }
                              : current,
                          )
                        }
                        placeholder="Cerca paziente per nome, email o telefono..."
                        className="pl-9"
                      />
                    </div>

                    {pazienteSelezionatoDialog && (
                      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                        <p className="text-sm font-semibold text-foreground">{nomePazienteAgenda(pazienteSelezionatoDialog)}</p>
                        <p className="text-xs text-muted-foreground">
                          {pazienteSelezionatoDialog.phone || "Telefono mancante"} · {pazienteSelezionatoDialog.email || "Email mancante"}
                        </p>
                      </div>
                    )}

                    <div className="max-h-52 overflow-y-auto rounded-md border border-border">
                      {pazientiLoading ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">Carico pazienti...</div>
                      ) : pazientiFiltratiDialog.length > 0 ? (
                        <div className="divide-y divide-border">
                          {pazientiFiltratiDialog.map((paziente) => (
                            <button
                              key={paziente.id}
                              type="button"
                              onClick={() =>
                                setAppuntamentoDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        pazienteId: String(paziente.id),
                                        pazienteSearch: "",
                                      }
                                    : current,
                                )
                              }
                              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted ${
                                appuntamentoDraft.pazienteId === String(paziente.id) ? "bg-primary/5" : "bg-white"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {nomePazienteAgenda(paziente)}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {paziente.dateOfBirth} · {paziente.phone || paziente.email || "Recapito mancante"}
                                </span>
                              </span>
                              {appuntamentoDraft.pazienteId === String(paziente.id) && (
                                <Badge variant="secondary">Selezionato</Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Nessun paziente trovato.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Nome">
                      <Input
                        value={appuntamentoDraft.firstName}
                        onChange={(event) => setAppuntamentoDraft((current) => current ? { ...current, firstName: event.target.value } : current)}
                        placeholder="Mario"
                      />
                    </Field>
                    <Field label="Cognome">
                      <Input
                        value={appuntamentoDraft.lastName}
                        onChange={(event) => setAppuntamentoDraft((current) => current ? { ...current, lastName: event.target.value } : current)}
                        placeholder="Rossi"
                      />
                    </Field>
                    <Field label="Data nascita">
                      <Input
                        type="date"
                        value={appuntamentoDraft.dateOfBirth}
                        onChange={(event) => setAppuntamentoDraft((current) => current ? { ...current, dateOfBirth: event.target.value } : current)}
                      />
                    </Field>
                    <Field label="Telefono">
                      <Input
                        value={appuntamentoDraft.phone}
                        onChange={(event) => setAppuntamentoDraft((current) => current ? { ...current, phone: event.target.value } : current)}
                        placeholder="+39 333..."
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={appuntamentoDraft.email}
                        onChange={(event) => setAppuntamentoDraft((current) => current ? { ...current, email: event.target.value } : current)}
                        placeholder="email@dominio.it"
                      />
                    </Field>
                    <Field label="Note">
                      <Input
                        value={appuntamentoDraft.notes}
                        onChange={(event) => setAppuntamentoDraft((current) => current ? { ...current, notes: event.target.value } : current)}
                        placeholder="Nota rapida"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAppuntamentoDraft(null)}>
              Annulla
            </Button>
            <Button type="button" onClick={salvaNuovoAppuntamento} disabled={salvataggioAppuntamento} className="gap-2">
              {appuntamentoDraft?.creaNuovoPaziente ? <UserPlus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {salvataggioAppuntamento ? "Salvo..." : "Salva appuntamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(workListDate)} onOpenChange={(open) => !open && chiudiListaLavoro()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Stampa lista lavoro</DialogTitle>
            <DialogDescription>
              Seleziona medico, sede e giorno o periodo da stampare.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filtro stampa</p>
                <p className="mt-1 text-base font-semibold capitalize text-foreground">
                  {workListPeriodoLabel}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {areaLabel} · {workListSedeLabel} · {medicoListaLavoroSelezionato?.nome ?? "Tutti i medici"}
                </p>
              </div>
              <Field label="Medico">
                <Popover open={workListDoctorOpen} onOpenChange={setWorkListDoctorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between bg-white text-left font-normal"
                    >
                      <span className="truncate">
                        {medicoListaLavoroSelezionato?.nome ?? "Tutti i medici"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <Command shouldFilter={false}>
                      <CommandInput
                        value={workListDoctorSearch}
                        onValueChange={setWorkListDoctorSearch}
                        placeholder="Cerca medico..."
                      />
                      <CommandList>
                        <CommandEmpty>Nessun medico trovato.</CommandEmpty>
                        <CommandItem
                          value="tutti"
                          onSelect={() => {
                            setWorkListDoctorId("tutti");
                            setWorkListDoctorSearch("");
                            setWorkListDoctorOpen(false);
                          }}
                        >
                          <Check className={`h-4 w-4 ${workListDoctorId === "tutti" ? "opacity-100" : "opacity-0"}`} />
                          Tutti i medici
                        </CommandItem>
                        {mediciListaLavoroFiltrati.map((medico) => (
                          <CommandItem
                            key={medico.id}
                            value={`${medico.nome} ${medico.specialita}`}
                            onSelect={() => {
                              setWorkListDoctorId(medico.id);
                              setWorkListDoctorSearch("");
                              setWorkListDoctorOpen(false);
                            }}
                          >
                            <Check className={`h-4 w-4 ${workListDoctorId === medico.id ? "opacity-100" : "opacity-0"}`} />
                            <span className="min-w-0">
                              <span className="block truncate">{medico.nome}</span>
                              <span className="block truncate text-xs text-muted-foreground">{medico.specialita}</span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Field>
            </div>

            <div className="grid gap-3 lg:grid-cols-[190px_1fr_1fr_240px]">
              <Field label="Periodo">
                <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-white">
                  {[
                    ["giorno", "Giorno"],
                    ["periodo", "Periodo"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWorkListPeriodo(value as WorkListPeriodo)}
                      className={`h-10 border-r border-border px-3 text-sm last:border-r-0 ${
                        workListPeriodo === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={workListPeriodo === "giorno" ? "Giorno" : "Dal"}>
                <Input
                  type="date"
                  value={workListDal}
                  onChange={(event) => {
                    setWorkListDal(event.target.value);
                    if (workListPeriodo === "giorno") setWorkListAl(event.target.value);
                  }}
                />
              </Field>
              <Field label="Al">
                <Input
                  type="date"
                  value={workListPeriodo === "giorno" ? workListDal : workListAl}
                  disabled={workListPeriodo === "giorno"}
                  onChange={(event) => setWorkListAl(event.target.value)}
                />
              </Field>
              <Field label="Sede">
                <Select
                  value={workListSede}
                  onValueChange={(value: SedeId) => {
                    setWorkListSede(value);
                    setWorkListDoctorId((current) => {
                      if (current === "tutti") return current;
                      const medico = mediciAgenda.find((item) => item.id === current);
                      return medico && medico.area === area && (value === "tutte" || medico.sedi.includes(value))
                        ? current
                        : "tutti";
                    });
                  }}
                >
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
                      const medico = mediciAgenda.find((item) => item.id === prenotazione.medicoId);
                      return (
                        <div key={prenotazione.id} className="grid gap-3 px-4 py-3 md:grid-cols-[100px_80px_minmax(0,1fr)_220px]">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {format(new Date(`${prenotazione.data}T12:00:00`), "dd/MM/yyyy", { locale: it })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{prenotazione.ora}</p>
                            <p className="text-xs text-muted-foreground">
                              {aggiungiMinutiOra(prenotazione.ora, prenotazione.durata)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{prenotazione.paziente}</p>
                            <p className="truncate text-xs text-muted-foreground">{prenotazione.prestazione}</p>
                            {prenotazione.note && (
                              <p className="truncate text-xs text-amber-700">{prenotazione.note}</p>
                            )}
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

function AvailableHoursView({
  dates,
  doctors,
  appointments,
  sede,
  giorniPreferiti,
  periodoOrario,
  onOpenDoctor,
  onSlotClick,
}: {
  dates: Date[];
  doctors: MedicoAgenda[];
  appointments: PrenotazioneAgenda[];
  sede: SedeId;
  giorniPreferiti: string[];
  periodoOrario: PeriodoOrarioDisponibile;
  onOpenDoctor?: (doctorId: string) => void;
  onSlotClick?: (doctor: MedicoAgenda, date: Date, slot: number, sede?: SedeOperativa) => void;
}) {
  const slotDisponibili = dates
    .map((date) => {
      const giorno = GIORNO_DA_DATE[date.getDay()];
      const dayKey = dateKey(date);
      if (!giorniPreferiti.includes(giorno)) return { date, righe: [] };

      const righe = doctors
        .map((doctor) => {
          const sediDaLeggere =
            sede === "tutte" ? doctor.sedi : doctor.sedi.includes(sede) ? [sede] : [];
          const fasceRicorrenti = sediDaLeggere.flatMap((sedeOperativa) =>
            doctor.fasceDisponibilitaPerSede[sedeOperativa]
              .filter((fascia) => fascia.giorno === giorno)
              .map((fascia) => ({ ...fascia, sedeId: sedeOperativa })),
          );
          const eccezioni = doctor.eccezioniAgenda
            .filter((eccezione) => eccezione.data === dayKey && sediDaLeggere.includes(eccezione.sedeId))
            .map((eccezione) => ({
              giorno,
              dalle: eccezione.dalle,
              alle: eccezione.alle,
              sedeId: eccezione.sedeId,
            }));
          const fasce = [...fasceRicorrenti, ...eccezioni];
          const appuntamentiMedico = appointments.filter(
            (appointment) => appointment.data === dayKey && appointment.medicoId === doctor.id,
          );
          const slot = fasce.flatMap((fascia) =>
            generaSlotDisponibili({
              fascia,
              doctor,
              date,
              appointments: appuntamentiMedico,
              periodoOrario,
            }),
          );
          const slotUnici = Array.from(
            new Map(slot.map((item) => [`${item.sedeId}-${item.ora}`, item])).values(),
          ).sort((a, b) => `${a.ora}${a.sedeId}`.localeCompare(`${b.ora}${b.sedeId}`));

          return {
            doctor,
            slot: slotUnici,
          };
        })
        .filter((riga) => riga.slot.length > 0);

      return { date, righe };
    })
    .filter((giorno) => giorno.righe.length > 0);

  if (slotDisponibili.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center text-sm text-muted-foreground">
        Nessun orario disponibile con i filtri selezionati.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="min-w-[980px] space-y-8 p-5">
        {slotDisponibili.map(({ date, righe }) => (
          <section key={dateKey(date)} className="space-y-4">
            <h3 className="text-base font-semibold capitalize text-foreground">
              {format(date, "EEEE, d MMMM yyyy", { locale: it })}
            </h3>
            <div className="divide-y divide-border">
              {righe.map(({ doctor, slot }) => (
                <div key={`${dateKey(date)}-${doctor.id}`} className="grid gap-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)]">
                  <button
                    type="button"
                    onClick={() => onOpenDoctor?.(doctor.id)}
                    className="min-w-0 rounded-md p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    title={`Apri profilo ${doctor.nome}`}
                  >
                    <p className="truncate text-sm font-semibold text-foreground">{doctor.nome}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{doctor.specialita}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doctor.sedi.map((item) => (item === "modena" ? "Modena" : "Sassuolo")).join(", ")}
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {slot.map((item) => (
                      <button
                        key={`${dateKey(date)}-${doctor.id}-${item.sedeId}-${item.ora}`}
                        type="button"
                        disabled={item.occupato}
                        onClick={() => onSlotClick?.(doctor, date, minutiDaOra(item.ora), item.sedeId)}
                        title={item.occupato ? item.appuntamento?.paziente : `${doctor.nome} ${item.ora}`}
                        className={`h-10 min-w-20 rounded-md border px-4 text-sm font-semibold transition-colors ${
                          item.occupato
                            ? "border-red-200 bg-red-100 text-red-800 line-through"
                            : "border-emerald-300 bg-emerald-100 text-emerald-900 shadow-sm hover:bg-emerald-200"
                        }`}
                      >
                        {item.ora}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function generaSlotDisponibili({
  fascia,
  doctor,
  date,
  appointments,
  periodoOrario,
}: {
  fascia: FasciaDisponibilita & { sedeId: SedeOperativa };
  doctor: MedicoAgenda;
  date: Date;
  appointments: PrenotazioneAgenda[];
  periodoOrario: PeriodoOrarioDisponibile;
}) {
  const inizio = minutiDaOra(fascia.dalle);
  const fine = minutiDaOra(fascia.alle);
  const durata = Math.max(5, doctor.durataSlot || DEFAULT_DURATA_SLOT);
  const slot: Array<{
    ora: string;
    sedeId: SedeOperativa;
    occupato: boolean;
    appuntamento?: PrenotazioneAgenda;
  }> = [];

  for (let cursor = inizio; cursor + durata <= fine; cursor += durata) {
    if (periodoOrario === "mattina" && cursor >= 13 * 60) continue;
    if (periodoOrario === "pomeriggio" && cursor < 13 * 60) continue;
    if (slotBloccatoDaFerie(doctor, date, fascia.sedeId, cursor, cursor + durata)) continue;

    const appuntamento = appointments.find((item) => {
      if (item.sede !== fascia.sedeId) return false;
      const start = minutiDaOra(item.ora);
      const end = start + item.durata;
      return cursor < end && cursor + durata > start;
    });

    slot.push({
      ora: formattaOraMinuti(cursor),
      sedeId: fascia.sedeId,
      occupato: Boolean(appuntamento),
      appuntamento,
    });
  }

  return slot;
}

function DayCalendar({
  date,
  doctors,
  appointments,
  sede,
  onOpenDoctor,
  onSlotClick,
}: {
  date: Date;
  doctors: MedicoAgenda[];
  appointments: PrenotazioneAgenda[];
  sede: SedeId;
  onOpenDoctor?: (doctorId: string) => void;
  onSlotClick?: (doctor: MedicoAgenda, date: Date, slot: number, sede?: SedeOperativa) => void;
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
              <button
                type="button"
                onClick={() => onOpenDoctor?.(doctor.id)}
                className="flex w-full min-w-0 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                title={`Apri profilo ${doctor.nome}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${doctor.colore}`}>
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{doctor.nome}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {doctor.specialita} · {doctor.sedi.map((item) => (item === "modena" ? "Modena" : "Sassuolo")).join(", ")}
                  </p>
                </div>
              </button>
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
            doctors.map((doctor) => {
              const fasce = fasceMedicoNelGiorno(doctor, date, sede);
              const ferie = ferieMedicoNelGiorno(doctor, date, sede);

              return (
                <div key={doctor.id} className="relative border-r border-border bg-white last:border-r-0">
                  {fasce.map((fascia, index) => {
                  const inizio = minutiDaOra(fascia.dalle);
                  const fine = minutiDaOra(fascia.alle);
                  return (
                    <div
                      key={`${doctor.id}-${fascia.sede}-${fascia.dalle}-${fascia.alle}-${index}`}
                      className="absolute left-0 right-0 z-0 border-y border-emerald-200 bg-emerald-100/80 shadow-[inset_4px_0_0_rgb(16,185,129)]"
                      style={{
                        top: ((inizio - ORA_INIZIO * 60) / SLOT_MINUTES) * SLOT_HEIGHT,
                        height: ((fine - inizio) / SLOT_MINUTES) * SLOT_HEIGHT,
                      }}
                    >
                      <span className="pointer-events-none absolute left-2 top-1 rounded-sm bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 shadow-sm">
                        Disponibile · {fascia.sede === "modena" ? "Modena" : "Sassuolo"}
                      </span>
                    </div>
                  );
                })}
                {ferie.map((periodo, index) => (
                  <div
                    key={`${doctor.id}-ferie-${periodo.id ?? index}`}
                    className="absolute left-0 right-0 z-20 flex items-start gap-2 border-y border-amber-300 bg-amber-100/90 px-2 py-1 text-amber-950 shadow-[inset_4px_0_0_rgb(245,158,11)]"
                    style={{
                      top: ((periodo.start - ORA_INIZIO * 60) / SLOT_MINUTES) * SLOT_HEIGHT,
                      height: ((periodo.end - periodo.start) / SLOT_MINUTES) * SLOT_HEIGHT,
                    }}
                  >
                    <Plane className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0 text-[11px] leading-tight">
                      <p className="truncate font-semibold">Ferie</p>
                      <p className="truncate opacity-80">
                        {periodo.sedeId === "tutte"
                          ? "Tutte le sedi"
                          : periodo.sedeId === "modena"
                            ? "Modena"
                            : "Sassuolo"}
                        {periodo.note ? ` · ${periodo.note}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
                {agendaSlots.map((slot) => {
                  const dettaglio = dettaglioDisponibilitaSlot(
                    doctor,
                    date,
                    sede,
                    slot,
                    Math.max(5, doctor.durataSlot || DEFAULT_DURATA_SLOT),
                    appointments,
                  );

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onSlotClick?.(doctor, date, slot, dettaglio.sede)}
                      className={`relative z-10 block w-full border-b border-border/70 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        slot % 60 === 30 ? "border-dashed" : ""
                      } ${
                        dettaglio.disponibile
                          ? "hover:bg-emerald-200/55"
                          : "hover:bg-red-50/80"
                      }`}
                      style={{ height: SLOT_HEIGHT }}
                      aria-label={`Aggiungi appuntamento ${doctor.nome} alle ${formattaOraMinuti(slot)}`}
                    />
                  );
                })}
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
              );
            })
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
      title={`${appointment.ora} ${appointment.paziente} - ${appointment.prestazione}${appointment.note ? ` - ${appointment.note}` : ""}`}
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
      {appointment.note && height > 58 && (
        <p className="truncate text-[10px] font-medium opacity-80">{appointment.note}</p>
      )}
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
