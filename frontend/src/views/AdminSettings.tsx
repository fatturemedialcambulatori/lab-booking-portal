import React from "react";
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Download,
  Euro,
  FileText,
  Plane,
  Plus,
  Percent,
  Search,
  Stethoscope,
  Tags,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { AdminAuditLogs } from "./AdminAuditLogs";

type Prestazione = {
  id: string;
  nome: string;
  specialita: string;
  durata: number;
  attiva: boolean;
};

const copiaPrestazioni = (lista: Prestazione[]) => lista.map((prestazione) => ({ ...prestazione }));

type ConventionPricingMode = "fixed" | "discount";

type ConventionTemplateService = {
  id: string;
  prestazioneId: string;
  nome: string;
  specialita: string;
  durata: number;
  pricingMode: ConventionPricingMode;
  discountPercent: number;
  prezzo: number;
};

type ConventionTemplate = {
  id: string;
  nome: string;
  descrizione: string;
  attiva: boolean;
  services: ConventionTemplateService[];
};

type DatiFatturazioneMedico = {
  intestatario: string;
  partitaIva: string;
  codiceFiscale: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  emailFatturazione: string;
  pec: string;
  codiceSdi: string;
  regimeFiscale: string;
  noteFatturazione: string;
};

type SedeMedicoId = "modena" | "sassuolo";
type TipoRisorsaSede = "ambulatorio" | "ecografo" | "ecg" | "strumento";

type RisorsaSede = {
  id: string;
  sedeId: SedeMedicoId;
  tipo: TipoRisorsaSede;
  nome: string;
  attiva: boolean;
  note: string;
};

type DisponibilitaPerSedeMedico = Record<SedeMedicoId, string[]>;

type FasciaDisponibilita = {
  id: string;
  giorno: string;
  dalle: string;
  alle: string;
};

type FasceDisponibilitaPerSedeMedico = Record<SedeMedicoId, FasciaDisponibilita[]>;

type EccezioneAgendaMedico = {
  id: string;
  sedeId: SedeMedicoId;
  data: string;
  dalle: string;
  alle: string;
  note: string;
};

type PianoFerieMedico = {
  id: string;
  sedeId: SedeMedicoId | "tutte";
  dal: string;
  al: string;
  dalle: string;
  alle: string;
  note: string;
};

type AgendaMedicoDraft = {
  fasceDisponibilitaPerSede: FasceDisponibilitaPerSedeMedico;
  eccezioniAgenda: EccezioneAgendaMedico[];
  pianoFerie: PianoFerieMedico[];
};

type Medico = {
  id: string;
  nome: string;
  specialita: string;
  agendaAperta: boolean;
  disponibilita: string[];
  disponibilitaPerSede?: Partial<DisponibilitaPerSedeMedico>;
  fasceDisponibilitaPerSede?: Partial<FasceDisponibilitaPerSedeMedico>;
  eccezioniAgenda?: EccezioneAgendaMedico[];
  pianoFerie?: PianoFerieMedico[];
  datiFatturazione?: DatiFatturazioneMedico;
};

type CompensoTipo = "percentuale" | "fisso";

type Listino = {
  id: string;
  prestazioneId: string;
  medicoId: string;
  durata: number;
  prezzo: number;
  compensoTipo: CompensoTipo;
  compensoValore: number;
};

type StatoPrenotazioneCompenso = "confermata" | "eseguita" | "annullata";

type PrenotazioneCompenso = {
  id: string;
  data: string;
  ora: string;
  paziente: string;
  medicoId: string;
  listinoId: string;
  stato: StatoPrenotazioneCompenso;
  fatturata: boolean;
  importoFatturato?: number;
  numeroFattura?: string;
  dataFattura?: string;
};

type PrenotazioneCalcolata = {
  prenotazione: PrenotazioneCompenso;
  medico: Medico;
  prestazione: Prestazione;
  listino: Listino;
  incasso: number;
  quota: number;
  netto: number;
};

type RigaExportCompenso = Record<string, string | number>;

type GruppoExportCompensi = {
  id: string;
  nome: string;
  righe: PrenotazioneCalcolata[];
};

type FormatoExportCompensi = "pdf" | "csv";

type OpzioniExportCompensi = {
  oscuraPazienti: boolean;
  mostraTotalePrenotazioni: boolean;
  mostraIncasso: boolean;
  mostraCompensi: boolean;
  mostraNettoStudio: boolean;
  separaMedici: boolean;
};

type AdminSettingsData = {
  specialita: Specialita[];
  prestazioni: Prestazione[];
  medici: Medico[];
  listini: Listino[];
  conventionTemplates: ConventionTemplate[];
  risorseSedi: RisorsaSede[];
};

type SettingsSaveState = "loading" | "dirty" | "saving" | "saved" | "error";
type SettingsTabId = "specialita" | "prestazioni" | "convenzioni" | "risorse" | "medici" | "compensi" | "log";

export type SettingsSaveControl = {
  state: SettingsSaveState;
  canSave: boolean;
  onSave: () => void;
};

type Specialita = {
  id: string;
  nome: string;
  attiva: boolean;
};

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

const SEDI_MEDICO: Array<{ id: SedeMedicoId; label: string; sigla: string }> = [
  { id: "modena", label: "Modena", sigla: "MO" },
  { id: "sassuolo", label: "Sassuolo", sigla: "SASS" },
];

const TIPI_RISORSA_SEDE: Array<{ id: TipoRisorsaSede; label: string; plurale: string }> = [
  { id: "ambulatorio", label: "Ambulatorio", plurale: "Ambulatori" },
  { id: "ecografo", label: "Ecografo", plurale: "Ecografi" },
  { id: "ecg", label: "ECG", plurale: "ECG" },
  { id: "strumento", label: "Altro strumento", plurale: "Altri strumenti" },
];

const creaRisorsaSedePreset = (
  sedeId: SedeMedicoId,
  tipo: TipoRisorsaSede,
  indice: number,
): RisorsaSede => {
  const tipoLabel = TIPI_RISORSA_SEDE.find((item) => item.id === tipo)?.label ?? tipo;
  return {
    id: `${sedeId}-${tipo}-${indice}`,
    sedeId,
    tipo,
    nome: `${tipoLabel} ${indice}`,
    attiva: true,
    note: "",
  };
};

const RISORSE_SEDI_INIZIALI: RisorsaSede[] = [
  ...Array.from({ length: 5 }, (_, index) => creaRisorsaSedePreset("modena", "ambulatorio", index + 1)),
  ...Array.from({ length: 2 }, (_, index) => creaRisorsaSedePreset("modena", "ecografo", index + 1)),
  creaRisorsaSedePreset("modena", "ecg", 1),
  ...Array.from({ length: 2 }, (_, index) => creaRisorsaSedePreset("sassuolo", "ambulatorio", index + 1)),
  creaRisorsaSedePreset("sassuolo", "ecografo", 1),
  creaRisorsaSedePreset("sassuolo", "ecg", 1),
];

const DEFAULT_FASCIA_DALLE = "09:00";
const DEFAULT_FASCIA_ALLE = "13:00";
const DEFAULT_FERIE_DALLE = "00:00";
const DEFAULT_FERIE_ALLE = "23:59";

const valuta = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const percentuale = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
});

const dataItaliana = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATI_FATTURAZIONE_MEDICO_VUOTI: DatiFatturazioneMedico = {
  intestatario: "",
  partitaIva: "",
  codiceFiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  emailFatturazione: "",
  pec: "",
  codiceSdi: "",
  regimeFiscale: "",
  noteFatturazione: "",
};

const creaDisponibilitaPerSedeVuota = (): DisponibilitaPerSedeMedico => ({
  modena: [],
  sassuolo: [],
});

const creaIdAgenda = (prefisso: string) =>
  `${prefisso}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const creaFasceDisponibilitaPerSedeVuota = (): FasceDisponibilitaPerSedeMedico => ({
  modena: [],
  sassuolo: [],
});

const creaFasciaDisponibilita = (giorno = GIORNI[0]): FasciaDisponibilita => ({
  id: creaIdAgenda("fascia"),
  giorno,
  dalle: DEFAULT_FASCIA_DALLE,
  alle: DEFAULT_FASCIA_ALLE,
});

const creaEccezioneAgenda = (sedeId: SedeMedicoId = "modena"): EccezioneAgendaMedico => ({
  id: creaIdAgenda("eccezione"),
  sedeId,
  data: new Date().toISOString().slice(0, 10),
  dalle: DEFAULT_FASCIA_DALLE,
  alle: DEFAULT_FASCIA_ALLE,
  note: "",
});

const creaPianoFerieMedico = (): PianoFerieMedico => {
  const oggi = new Date().toISOString().slice(0, 10);
  return {
    id: creaIdAgenda("ferie"),
    sedeId: "tutte",
    dal: oggi,
    al: oggi,
    dalle: DEFAULT_FERIE_DALLE,
    alle: DEFAULT_FERIE_ALLE,
    note: "",
  };
};

const normalizzaOrario = (orario: string | undefined, fallback: string) =>
  /^\d{2}:\d{2}$/.test(orario ?? "") ? orario as string : fallback;

const normalizzaFasciaDisponibilita = (
  fascia: Partial<FasciaDisponibilita>,
  fallbackGiorno = GIORNI[0],
  index = 0,
): FasciaDisponibilita => ({
  id: fascia.id || `fascia-${fallbackGiorno}-${index}`,
  giorno: GIORNI.includes(fascia.giorno ?? "") ? fascia.giorno as string : fallbackGiorno,
  dalle: normalizzaOrario(fascia.dalle, DEFAULT_FASCIA_DALLE),
  alle: normalizzaOrario(fascia.alle, DEFAULT_FASCIA_ALLE),
});

const normalizzaEccezioneAgenda = (
  eccezione: Partial<EccezioneAgendaMedico>,
  index = 0,
): EccezioneAgendaMedico => ({
  id: eccezione.id || `eccezione-${index}`,
  sedeId: SEDI_MEDICO.some((sede) => sede.id === eccezione.sedeId) ? eccezione.sedeId as SedeMedicoId : "modena",
  data: eccezione.data || new Date().toISOString().slice(0, 10),
  dalle: normalizzaOrario(eccezione.dalle, DEFAULT_FASCIA_DALLE),
  alle: normalizzaOrario(eccezione.alle, DEFAULT_FASCIA_ALLE),
  note: eccezione.note ?? "",
});

const normalizzaPianoFerieMedico = (
  ferie: Partial<PianoFerieMedico>,
  index = 0,
): PianoFerieMedico => {
  const oggi = new Date().toISOString().slice(0, 10);
  const dal = ferie.dal || oggi;
  const al = ferie.al && ferie.al >= dal ? ferie.al : dal;
  const sedeCandidate = ferie.sedeId;
  let sedeId: PianoFerieMedico["sedeId"] = "tutte";
  if (sedeCandidate === "tutte" || sedeCandidate === "modena" || sedeCandidate === "sassuolo") {
    sedeId = sedeCandidate;
  }

  return {
    id: ferie.id || `ferie-${index}`,
    sedeId,
    dal,
    al,
    dalle: normalizzaOrario(ferie.dalle, DEFAULT_FERIE_DALLE),
    alle: normalizzaOrario(ferie.alle, DEFAULT_FERIE_ALLE),
    note: ferie.note ?? "",
  };
};

const fasceDaGiorni = (giorni: string[]) =>
  giorni.map((giorno, index) =>
    normalizzaFasciaDisponibilita(
      {
        id: `fascia-${normalizzaTesto(giorno) || "giorno"}-${index}`,
        giorno,
        dalle: DEFAULT_FASCIA_DALLE,
        alle: DEFAULT_FASCIA_ALLE,
      },
      GIORNI.includes(giorno) ? giorno : GIORNI[0],
      index,
    ),
  );

const copiaFasceDisponibilitaPerSede = (
  fasceDisponibilitaPerSede: FasceDisponibilitaPerSedeMedico,
): FasceDisponibilitaPerSedeMedico => ({
  modena: fasceDisponibilitaPerSede.modena.map((fascia) => ({ ...fascia })),
  sassuolo: fasceDisponibilitaPerSede.sassuolo.map((fascia) => ({ ...fascia })),
});

const disponibilitaSediDaFasce = (
  fasceDisponibilitaPerSede: FasceDisponibilitaPerSedeMedico,
): DisponibilitaPerSedeMedico => ({
  modena: Array.from(new Set(fasceDisponibilitaPerSede.modena.map((fascia) => fascia.giorno))),
  sassuolo: Array.from(new Set(fasceDisponibilitaPerSede.sassuolo.map((fascia) => fascia.giorno))),
});

const normalizzaDisponibilitaPerSede = (
  medico: Pick<Medico, "disponibilita" | "disponibilitaPerSede" | "fasceDisponibilitaPerSede">,
): DisponibilitaPerSedeMedico => {
  if (medico.fasceDisponibilitaPerSede) {
    return disponibilitaSediDaFasce({
      modena: (medico.fasceDisponibilitaPerSede.modena ?? []).map((fascia, index) =>
        normalizzaFasciaDisponibilita(fascia, GIORNI[0], index),
      ),
      sassuolo: (medico.fasceDisponibilitaPerSede.sassuolo ?? []).map((fascia, index) =>
        normalizzaFasciaDisponibilita(fascia, GIORNI[0], index),
      ),
    });
  }

  return {
    modena: medico.disponibilitaPerSede?.modena ?? medico.disponibilita ?? [],
    sassuolo: medico.disponibilitaPerSede?.sassuolo ?? [],
  };
};

const unisciDisponibilitaSedi = (disponibilitaPerSede: DisponibilitaPerSedeMedico) =>
  Array.from(new Set(SEDI_MEDICO.flatMap((sede) => disponibilitaPerSede[sede.id])));

const normalizzaFasceDisponibilitaPerSede = (
  medico: Pick<Medico, "disponibilita" | "disponibilitaPerSede" | "fasceDisponibilitaPerSede">,
): FasceDisponibilitaPerSedeMedico => {
  const disponibilitaLegacy: DisponibilitaPerSedeMedico = {
    modena: medico.disponibilitaPerSede?.modena ?? medico.disponibilita ?? [],
    sassuolo: medico.disponibilitaPerSede?.sassuolo ?? [],
  };

  return {
    modena: Array.isArray(medico.fasceDisponibilitaPerSede?.modena)
      ? medico.fasceDisponibilitaPerSede.modena.map((fascia, index) =>
          normalizzaFasciaDisponibilita(fascia, disponibilitaLegacy.modena[index] ?? GIORNI[0], index),
        )
      : fasceDaGiorni(disponibilitaLegacy.modena),
    sassuolo: Array.isArray(medico.fasceDisponibilitaPerSede?.sassuolo)
      ? medico.fasceDisponibilitaPerSede.sassuolo.map((fascia, index) =>
          normalizzaFasciaDisponibilita(fascia, disponibilitaLegacy.sassuolo[index] ?? GIORNI[0], index),
        )
      : fasceDaGiorni(disponibilitaLegacy.sassuolo),
  };
};

const normalizzaEccezioniAgenda = (medico: Pick<Medico, "eccezioniAgenda">) =>
  (medico.eccezioniAgenda ?? []).map((eccezione, index) => normalizzaEccezioneAgenda(eccezione, index));

const normalizzaPianoFerie = (medico: Pick<Medico, "pianoFerie">) =>
  (medico.pianoFerie ?? []).map((ferie, index) => normalizzaPianoFerieMedico(ferie, index));

const normalizzaConventionTemplateService = (
  service: Partial<ConventionTemplateService>,
  index = 0,
): ConventionTemplateService => ({
  id: service.id || service.prestazioneId || `convenzione-servizio-${index}`,
  prestazioneId: service.prestazioneId ?? service.id ?? `prestazione-${index}`,
  nome: service.nome ?? "Prestazione",
  specialita: service.specialita ?? "",
  durata: Math.max(5, Number(service.durata ?? 30) || 30),
  pricingMode: service.pricingMode === "discount" ? "discount" : "fixed",
  discountPercent: Math.max(0, Math.min(100, Number(service.discountPercent ?? 0) || 0)),
  prezzo: Math.max(0, Number(service.prezzo ?? 0) || 0),
});

const normalizzaConventionTemplate = (
  template: Partial<ConventionTemplate>,
  index = 0,
): ConventionTemplate => ({
  id: template.id || slugId("convenzione-base", template.nome || "Convenzione base", index),
  nome: template.nome?.trim() || "Convenzione base",
  descrizione: template.descrizione ?? "",
  attiva: template.attiva !== false,
  services: Array.isArray(template.services)
    ? template.services.map((service, serviceIndex) => normalizzaConventionTemplateService(service, serviceIndex))
    : [],
});

const copiaConventionTemplates = (templates: ConventionTemplate[]) =>
  templates.map((template) => ({
    ...template,
    services: template.services.map((service) => ({ ...service })),
  }));

const creaAgendaDraftDaMedico = (medico: Medico): AgendaMedicoDraft => ({
  fasceDisponibilitaPerSede: copiaFasceDisponibilitaPerSede(normalizzaFasceDisponibilitaPerSede(medico)),
  eccezioniAgenda: normalizzaEccezioniAgenda(medico).map((eccezione) => ({ ...eccezione })),
  pianoFerie: normalizzaPianoFerie(medico).map((ferie) => ({ ...ferie })),
});

const descriviFasciaDisponibilita = (fascia: FasciaDisponibilita) =>
  `${fascia.giorno} ${fascia.dalle}-${fascia.alle}`;

const descriviFasceDisponibilita = (fasce: FasciaDisponibilita[]) =>
  fasce.length > 0 ? fasce.map(descriviFasciaDisponibilita).join(", ") : "Nessuna fascia";

const normalizzaMedico = (medico: Medico): Medico => {
  const fasceDisponibilitaPerSede = normalizzaFasceDisponibilitaPerSede(medico);
  const disponibilitaPerSede = disponibilitaSediDaFasce(fasceDisponibilitaPerSede);

  return {
    ...medico,
    disponibilita: unisciDisponibilitaSedi(disponibilitaPerSede),
    disponibilitaPerSede,
    fasceDisponibilitaPerSede,
    eccezioniAgenda: normalizzaEccezioniAgenda(medico),
    agendaAperta: true,
    pianoFerie: normalizzaPianoFerie(medico),
    datiFatturazione: {
      ...DATI_FATTURAZIONE_MEDICO_VUOTI,
      ...medico.datiFatturazione,
    },
  };
};

const formattaData = (data: string) => dataItaliana.format(new Date(`${data}T12:00:00`));

const limitaPercentuale = (valore: number) => Math.min(100, Math.max(0, valore));

const formattaNumeroCsv = (valore: number) => valore.toFixed(2).replace(".", ",");

const formattaPercentualeSuIncasso = (valore: number, incasso: number) =>
  incasso > 0 ? `${percentuale.format((valore / incasso) * 100)}% dell'incasso` : "0% dell'incasso";

const prenotazioneMaturaCompenso = (prenotazione: PrenotazioneCompenso) =>
  prenotazione.stato === "eseguita" && prenotazione.fatturata;

const oscuraNomePaziente = (nome: string) =>
  nome
    .split(/(\s+)/)
    .map((parte) => {
      if (!parte.trim()) return parte;
      return `${parte[0]}${"*".repeat(Math.max(0, parte.length - 1))}`;
    })
    .join("");

const escapeCsv = (valore: string | number) => {
  const testo = String(valore ?? "");
  return /[;"\n\r]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
};

const escapeHtml = (valore: string | number) =>
  String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const scaricaBlob = (contenuto: BlobPart, nomeFile: string, type: string) => {
  const blob = new Blob([contenuto], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const normalizzaTesto = (testo: string) =>
  testo
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const stessaSpecialita = (a: string, b: string) => normalizzaTesto(a) === normalizzaTesto(b);

const slugId = (prefisso: string, valore: string, fallback = Date.now()) => {
  const slug = normalizzaTesto(valore)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefisso}-${slug || fallback}`;
};

const isSedeMedicoId = (value: unknown): value is SedeMedicoId =>
  value === "modena" || value === "sassuolo";

const isTipoRisorsaSede = (value: unknown): value is TipoRisorsaSede =>
  value === "ambulatorio" || value === "ecografo" || value === "ecg" || value === "strumento";

const normalizzaRisorsaSede = (risorsa: Partial<RisorsaSede>, index = 0): RisorsaSede => {
  const sedeId = isSedeMedicoId(risorsa.sedeId) ? risorsa.sedeId : "modena";
  const tipo = isTipoRisorsaSede(risorsa.tipo) ? risorsa.tipo : "ambulatorio";
  const tipoLabel = TIPI_RISORSA_SEDE.find((item) => item.id === tipo)?.label ?? "Risorsa";
  const nome = typeof risorsa.nome === "string" && risorsa.nome.trim()
    ? risorsa.nome.trim()
    : `${tipoLabel} ${index + 1}`;

  return {
    id: typeof risorsa.id === "string" && risorsa.id.trim()
      ? risorsa.id
      : slugId("risorsa", `${sedeId}-${tipo}-${nome}`, index),
    sedeId,
    tipo,
    nome,
    attiva: risorsa.attiva !== false,
    note: typeof risorsa.note === "string" ? risorsa.note : "",
  };
};

const copiaRisorseSedi = (risorse: RisorsaSede[]) =>
  risorse.map((risorsa, index) => normalizzaRisorsaSede(risorsa, index));

const isAdminSettingsData = (value: unknown): value is AdminSettingsData => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<AdminSettingsData>;
  return (
    Array.isArray(data.specialita) &&
    Array.isArray(data.prestazioni) &&
    Array.isArray(data.medici) &&
    Array.isArray(data.listini)
  );
};

const SPECIALITA_INIZIALI: Specialita[] = [
  { id: "cardiologia", nome: "Cardiologia", attiva: true },
  { id: "diagnostica", nome: "Diagnostica", attiva: true },
  { id: "dermatologia", nome: "Dermatologia", attiva: true },
  { id: "ortopedia", nome: "Ortopedia", attiva: true },
];

const PRESTAZIONI_INIZIALI: Prestazione[] = [
  { id: "visita-cardiologica", nome: "Visita cardiologica", specialita: "Cardiologia", durata: 30, attiva: true },
  { id: "ecografia-addome", nome: "Ecografia addome completo", specialita: "Diagnostica", durata: 40, attiva: true },
  { id: "visita-dermatologica", nome: "Visita dermatologica", specialita: "Dermatologia", durata: 25, attiva: true },
  { id: "visita-ortopedica", nome: "Visita ortopedica", specialita: "Ortopedia", durata: 30, attiva: true },
  { id: "infiltrazione-articolare", nome: "Infiltrazione articolare", specialita: "Ortopedia", durata: 20, attiva: true },
];

const CONVENTION_TEMPLATES_INIZIALI: ConventionTemplate[] = [
  {
    id: "convenzione-base",
    nome: "Convenzione base",
    descrizione: "Modello standard da applicare ad aziende e societa sportive.",
    attiva: true,
    services: [],
  },
];

const MEDICI_INIZIALI: Medico[] = [
  {
    id: "rossi",
    nome: "Dott. Marco Rossi",
    specialita: "Cardiologia",
    agendaAperta: true,
    disponibilita: ["Lun", "Mer", "Ven"],
    disponibilitaPerSede: { modena: ["Lun", "Mer"], sassuolo: ["Ven"] },
    pianoFerie: [],
  },
  {
    id: "bianchi",
    nome: "Dott.ssa Laura Bianchi",
    specialita: "Diagnostica",
    agendaAperta: true,
    disponibilita: ["Mar", "Gio"],
    disponibilitaPerSede: { modena: ["Mar"], sassuolo: ["Gio"] },
    pianoFerie: [],
  },
  {
    id: "verdi",
    nome: "Dott. Paolo Verdi",
    specialita: "Dermatologia",
    agendaAperta: true,
    disponibilita: ["Lun", "Gio"],
    disponibilitaPerSede: { modena: ["Gio"], sassuolo: ["Lun"] },
    pianoFerie: [],
  },
];

const LISTINI_INIZIALI: Listino[] = [
  { id: "l1", prestazioneId: "visita-cardiologica", medicoId: "rossi", durata: 30, prezzo: 90, compensoTipo: "percentuale", compensoValore: 40 },
  { id: "l2", prestazioneId: "ecografia-addome", medicoId: "bianchi", durata: 40, prezzo: 120, compensoTipo: "fisso", compensoValore: 45 },
  { id: "l3", prestazioneId: "visita-dermatologica", medicoId: "verdi", durata: 25, prezzo: 75, compensoTipo: "percentuale", compensoValore: 35 },
];

const PRENOTAZIONI_COMPENSI_DEMO: PrenotazioneCompenso[] = [
  { id: "pren-001", data: "2026-07-01", ora: "09:00", paziente: "Giulia Conti", medicoId: "rossi", listinoId: "l1", stato: "eseguita", fatturata: true, importoFatturato: 90, numeroFattura: "F-2026-001", dataFattura: "2026-07-01" },
  { id: "pren-002", data: "2026-07-01", ora: "09:45", paziente: "Luca Ferri", medicoId: "rossi", listinoId: "l1", stato: "eseguita", fatturata: true, importoFatturato: 80, numeroFattura: "F-2026-002", dataFattura: "2026-07-01" },
  { id: "pren-003", data: "2026-07-02", ora: "10:30", paziente: "Elena Russo", medicoId: "bianchi", listinoId: "l2", stato: "eseguita", fatturata: true, importoFatturato: 120, numeroFattura: "F-2026-003", dataFattura: "2026-07-02" },
  { id: "pren-004", data: "2026-07-04", ora: "11:15", paziente: "Paolo Greco", medicoId: "verdi", listinoId: "l3", stato: "eseguita", fatturata: false },
  { id: "pren-005", data: "2026-07-08", ora: "15:00", paziente: "Marta Gallo", medicoId: "rossi", listinoId: "l1", stato: "confermata", fatturata: false },
  { id: "pren-006", data: "2026-07-10", ora: "08:40", paziente: "Andrea Riva", medicoId: "bianchi", listinoId: "l2", stato: "eseguita", fatturata: true, importoFatturato: 120, numeroFattura: "F-2026-004", dataFattura: "2026-07-10" },
  { id: "pren-007", data: "2026-07-12", ora: "12:00", paziente: "Sara Testa", medicoId: "verdi", listinoId: "l3", stato: "annullata", fatturata: false },
  { id: "pren-008", data: "2026-07-15", ora: "16:20", paziente: "Nadia Costa", medicoId: "rossi", listinoId: "l1", stato: "confermata", fatturata: false },
  { id: "pren-009", data: "2026-07-18", ora: "09:20", paziente: "Roberto Villa", medicoId: "bianchi", listinoId: "l2", stato: "confermata", fatturata: false },
  { id: "pren-010", data: "2026-07-23", ora: "14:10", paziente: "Chiara Neri", medicoId: "verdi", listinoId: "l3", stato: "eseguita", fatturata: true, importoFatturato: 75, numeroFattura: "F-2026-005", dataFattura: "2026-07-23" },
  { id: "pren-011", data: "2026-06-28", ora: "10:00", paziente: "Marco Longo", medicoId: "rossi", listinoId: "l1", stato: "eseguita", fatturata: true, importoFatturato: 90, numeroFattura: "F-2026-000", dataFattura: "2026-06-28" },
  { id: "pren-012", data: "2026-08-03", ora: "09:30", paziente: "Anna Serra", medicoId: "bianchi", listinoId: "l2", stato: "confermata", fatturata: false },
];

const LABEL_STATO_PRENOTAZIONE: Record<StatoPrenotazioneCompenso, string> = {
  confermata: "Confermata",
  eseguita: "Eseguita",
  annullata: "Annullata",
};

const OPZIONI_EXPORT_COMPENSI_DEFAULT: OpzioniExportCompensi = {
  oscuraPazienti: true,
  mostraTotalePrenotazioni: true,
  mostraIncasso: true,
  mostraCompensi: true,
  mostraNettoStudio: true,
  separaMedici: true,
};

const colonneExportCompensi = (opzioni: OpzioniExportCompensi) => [
  "Data",
  "Ora",
  "Paziente",
  "Medico",
  "Specialita",
  "Prestazione",
  "Durata min",
  ...(opzioni.mostraIncasso ? ["Importo fatturato"] : []),
  "Tipo compenso",
  "Valore compenso",
  ...(opzioni.mostraCompensi ? ["Quota medico"] : []),
  ...(opzioni.mostraNettoStudio ? ["Netto studio"] : []),
  "Stato",
  "Fatturazione",
  "Numero fattura",
];

export function AdminSettings({
  initialTab = "prestazioni",
  initialMedicoId = null,
  focusKey = 0,
  onSaveControlChange,
}: {
  initialTab?: SettingsTabId;
  initialMedicoId?: string | null;
  focusKey?: number;
  onSaveControlChange?: (control: SettingsSaveControl) => void;
} = {}) {
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const skipInitialSettingsSaveRef = React.useRef(true);
  const lastSavedPayloadKeyRef = React.useRef("");
  const currentPayloadKeyRef = React.useRef("");
  const [settingsTab, setSettingsTab] = React.useState<SettingsTabId>(initialTab);
  const [settingsOverviewVisible, setSettingsOverviewVisible] = React.useState(!initialMedicoId);
  const [specialita, setSpecialita] = React.useState(SPECIALITA_INIZIALI);
  const [prestazioni, setPrestazioni] = React.useState(PRESTAZIONI_INIZIALI);
  const [prestazioniModificaAttiva, setPrestazioniModificaAttiva] = React.useState(false);
  const [prestazioniDraft, setPrestazioniDraft] = React.useState<Prestazione[] | null>(null);
  const [medici, setMedici] = React.useState(MEDICI_INIZIALI);
  const [listini, setListini] = React.useState(LISTINI_INIZIALI);
  const [conventionTemplates, setConventionTemplates] = React.useState(CONVENTION_TEMPLATES_INIZIALI);
  const [risorseSedi, setRisorseSedi] = React.useState(RISORSE_SEDI_INIZIALI);
  const [selectedConventionTemplateId, setSelectedConventionTemplateId] = React.useState(CONVENTION_TEMPLATES_INIZIALI[0]?.id ?? "");
  const [ricercaPrestazioniConvenzione, setRicercaPrestazioniConvenzione] = React.useState("");
  const [settingsCanSave, setSettingsCanSave] = React.useState(false);
  const [settingsSaveState, setSettingsSaveState] = React.useState<SettingsSaveState>("loading");
  const [selectedSpecialita, setSelectedSpecialita] = React.useState(SPECIALITA_INIZIALI[0]?.nome ?? "");
  const [selectedMedicoId, setSelectedMedicoId] = React.useState(MEDICI_INIZIALI[0]?.id ?? "");
  const [schedaMedicoModificaAttiva, setSchedaMedicoModificaAttiva] = React.useState(false);
  const [schedaMedicoDraft, setSchedaMedicoDraft] = React.useState<Medico | null>(null);
  const [agendaMedicoModificaAttiva, setAgendaMedicoModificaAttiva] = React.useState(false);
  const [agendaMedicoDraft, setAgendaMedicoDraft] = React.useState<AgendaMedicoDraft | null>(null);
  const [listinoMedicoModificaAttiva, setListinoMedicoModificaAttiva] = React.useState(false);
  const [listinoMedicoDraft, setListinoMedicoDraft] = React.useState<Listino[] | null>(null);
  const [nuovaSpecialita, setNuovaSpecialita] = React.useState("");
  const [nuovaPrestazioneSpecialita, setNuovaPrestazioneSpecialita] = React.useState({
    nome: "",
    durata: "30",
  });
  const [ricercaPrestazioni, setRicercaPrestazioni] = React.useState("");
  const [ricercaPrestazioniApplicata, setRicercaPrestazioniApplicata] = React.useState("");
  const [ricercaPrestazioniMedico, setRicercaPrestazioniMedico] = React.useState("");
  const [prestazioneListinoOpen, setPrestazioneListinoOpen] = React.useState(false);
  const [nuovaPrestazione, setNuovaPrestazione] = React.useState({
    nome: "",
    specialita: SPECIALITA_INIZIALI[0]?.nome ?? "",
    durata: "30",
  });
  const [nuovoMedico, setNuovoMedico] = React.useState({
    nome: "",
    specialita: SPECIALITA_INIZIALI[0]?.nome ?? "",
  });
  const [periodoCompensi, setPeriodoCompensi] = React.useState({
    dal: "2026-07-01",
    al: "2026-07-31",
  });
  const [medicoCompensiFiltro, setMedicoCompensiFiltro] = React.useState("tutti");
  const [exportCompensiOpen, setExportCompensiOpen] = React.useState(false);
  const [formatoExportCompensi, setFormatoExportCompensi] = React.useState<FormatoExportCompensi>("pdf");
  const [opzioniExportCompensi, setOpzioniExportCompensi] = React.useState(OPZIONI_EXPORT_COMPENSI_DEFAULT);
  const [medicoDaEliminareId, setMedicoDaEliminareId] = React.useState<string | null>(null);
  const [nuovoListino, setNuovoListino] = React.useState({
    prestazioneId: PRESTAZIONI_INIZIALI[0].id,
    durata: String(PRESTAZIONI_INIZIALI[0].durata),
    prezzo: "90",
    compensoTipo: "percentuale" as CompensoTipo,
    compensoValore: "40",
  });

  const mostraNotifica = (
    description: string,
    variant: "default" | "destructive" = "default",
  ) => {
    toast({
      title: variant === "destructive" ? "Attenzione" : "Notifica",
      description,
      variant,
    });
  };

  const settingsPayload = React.useMemo<AdminSettingsData>(() => ({
    specialita,
    prestazioni,
    medici,
    listini,
    conventionTemplates,
    risorseSedi,
  }), [conventionTemplates, listini, medici, prestazioni, risorseSedi, specialita]);

  const settingsPayloadKey = React.useMemo(() => JSON.stringify(settingsPayload), [settingsPayload]);

  React.useEffect(() => {
    let active = true;

    const caricaImpostazioni = async () => {
      try {
        const response = await fetch("/api/admin-settings");
        if (!response.ok) throw new Error("Impostazioni non disponibili");

        const data: unknown = await response.json();
        if (!active) return;

        if (isAdminSettingsData(data)) {
          const prossimiMedici = data.medici.map(normalizzaMedico);
          const medicoRichiesto =
            initialMedicoId && prossimiMedici.some((medico) => medico.id === initialMedicoId)
              ? initialMedicoId
              : null;

          setSpecialita(data.specialita);
          setPrestazioni(data.prestazioni);
          setPrestazioniDraft(null);
          setPrestazioniModificaAttiva(false);
          setMedici(prossimiMedici);
          setListini(data.listini);
          const prossimiTemplate = Array.isArray(data.conventionTemplates)
            ? data.conventionTemplates.map((template, index) => normalizzaConventionTemplate(template, index))
            : CONVENTION_TEMPLATES_INIZIALI;
          const prossimeRisorse = Array.isArray(data.risorseSedi)
            ? data.risorseSedi.map((risorsa, index) => normalizzaRisorsaSede(risorsa, index))
            : RISORSE_SEDI_INIZIALI;
          setConventionTemplates(prossimiTemplate);
          setRisorseSedi(prossimeRisorse);
          setSelectedConventionTemplateId(prossimiTemplate[0]?.id ?? "");
          setSelectedSpecialita(data.specialita[0]?.nome ?? data.prestazioni[0]?.specialita ?? "");
          setSelectedMedicoId(medicoRichiesto ?? prossimiMedici[0]?.id ?? "");
        }

        setSettingsSaveState("saved");
        setSettingsCanSave(true);
      } catch {
        if (!active) return;
        setSettingsSaveState("error");
        mostraNotifica("Impostazioni non collegate al DB. Controlla la configurazione backend.", "destructive");
      }
    };

    void caricaImpostazioni();

    return () => {
      active = false;
    };
  }, [initialMedicoId]);

  React.useEffect(() => {
    setSettingsTab(initialTab);
    setSettingsOverviewVisible(!initialMedicoId);
    if (initialMedicoId) setSelectedMedicoId(initialMedicoId);
  }, [focusKey, initialMedicoId, initialTab]);

  React.useEffect(() => {
    if (!settingsCanSave) return;

    currentPayloadKeyRef.current = settingsPayloadKey;

    if (skipInitialSettingsSaveRef.current) {
      skipInitialSettingsSaveRef.current = false;
      lastSavedPayloadKeyRef.current = settingsPayloadKey;
      return;
    }

    if (lastSavedPayloadKeyRef.current !== settingsPayloadKey) {
      setSettingsSaveState((current) => current === "loading" ? current : "dirty");
    }
  }, [settingsCanSave, settingsPayloadKey]);

  const salvaImpostazioni = React.useCallback(async () => {
    const payload = settingsPayload;
    const payloadKey = settingsPayloadKey;
    currentPayloadKeyRef.current = payloadKey;
    setSettingsSaveState("saving");

    try {
      const response = await fetch("/api/admin-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? `Salvataggio non riuscito (HTTP ${response.status})`);
      }
      lastSavedPayloadKeyRef.current = payloadKey;
      setSettingsSaveState(currentPayloadKeyRef.current === payloadKey ? "saved" : "dirty");
      mostraNotifica("Impostazioni salvate.");
    } catch (error) {
      setSettingsSaveState("error");
      mostraNotifica(
        error instanceof Error
          ? error.message
          : "Salvataggio impostazioni non riuscito. Verifica che il backend sia configurato e raggiungibile.",
        "destructive",
      );
    }
  }, [settingsPayload, settingsPayloadKey]);

  React.useEffect(() => {
    onSaveControlChange?.({
      state: settingsSaveState,
      canSave: settingsTab !== "log" && (settingsSaveState === "dirty" || settingsSaveState === "error"),
      onSave: () => void salvaImpostazioni(),
    });
  }, [onSaveControlChange, salvaImpostazioni, settingsSaveState, settingsTab]);

  React.useEffect(() => {
    setSchedaMedicoModificaAttiva(false);
    setSchedaMedicoDraft(null);
    setAgendaMedicoModificaAttiva(false);
    setAgendaMedicoDraft(null);
    setListinoMedicoModificaAttiva(false);
    setListinoMedicoDraft(null);
    setPrestazioneListinoOpen(false);
  }, [selectedMedicoId]);

  const specialitaDisponibili = React.useMemo(() => {
    const nomi = new Map<string, string>();
    [...specialita.map((item) => item.nome), ...prestazioni.map((item) => item.specialita), ...medici.map((item) => item.specialita)]
      .filter(Boolean)
      .forEach((nome) => {
        const chiave = normalizzaTesto(nome);
        if (!nomi.has(chiave)) nomi.set(chiave, nome);
      });

    return Array.from(nomi.values()).sort((a, b) => a.localeCompare(b, "it"));
  }, [specialita, prestazioni, medici]);

  const filtraPrestazioni = React.useCallback((lista: Prestazione[], ricerca: string) => {
    const query = normalizzaTesto(ricerca);
    if (!query) return lista;

    return lista.filter((prestazione) =>
      [prestazione.nome, prestazione.specialita].some((campo) => normalizzaTesto(campo).includes(query)),
    );
  }, []);

  const prestazioniInGestione = React.useMemo(
    () => (prestazioniModificaAttiva ? prestazioniDraft ?? prestazioni : prestazioni),
    [prestazioni, prestazioniDraft, prestazioniModificaAttiva],
  );

  const prestazioniFiltrate = React.useMemo(
    () => filtraPrestazioni(prestazioniInGestione, ricercaPrestazioniApplicata),
    [filtraPrestazioni, prestazioniInGestione, ricercaPrestazioniApplicata],
  );

  const prestazioniSpecialita = React.useMemo(
    () => prestazioniInGestione.filter((prestazione) => stessaSpecialita(prestazione.specialita, selectedSpecialita)),
    [prestazioniInGestione, selectedSpecialita],
  );

  const conventionTemplateSelezionato =
    conventionTemplates.find((template) => template.id === selectedConventionTemplateId) ?? conventionTemplates[0] ?? null;

  const prestazioniDisponibiliConvenzioneBase = React.useMemo(() => {
    const selectedIds = new Set(conventionTemplateSelezionato?.services.map((service) => service.prestazioneId) ?? []);
    return filtraPrestazioni(
      prestazioni.filter((prestazione) => prestazione.attiva && !selectedIds.has(prestazione.id)),
      ricercaPrestazioniConvenzione,
    ).slice(0, 12);
  }, [conventionTemplateSelezionato, filtraPrestazioni, prestazioni, ricercaPrestazioniConvenzione]);

  const medicoSelezionato = medici.find((medico) => medico.id === selectedMedicoId) ?? medici[0];
  const medicoSchedaInGestione =
    schedaMedicoModificaAttiva && schedaMedicoDraft ? schedaMedicoDraft : medicoSelezionato;
  const medicoDaEliminare = medici.find((medico) => medico.id === medicoDaEliminareId) ?? null;
  const fasceDisponibilitaPerSedeMedicoSelezionato = medicoSelezionato
    ? normalizzaFasceDisponibilitaPerSede(medicoSelezionato)
    : creaFasceDisponibilitaPerSedeVuota();
  const eccezioniAgendaMedicoSelezionato = medicoSelezionato ? normalizzaEccezioniAgenda(medicoSelezionato) : [];
  const pianoFerieMedicoSelezionato = medicoSelezionato ? normalizzaPianoFerie(medicoSelezionato) : [];
  const agendaMedicoInGestione: AgendaMedicoDraft =
    agendaMedicoModificaAttiva && agendaMedicoDraft
      ? agendaMedicoDraft
      : {
          fasceDisponibilitaPerSede: fasceDisponibilitaPerSedeMedicoSelezionato,
          eccezioniAgenda: eccezioniAgendaMedicoSelezionato,
          pianoFerie: pianoFerieMedicoSelezionato,
        };
  const datiFatturazioneMedicoSelezionato: DatiFatturazioneMedico = {
    ...DATI_FATTURAZIONE_MEDICO_VUOTI,
    ...medicoSchedaInGestione?.datiFatturazione,
  };

  const prestazioniDelMedico = React.useMemo(() => {
    if (!medicoSelezionato) return [];

    return prestazioni.filter(
      (prestazione) =>
        prestazione.attiva && stessaSpecialita(prestazione.specialita, medicoSelezionato.specialita),
    );
  }, [medicoSelezionato, prestazioni]);

  const listinoMedicoSalvato = React.useMemo(
    () =>
      medicoSelezionato
        ? listini.filter(
            (listino) =>
              listino.medicoId === medicoSelezionato.id &&
              prestazioniDelMedico.some((prestazione) => prestazione.id === listino.prestazioneId),
          )
        : [],
    [listini, medicoSelezionato, prestazioniDelMedico],
  );

  const listinoMedico = React.useMemo(
    () => (listinoMedicoModificaAttiva ? listinoMedicoDraft ?? listinoMedicoSalvato : listinoMedicoSalvato),
    [listinoMedicoDraft, listinoMedicoModificaAttiva, listinoMedicoSalvato],
  );

  const prestazioniDisponibiliListino = React.useMemo(() => {
    const prestazioniGiaInListino = new Set(listinoMedico.map((listino) => listino.prestazioneId));
    return prestazioniDelMedico.filter((prestazione) => !prestazioniGiaInListino.has(prestazione.id));
  }, [listinoMedico, prestazioniDelMedico]);

  const prestazioniDisponibiliListinoFiltrate = React.useMemo(
    () => filtraPrestazioni(prestazioniDisponibiliListino, ricercaPrestazioniMedico),
    [filtraPrestazioni, prestazioniDisponibiliListino, ricercaPrestazioniMedico],
  );

  const prestazioneNuovoListino = prestazioniDisponibiliListino.find(
    (prestazione) => prestazione.id === nuovoListino.prestazioneId,
  );

  React.useEffect(() => {
    const primaPrestazione = prestazioniDisponibiliListino[0];

    const prestazioneAncoraValida = prestazioniDisponibiliListino.some(
      (prestazione) => prestazione.id === nuovoListino.prestazioneId,
    );

    if (!primaPrestazione) {
      if (nuovoListino.prestazioneId) {
        setNuovoListino((corrente) => ({
          ...corrente,
          prestazioneId: "",
          durata: "30",
        }));
      }
      return;
    }

    if (!prestazioneAncoraValida) {
      setNuovoListino((corrente) => ({
        ...corrente,
        prestazioneId: primaPrestazione.id,
        durata: String(primaPrestazione.durata),
      }));
    }
  }, [nuovoListino.prestazioneId, prestazioniDisponibiliListino]);

  const applicaRicercaPrestazioni = () => {
    setRicercaPrestazioniApplicata(ricercaPrestazioni.trim());
  };

  const aggiornaConventionTemplate = <K extends keyof ConventionTemplate>(
    id: string,
    key: K,
    value: ConventionTemplate[K],
  ) => {
    setConventionTemplates((correnti) =>
      correnti.map((template) => template.id === id ? { ...template, [key]: value } : template),
    );
  };

  const aggiungiConventionTemplate = () => {
    const nuovo: ConventionTemplate = {
      id: slugId("convenzione-base", `Convenzione base ${conventionTemplates.length + 1}`),
      nome: conventionTemplates.length === 0 ? "Convenzione base" : `Convenzione base ${conventionTemplates.length + 1}`,
      descrizione: "",
      attiva: true,
      services: [],
    };
    setConventionTemplates((correnti) => [...correnti, nuovo]);
    setSelectedConventionTemplateId(nuovo.id);
  };

  const eliminaConventionTemplate = (id: string) => {
    setConventionTemplates((correnti) => {
      const prossimi = correnti.filter((template) => template.id !== id);
      if (selectedConventionTemplateId === id) {
        setSelectedConventionTemplateId(prossimi[0]?.id ?? "");
      }
      return prossimi;
    });
  };

  const aggiungiPrestazioneAConvenzioneBase = (prestazione: Prestazione) => {
    if (!conventionTemplateSelezionato) return;
    const service: ConventionTemplateService = {
      id: prestazione.id,
      prestazioneId: prestazione.id,
      nome: prestazione.nome,
      specialita: prestazione.specialita,
      durata: prestazione.durata,
      pricingMode: "fixed",
      discountPercent: 0,
      prezzo: 0,
    };
    setConventionTemplates((correnti) =>
      correnti.map((template) =>
        template.id === conventionTemplateSelezionato.id
          ? { ...template, services: [...template.services, service] }
          : template,
      ),
    );
    setRicercaPrestazioniConvenzione("");
  };

  const aggiornaPrestazioneConvenzioneBase = <K extends keyof ConventionTemplateService>(
    serviceId: string,
    key: K,
    value: ConventionTemplateService[K],
  ) => {
    if (!conventionTemplateSelezionato) return;
    setConventionTemplates((correnti) =>
      correnti.map((template) =>
        template.id === conventionTemplateSelezionato.id
          ? {
              ...template,
              services: template.services.map((service) =>
                service.id === serviceId ? { ...service, [key]: value } : service,
              ),
            }
          : template,
      ),
    );
  };

  const rimuoviPrestazioneConvenzioneBase = (serviceId: string) => {
    if (!conventionTemplateSelezionato) return;
    setConventionTemplates((correnti) =>
      correnti.map((template) =>
        template.id === conventionTemplateSelezionato.id
          ? { ...template, services: template.services.filter((service) => service.id !== serviceId) }
          : template,
      ),
    );
  };

  const avvisaPrestazioniBloccate = () => {
    mostraNotifica("Premi Modifica prestazioni prima di cambiare l'elenco.");
  };

  const aggiornaPrestazioniDraft = (updater: (correnti: Prestazione[]) => Prestazione[]) => {
    if (!prestazioniModificaAttiva) {
      avvisaPrestazioniBloccate();
      return;
    }

    setPrestazioniDraft((correnti) => updater(correnti ?? copiaPrestazioni(prestazioni)));
  };

  const sbloccaModificaPrestazioni = () => {
    setPrestazioniDraft(copiaPrestazioni(prestazioni));
    setPrestazioniModificaAttiva(true);
  };

  const annullaModificaPrestazioni = () => {
    setPrestazioniDraft(null);
    setPrestazioniModificaAttiva(false);
    mostraNotifica("Modifiche prestazioni annullate.");
  };

  const salvaModificaPrestazioni = () => {
    if (!prestazioniModificaAttiva) return;

    const prossimePrestazioni = prestazioniDraft ?? prestazioni;
    const prestazioniIds = new Set(prossimePrestazioni.map((prestazione) => prestazione.id));

    setPrestazioni(prossimePrestazioni);
    setListini((correnti) => correnti.filter((listino) => prestazioniIds.has(listino.prestazioneId)));
    setPrestazioniDraft(null);
    setPrestazioniModificaAttiva(false);
    mostraNotifica("Modifiche prestazioni salvate.");
  };

  const aggiungiSpecialita = () => {
    const nome = nuovaSpecialita.trim();
    if (!nome) return;
    if (!prestazioniModificaAttiva) {
      avvisaPrestazioniBloccate();
      return;
    }

    const esisteGia = specialitaDisponibili.some((item) => stessaSpecialita(item, nome));
    if (!esisteGia) {
      setSpecialita((correnti) => [
        ...correnti,
        { id: `specialita-${Date.now()}`, nome, attiva: true },
      ]);
    }

    setSelectedSpecialita(nome);
    setNuovaPrestazione((corrente) => ({ ...corrente, specialita: nome }));
    setNuovoMedico((corrente) => ({ ...corrente, specialita: nome }));
    setNuovaSpecialita("");
  };

  const aggiungiPrestazioneASpecialita = () => {
    const nome = nuovaPrestazioneSpecialita.nome.trim();
    if (!nome || !selectedSpecialita) return;
    if (!prestazioniModificaAttiva) {
      avvisaPrestazioniBloccate();
      return;
    }

    aggiornaPrestazioniDraft((correnti) => [
      ...correnti,
      {
        id: `prestazione-${Date.now()}`,
        nome,
        specialita: selectedSpecialita,
        durata: Number(nuovaPrestazioneSpecialita.durata) || 30,
        attiva: true,
      },
    ]);
    setNuovaPrestazioneSpecialita({ nome: "", durata: "30" });
  };

  const aggiungiPrestazione = () => {
    const nome = nuovaPrestazione.nome.trim();
    if (!nome) return;
    if (!prestazioniModificaAttiva) {
      avvisaPrestazioniBloccate();
      return;
    }

    const specialitaPrestazione = nuovaPrestazione.specialita || specialitaDisponibili[0] || "Generale";

    aggiornaPrestazioniDraft((correnti) => [
      ...correnti,
      {
        id: `prestazione-${Date.now()}`,
        nome,
        specialita: specialitaPrestazione,
        durata: Number(nuovaPrestazione.durata) || 30,
        attiva: true,
      },
    ]);
    setNuovaPrestazione((corrente) => ({ ...corrente, nome: "", durata: "30" }));
  };

  const aggiornaPrestazione = <K extends keyof Prestazione>(
    id: string,
    campo: K,
    valore: Prestazione[K],
  ) => {
    aggiornaPrestazioniDraft((correnti) =>
      correnti.map((prestazione) =>
        prestazione.id === id ? { ...prestazione, [campo]: valore } : prestazione,
      ),
    );
  };

  const eliminaPrestazione = (id: string) => {
    aggiornaPrestazioniDraft((correnti) => correnti.filter((prestazione) => prestazione.id !== id));
  };

  const avvisaSchedaMedicoBloccata = () => {
    mostraNotifica("Premi Modifica scheda prima di cambiare i dati del medico.");
  };

  const sbloccaModificaSchedaMedico = () => {
    if (!medicoSelezionato) return;
    setSchedaMedicoDraft(normalizzaMedico(medicoSelezionato));
    setSchedaMedicoModificaAttiva(true);
  };

  const annullaModificaSchedaMedico = () => {
    setSchedaMedicoDraft(null);
    setSchedaMedicoModificaAttiva(false);
    mostraNotifica("Modifiche scheda medico annullate.");
  };

  const aggiornaSchedaMedicoDraft = <K extends keyof Medico>(campo: K, valore: Medico[K]) => {
    if (!medicoSelezionato) return;
    if (!schedaMedicoModificaAttiva) {
      avvisaSchedaMedicoBloccata();
      return;
    }

    setSchedaMedicoDraft((corrente) => ({
      ...(corrente ?? normalizzaMedico(medicoSelezionato)),
      [campo]: valore,
    }));
  };

  const aggiornaDatiFatturazioneMedicoDraft = <K extends keyof DatiFatturazioneMedico>(
    campo: K,
    valore: DatiFatturazioneMedico[K],
  ) => {
    if (!medicoSelezionato) return;
    if (!schedaMedicoModificaAttiva) {
      avvisaSchedaMedicoBloccata();
      return;
    }

    setSchedaMedicoDraft((corrente) => {
      const medico = corrente ?? normalizzaMedico(medicoSelezionato);
      return {
        ...medico,
        datiFatturazione: {
          ...DATI_FATTURAZIONE_MEDICO_VUOTI,
          ...medico.datiFatturazione,
          [campo]: valore,
        },
      };
    });
  };

  const salvaModificaSchedaMedico = () => {
    if (!medicoSelezionato || !schedaMedicoDraft) return;

    const nome = schedaMedicoDraft.nome.trim() || medicoSelezionato.nome;
    const specialitaMedico = schedaMedicoDraft.specialita || medicoSelezionato.specialita || "Generale";

    setMedici((correnti) =>
      correnti.map((medico) =>
        medico.id === medicoSelezionato.id
          ? normalizzaMedico({
              ...medico,
              nome,
              specialita: specialitaMedico,
              datiFatturazione: {
                ...DATI_FATTURAZIONE_MEDICO_VUOTI,
                ...schedaMedicoDraft.datiFatturazione,
              },
            })
          : medico,
      ),
    );
    setListini((correnti) =>
      correnti.filter((listino) => {
        if (listino.medicoId !== medicoSelezionato.id) return true;
        const prestazione = prestazioni.find((item) => item.id === listino.prestazioneId);
        return prestazione ? stessaSpecialita(prestazione.specialita, specialitaMedico) : false;
      }),
    );
    setSchedaMedicoDraft(null);
    setSchedaMedicoModificaAttiva(false);
    mostraNotifica("Scheda medico salvata.");
  };

  const avvisaAgendaMedicoBloccata = () => {
    mostraNotifica("Premi Modifica agenda prima di cambiare disponibilita o eccezioni.");
  };

  const sbloccaModificaAgendaMedico = () => {
    if (!medicoSelezionato) return;
    setAgendaMedicoDraft(creaAgendaDraftDaMedico(medicoSelezionato));
    setAgendaMedicoModificaAttiva(true);
  };

  const annullaModificaAgendaMedico = () => {
    setAgendaMedicoDraft(null);
    setAgendaMedicoModificaAttiva(false);
    mostraNotifica("Modifiche agenda medico annullate.");
  };

  const aggiornaAgendaMedicoDraft = (updater: (corrente: AgendaMedicoDraft) => AgendaMedicoDraft) => {
    if (!medicoSelezionato) return;
    if (!agendaMedicoModificaAttiva) {
      avvisaAgendaMedicoBloccata();
      return;
    }

    setAgendaMedicoDraft((corrente) => updater(corrente ?? creaAgendaDraftDaMedico(medicoSelezionato)));
  };

  const aggiungiFasciaDisponibilita = (sedeId: SedeMedicoId) => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      fasceDisponibilitaPerSede: {
        ...corrente.fasceDisponibilitaPerSede,
        [sedeId]: [...corrente.fasceDisponibilitaPerSede[sedeId], creaFasciaDisponibilita()],
      },
    }));
  };

  const aggiornaFasciaDisponibilita = <K extends keyof FasciaDisponibilita>(
    sedeId: SedeMedicoId,
    fasciaId: string,
    campo: K,
    valore: FasciaDisponibilita[K],
  ) => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      fasceDisponibilitaPerSede: {
        ...corrente.fasceDisponibilitaPerSede,
        [sedeId]: corrente.fasceDisponibilitaPerSede[sedeId].map((fascia) =>
          fascia.id === fasciaId ? { ...fascia, [campo]: valore } : fascia,
        ),
      },
    }));
  };

  const eliminaFasciaDisponibilita = (sedeId: SedeMedicoId, fasciaId: string) => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      fasceDisponibilitaPerSede: {
        ...corrente.fasceDisponibilitaPerSede,
        [sedeId]: corrente.fasceDisponibilitaPerSede[sedeId].filter((fascia) => fascia.id !== fasciaId),
      },
    }));
  };

  const aggiungiEccezioneAgenda = () => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      eccezioniAgenda: [...corrente.eccezioniAgenda, creaEccezioneAgenda()],
    }));
  };

  const aggiornaEccezioneAgenda = <K extends keyof EccezioneAgendaMedico>(
    eccezioneId: string,
    campo: K,
    valore: EccezioneAgendaMedico[K],
  ) => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      eccezioniAgenda: corrente.eccezioniAgenda.map((eccezione) =>
        eccezione.id === eccezioneId ? { ...eccezione, [campo]: valore } : eccezione,
      ),
    }));
  };

  const eliminaEccezioneAgenda = (eccezioneId: string) => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      eccezioniAgenda: corrente.eccezioniAgenda.filter((eccezione) => eccezione.id !== eccezioneId),
    }));
  };

  const aggiungiFerieMedico = () => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      pianoFerie: [...corrente.pianoFerie, creaPianoFerieMedico()],
    }));
  };

  const aggiornaFerieMedico = <K extends keyof PianoFerieMedico>(
    ferieId: string,
    campo: K,
    valore: PianoFerieMedico[K],
  ) => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      pianoFerie: corrente.pianoFerie.map((ferie) =>
        ferie.id === ferieId ? normalizzaPianoFerieMedico({ ...ferie, [campo]: valore }) : ferie,
      ),
    }));
  };

  const eliminaFerieMedico = (ferieId: string) => {
    aggiornaAgendaMedicoDraft((corrente) => ({
      ...corrente,
      pianoFerie: corrente.pianoFerie.filter((ferie) => ferie.id !== ferieId),
    }));
  };

  const salvaModificaAgendaMedico = () => {
    if (!medicoSelezionato || !agendaMedicoDraft) return;

    const fasceDisponibilitaPerSede = copiaFasceDisponibilitaPerSede(agendaMedicoDraft.fasceDisponibilitaPerSede);
    const disponibilitaPerSede = disponibilitaSediDaFasce(fasceDisponibilitaPerSede);
    const eccezioniAgenda = agendaMedicoDraft.eccezioniAgenda
      .filter((eccezione) => eccezione.data && eccezione.dalle && eccezione.alle)
      .map((eccezione, index) => normalizzaEccezioneAgenda(eccezione, index));
    const pianoFerie = agendaMedicoDraft.pianoFerie
      .filter((ferie) => ferie.dal && ferie.al)
      .map((ferie, index) => normalizzaPianoFerieMedico(ferie, index));

    setMedici((correnti) =>
      correnti.map((medico) =>
        medico.id === medicoSelezionato.id
          ? normalizzaMedico({
              ...medico,
              agendaAperta: true,
              disponibilita: unisciDisponibilitaSedi(disponibilitaPerSede),
              disponibilitaPerSede,
              fasceDisponibilitaPerSede,
              eccezioniAgenda,
              pianoFerie,
            })
          : medico,
      ),
    );
    setAgendaMedicoDraft(null);
    setAgendaMedicoModificaAttiva(false);
    mostraNotifica("Agenda medico salvata.");
  };

  const aggiungiMedico = () => {
    const nome = nuovoMedico.nome.trim();
    if (!nome) return;
    const id = `medico-${Date.now()}`;
    const specialitaMedico = nuovoMedico.specialita || specialitaDisponibili[0] || "Generale";

    setMedici((correnti) => [
      ...correnti,
      {
        id,
        nome,
        specialita: specialitaMedico,
        agendaAperta: true,
        disponibilita: [],
        disponibilitaPerSede: creaDisponibilitaPerSedeVuota(),
        fasceDisponibilitaPerSede: creaFasceDisponibilitaPerSedeVuota(),
        eccezioniAgenda: [],
        pianoFerie: [],
        datiFatturazione: { ...DATI_FATTURAZIONE_MEDICO_VUOTI },
      },
    ]);
    setSelectedMedicoId(id);
    setNuovoMedico((corrente) => ({ ...corrente, nome: "" }));
  };

  const eliminaMedico = () => {
    if (!medicoDaEliminare) return;

    const medicoId = medicoDaEliminare.id;
    const prossimiMedici = medici.filter((medico) => medico.id !== medicoId);

    setMedici(prossimiMedici.map(normalizzaMedico));
    setListini((correnti) => correnti.filter((listino) => listino.medicoId !== medicoId));
    setSelectedMedicoId((corrente) =>
      corrente === medicoId ? prossimiMedici[0]?.id ?? "" : corrente,
    );
    setMedicoCompensiFiltro((corrente) => (corrente === medicoId ? "tutti" : corrente));
    setMedicoDaEliminareId(null);
    mostraNotifica(`${medicoDaEliminare.nome} eliminato.`);
  };

  const aggiornaMedico = <K extends keyof Medico>(
    id: string,
    campo: K,
    valore: Medico[K],
  ) => {
    if (id === medicoSelezionato?.id && campo !== "agendaAperta") {
      aggiornaSchedaMedicoDraft(campo, valore);
      return;
    }

    setMedici((correnti) =>
      correnti.map((medico) => (medico.id === id ? { ...medico, [campo]: valore } : medico)),
    );
  };

  const aggiornaSpecialitaMedico = (id: string, nuovaSpecialitaMedico: string) => {
    if (id === medicoSelezionato?.id) {
      aggiornaSchedaMedicoDraft("specialita", nuovaSpecialitaMedico);
      return;
    }

    aggiornaMedico(id, "specialita", nuovaSpecialitaMedico);
    setListini((correnti) =>
      correnti.filter((listino) => {
        if (listino.medicoId !== id) return true;
        const prestazione = prestazioni.find((item) => item.id === listino.prestazioneId);
        return prestazione ? stessaSpecialita(prestazione.specialita, nuovaSpecialitaMedico) : false;
      }),
    );
  };

  const aggiornaDatiFatturazioneMedico = <K extends keyof DatiFatturazioneMedico>(
    id: string,
    campo: K,
    valore: DatiFatturazioneMedico[K],
  ) => {
    if (id === medicoSelezionato?.id) {
      aggiornaDatiFatturazioneMedicoDraft(campo, valore);
      return;
    }

    setMedici((correnti) =>
      correnti.map((medico) =>
        medico.id === id
          ? {
              ...medico,
              datiFatturazione: {
                ...DATI_FATTURAZIONE_MEDICO_VUOTI,
                ...medico.datiFatturazione,
                [campo]: valore,
              },
            }
          : medico,
      ),
    );
  };

  const creaListinoDraftDaMedico = (medicoId: string) =>
    listini.filter((listino) => listino.medicoId === medicoId).map((listino) => ({ ...listino }));

  const avvisaListinoMedicoBloccato = () => {
    mostraNotifica("Premi Modifica listino prima di cambiare prezzi o compensi.");
  };

  const sbloccaModificaListinoMedico = () => {
    if (!medicoSelezionato) return;
    setListinoMedicoDraft(creaListinoDraftDaMedico(medicoSelezionato.id));
    setListinoMedicoModificaAttiva(true);
  };

  const annullaModificaListinoMedico = () => {
    setListinoMedicoDraft(null);
    setListinoMedicoModificaAttiva(false);
    mostraNotifica("Modifiche listino annullate.");
  };

  const aggiornaListinoMedicoDraft = (updater: (corrente: Listino[]) => Listino[]) => {
    if (!medicoSelezionato) return;
    if (!listinoMedicoModificaAttiva) {
      avvisaListinoMedicoBloccato();
      return;
    }

    setListinoMedicoDraft((corrente) => updater(corrente ?? creaListinoDraftDaMedico(medicoSelezionato.id)));
  };

  const salvaModificaListinoMedico = () => {
    if (!medicoSelezionato) return;

    const righeListino = (listinoMedicoDraft ?? []).map((listino) => ({
      ...listino,
      medicoId: medicoSelezionato.id,
      durata: Math.max(5, listino.durata || 5),
      prezzo: Math.max(0, listino.prezzo || 0),
      compensoValore:
        listino.compensoTipo === "percentuale"
          ? limitaPercentuale(listino.compensoValore || 0)
          : Math.max(0, listino.compensoValore || 0),
    }));

    setListini((correnti) => [
      ...correnti.filter((listino) => listino.medicoId !== medicoSelezionato.id),
      ...righeListino,
    ]);
    setListinoMedicoDraft(null);
    setListinoMedicoModificaAttiva(false);
    mostraNotifica("Listino medico salvato.");
  };

  const aggiungiListino = () => {
    if (!listinoMedicoModificaAttiva) {
      avvisaListinoMedicoBloccato();
      return;
    }

    const medicoId = medicoSelezionato?.id;
    const prezzo = Number(nuovoListino.prezzo);
    const durata = Number(nuovoListino.durata);
    const compensoValoreRaw = Number(nuovoListino.compensoValore);
    const compensoValore =
      nuovoListino.compensoTipo === "percentuale"
        ? limitaPercentuale(compensoValoreRaw || 0)
        : Math.max(0, compensoValoreRaw || 0);
    const prestazioneCompatibile = prestazioniDisponibiliListino.some(
      (prestazione) => prestazione.id === nuovoListino.prestazioneId,
    );

    if (
      !medicoId ||
      !prestazioneCompatibile ||
      !Number.isFinite(prezzo) ||
      prezzo <= 0 ||
      !Number.isFinite(durata) ||
      durata <= 0 ||
      !Number.isFinite(compensoValoreRaw) ||
      compensoValoreRaw < 0
    ) {
      return;
    }

    aggiornaListinoMedicoDraft((correnti) => {
      const esisteGia = correnti.some(
        (listino) => listino.medicoId === medicoId && listino.prestazioneId === nuovoListino.prestazioneId,
      );

      if (esisteGia) {
        return correnti.map((listino) =>
          listino.medicoId === medicoId && listino.prestazioneId === nuovoListino.prestazioneId
            ? { ...listino, durata, prezzo, compensoTipo: nuovoListino.compensoTipo, compensoValore }
            : listino,
        );
      }

      return [
        ...correnti,
        {
          id: `listino-${Date.now()}`,
          prestazioneId: nuovoListino.prestazioneId,
          medicoId,
          durata,
          prezzo,
          compensoTipo: nuovoListino.compensoTipo,
          compensoValore,
        },
      ];
    });
    setRicercaPrestazioniMedico("");
    setPrestazioneListinoOpen(false);
  };

  const aggiornaDurataListino = (id: string, durata: number) => {
    aggiornaListinoMedicoDraft((correnti) =>
      correnti.map((listino) => (listino.id === id ? { ...listino, durata } : listino)),
    );
  };

  const aggiornaPrezzo = (id: string, prezzo: number) => {
    aggiornaListinoMedicoDraft((correnti) =>
      correnti.map((listino) => (listino.id === id ? { ...listino, prezzo } : listino)),
    );
  };

  const aggiornaCompensoTipo = (id: string, compensoTipo: CompensoTipo) => {
    aggiornaListinoMedicoDraft((correnti) =>
      correnti.map((listino) =>
        listino.id === id
          ? {
              ...listino,
              compensoTipo,
              compensoValore:
                compensoTipo === "percentuale"
                  ? limitaPercentuale(listino.compensoValore)
                  : Math.max(0, listino.compensoValore),
            }
          : listino,
      ),
    );
  };

  const aggiornaCompensoValore = (id: string, valore: number) => {
    aggiornaListinoMedicoDraft((correnti) =>
      correnti.map((listino) =>
        listino.id === id
          ? {
              ...listino,
              compensoValore:
                listino.compensoTipo === "percentuale"
                  ? limitaPercentuale(valore)
                  : Math.max(0, valore),
            }
          : listino,
      ),
    );
  };

  const eliminaListino = (id: string) => {
    aggiornaListinoMedicoDraft((correnti) => correnti.filter((listino) => listino.id !== id));
  };

  const nomePrestazione = (id: string) =>
    prestazioni.find((prestazione) => prestazione.id === id)?.nome ?? "Prestazione";

  const durataPrestazione = (id: string) =>
    prestazioni.find((prestazione) => prestazione.id === id)?.durata ?? 30;

  const quotaMedico = (listino: Listino) =>
    listino.compensoTipo === "percentuale"
      ? (listino.prezzo * listino.compensoValore) / 100
      : listino.compensoValore;

  const quotaMedicoSuIncasso = (listino: Listino, incasso: number) =>
    listino.compensoTipo === "percentuale"
      ? (incasso * listino.compensoValore) / 100
      : listino.compensoValore;

  const nettoStudio = (listino: Listino) => listino.prezzo - quotaMedico(listino);

  const prenotazioniPeriodoCompensi = React.useMemo<PrenotazioneCalcolata[]>(() => {
    const dal = periodoCompensi.dal || "0000-01-01";
    const al = periodoCompensi.al || "9999-12-31";
    const inizio = dal <= al ? dal : al;
    const fine = dal <= al ? al : dal;

    return PRENOTAZIONI_COMPENSI_DEMO.map((prenotazione) => {
      const medico = medici.find((item) => item.id === prenotazione.medicoId);
      const listino = listini.find((item) => item.id === prenotazione.listinoId);
      const prestazione = listino
        ? prestazioni.find((item) => item.id === listino.prestazioneId)
        : undefined;

      if (!medico || !listino || !prestazione) return null;

      const incasso = prenotazione.fatturata ? prenotazione.importoFatturato ?? listino.prezzo : 0;
      const quota = quotaMedicoSuIncasso(listino, incasso);

      return {
        prenotazione,
        medico,
        listino,
        prestazione,
        incasso,
        quota,
        netto: incasso - quota,
      };
    })
      .filter((item): item is PrenotazioneCalcolata => Boolean(item))
      .filter(({ prenotazione, medico }) => {
        const nelPeriodo = prenotazione.data >= inizio && prenotazione.data <= fine;
        const medicoIncluso = medicoCompensiFiltro === "tutti" || medico.id === medicoCompensiFiltro;
        return nelPeriodo && medicoIncluso && prenotazione.stato !== "annullata";
      })
      .sort((a, b) => `${a.prenotazione.data}${a.prenotazione.ora}`.localeCompare(`${b.prenotazione.data}${b.prenotazione.ora}`));
  }, [listini, medici, medicoCompensiFiltro, periodoCompensi.al, periodoCompensi.dal, prestazioni]);

  const prenotazioniCompensi = React.useMemo(
    () => prenotazioniPeriodoCompensi.filter(({ prenotazione }) => prenotazioneMaturaCompenso(prenotazione)),
    [prenotazioniPeriodoCompensi],
  );

  const prenotazioniEscluseDaiCompensi = React.useMemo(
    () => prenotazioniPeriodoCompensi.filter(({ prenotazione }) => !prenotazioneMaturaCompenso(prenotazione)),
    [prenotazioniPeriodoCompensi],
  );

  const riepilogoCompensiMedici = React.useMemo(() => {
    const righe = new Map<
      string,
      {
        medico: Medico;
        prenotazioni: number;
        minuti: number;
        incasso: number;
        compenso: number;
        netto: number;
      }
    >();

    prenotazioniCompensi.forEach(({ medico, listino, incasso, quota, netto }) => {
      const corrente =
        righe.get(medico.id) ??
        {
          medico,
          prenotazioni: 0,
          minuti: 0,
          incasso: 0,
          compenso: 0,
          netto: 0,
        };

      corrente.prenotazioni += 1;
      corrente.minuti += listino.durata;
      corrente.incasso += incasso;
      corrente.compenso += quota;
      corrente.netto += netto;
      righe.set(medico.id, corrente);
    });

    return Array.from(righe.values()).sort((a, b) => a.medico.nome.localeCompare(b.medico.nome, "it"));
  }, [prenotazioniCompensi]);

  const calcolaTotaliCompensi = (righe: PrenotazioneCalcolata[]) =>
    righe.reduce(
      (totali, { listino, incasso, quota, netto }) => ({
        prenotazioni: totali.prenotazioni + 1,
        minuti: totali.minuti + listino.durata,
        incasso: totali.incasso + incasso,
        compenso: totali.compenso + quota,
        netto: totali.netto + netto,
      }),
      { prenotazioni: 0, minuti: 0, incasso: 0, compenso: 0, netto: 0 },
    );

  const totaliCompensi = React.useMemo(
    () => calcolaTotaliCompensi(prenotazioniCompensi),
    [prenotazioniCompensi],
  );

  const mostraRiepilogoExport =
    opzioniExportCompensi.mostraTotalePrenotazioni ||
    opzioniExportCompensi.mostraIncasso ||
    opzioniExportCompensi.mostraCompensi ||
    opzioniExportCompensi.mostraNettoStudio;

  const aggiornaOpzioneExportCompensi = <K extends keyof OpzioniExportCompensi>(
    campo: K,
    valore: OpzioniExportCompensi[K],
  ) => {
    setOpzioniExportCompensi((correnti) => ({ ...correnti, [campo]: valore }));
  };

  const nomeFileCompensi = (estensione: string, gruppo?: string) => {
    const medico = medici.find((item) => item.id === medicoCompensiFiltro);
    const medicoSlug = gruppo
      ? slugId("medico", gruppo)
      : medico
        ? slugId("medico", medico.nome)
        : "tutti-medici";
    const privacy = opzioniExportCompensi.oscuraPazienti ? "pazienti-oscurati" : "pazienti-visibili";
    return `m-medical-compensi-${periodoCompensi.dal || "inizio"}-${periodoCompensi.al || "fine"}-${medicoSlug}-${privacy}.${estensione}`;
  };

  const costruisciGruppiExportCompensi = (): GruppoExportCompensi[] => {
    const separaMedici = opzioniExportCompensi.separaMedici && medicoCompensiFiltro === "tutti";
    if (!separaMedici) {
      const medico = medici.find((item) => item.id === medicoCompensiFiltro);
      return [
        {
          id: medico?.id ?? "tutti",
          nome: medico?.nome ?? "Tutti i medici",
          righe: prenotazioniCompensi,
        },
      ];
    }

    const gruppi = new Map<string, GruppoExportCompensi>();
    prenotazioniCompensi.forEach((riga) => {
      const gruppo = gruppi.get(riga.medico.id) ?? {
        id: riga.medico.id,
        nome: riga.medico.nome,
        righe: [],
      };
      gruppo.righe.push(riga);
      gruppi.set(riga.medico.id, gruppo);
    });

    return Array.from(gruppi.values()).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  };

  const costruisciRigheExportCompensi = (
    righe: PrenotazioneCalcolata[],
    opzioni: OpzioniExportCompensi,
  ): RigaExportCompenso[] =>
    righe.map(({ prenotazione, medico, prestazione, listino, incasso, quota, netto }) => {
      const riga: RigaExportCompenso = {
        Data: formattaData(prenotazione.data),
        Ora: prenotazione.ora,
        Paziente: opzioni.oscuraPazienti ? oscuraNomePaziente(prenotazione.paziente) : prenotazione.paziente,
        Medico: medico.nome,
        Specialita: medico.specialita,
        Prestazione: prestazione.nome,
        "Durata min": listino.durata,
        "Tipo compenso": listino.compensoTipo === "percentuale" ? "Percentuale" : "Fisso",
        "Valore compenso":
          listino.compensoTipo === "percentuale"
            ? `${listino.compensoValore}%`
            : formattaNumeroCsv(listino.compensoValore),
        Stato: LABEL_STATO_PRENOTAZIONE[prenotazione.stato],
        Fatturazione: prenotazione.fatturata ? "Fatturata" : "Non fatturata",
        "Numero fattura": prenotazione.numeroFattura ?? "",
      };

      if (opzioni.mostraIncasso) riga["Importo fatturato"] = formattaNumeroCsv(incasso);
      if (opzioni.mostraCompensi) riga["Quota medico"] = formattaNumeroCsv(quota);
      if (opzioni.mostraNettoStudio) riga["Netto studio"] = formattaNumeroCsv(netto);

      return riga;
    });

  const costruisciRigheRiepilogoExport = (gruppi: GruppoExportCompensi[]) =>
    gruppi.map((gruppo) => {
      const totali = calcolaTotaliCompensi(gruppo.righe);
      const riga: RigaExportCompenso = { Medico: gruppo.nome };
      if (opzioniExportCompensi.mostraTotalePrenotazioni) riga["Eseguite e fatturate"] = totali.prenotazioni;
      if (opzioniExportCompensi.mostraIncasso) riga["Incasso/Fatturato"] = formattaNumeroCsv(totali.incasso);
      if (opzioniExportCompensi.mostraCompensi) riga["Compensi medici"] = formattaNumeroCsv(totali.compenso);
      if (opzioniExportCompensi.mostraNettoStudio) riga["Netto studio"] = formattaNumeroCsv(totali.netto);
      return riga;
    });

  const esportaDettaglioCompensiCsv = () => {
    if (prenotazioniCompensi.length === 0) {
      mostraNotifica(
        "Nessuna prestazione eseguita e fatturata da esportare con il filtro corrente.",
        "destructive",
      );
      return;
    }

    const gruppi = costruisciGruppiExportCompensi();
    const colonne = colonneExportCompensi(opzioniExportCompensi);
    gruppi.forEach((gruppo) => {
      const righe = costruisciRigheExportCompensi(gruppo.righe, opzioniExportCompensi);
      const righeRiepilogo = mostraRiepilogoExport ? costruisciRigheRiepilogoExport([gruppo]) : [];
      const csv = [
        ...(righeRiepilogo.length > 0
          ? [
              "\ufeffRiepilogo",
              Object.keys(righeRiepilogo[0]).map(escapeCsv).join(";"),
              Object.values(righeRiepilogo[0]).map(escapeCsv).join(";"),
              "",
              "Dettaglio compensi",
            ]
          : [`\ufeffDettaglio compensi`]),
        colonne.map(escapeCsv).join(";"),
        ...righe.map((riga) => colonne.map((colonna) => escapeCsv(riga[colonna] ?? "")).join(";")),
      ].join("\r\n");

      scaricaBlob(csv, nomeFileCompensi("csv", gruppi.length > 1 ? gruppo.nome : undefined), "text/csv;charset=utf-8;");
    });

    mostraNotifica(
      gruppi.length > 1 ? "CSV esportati in file separati per medico." : "CSV dettaglio compensi esportato.",
    );
  };

  const htmlRiepilogoExport = (righe: PrenotazioneCalcolata[]) => {
    if (!mostraRiepilogoExport) return "";
    const totali = calcolaTotaliCompensi(righe);
    const box = [
      opzioniExportCompensi.mostraTotalePrenotazioni
        ? `<div class="box"><div class="label">Eseguite e fatturate</div><div class="value">${totali.prenotazioni}</div></div>`
        : "",
      opzioniExportCompensi.mostraIncasso
        ? `<div class="box"><div class="label">Incasso/Fatturato</div><div class="value">${escapeHtml(valuta.format(totali.incasso))}</div></div>`
        : "",
      opzioniExportCompensi.mostraCompensi
        ? `<div class="box"><div class="label">Compensi medici</div><div class="value">${escapeHtml(valuta.format(totali.compenso))}</div></div>`
        : "",
      opzioniExportCompensi.mostraNettoStudio
        ? `<div class="box"><div class="label">Netto studio</div><div class="value">${escapeHtml(valuta.format(totali.netto))}</div></div>`
        : "",
    ].filter(Boolean);

    return `<div class="summary">${box.join("")}</div>`;
  };

  const esportaDettaglioCompensiPdf = () => {
    if (prenotazioniCompensi.length === 0) {
      mostraNotifica(
        "Nessuna prestazione eseguita e fatturata da esportare con il filtro corrente.",
        "destructive",
      );
      return;
    }

    const gruppi = costruisciGruppiExportCompensi();
    const colonne = colonneExportCompensi(opzioniExportCompensi);
    const finestra = window.open("", "_blank");
    if (!finestra) {
      mostraNotifica("PDF non aperto. Controlla che il browser non blocchi le finestre popup.", "destructive");
      return;
    }

    const periodo = `${periodoCompensi.dal || "inizio"} - ${periodoCompensi.al || "fine"}`;
    const privacy = opzioniExportCompensi.oscuraPazienti ? "Pazienti oscurati" : "Pazienti visibili";
    const sezioniHtml = gruppi
      .map((gruppo, index) => {
        const righe = costruisciRigheExportCompensi(gruppo.righe, opzioniExportCompensi);
        const righeHtml = righe
          .map(
            (riga) => `
              <tr>
                ${colonne.map((colonna) => `<td>${escapeHtml(riga[colonna] ?? "")}</td>`).join("")}
              </tr>
            `,
          )
          .join("");

        return `
          <section class="${index < gruppi.length - 1 ? "page" : ""}">
            <h2>${escapeHtml(gruppo.nome)}</h2>
            ${htmlRiepilogoExport(gruppo.righe)}
            <table>
              <thead>
                <tr>${colonne.map((colonna) => `<th>${escapeHtml(colonna)}</th>`).join("")}</tr>
              </thead>
              <tbody>${righeHtml}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    finestra.document.write(`
      <!doctype html>
      <html lang="it">
        <head>
          <meta charset="utf-8" />
          <title>Compensi medici ${escapeHtml(periodo)}</title>
          <style>
            @page { size: landscape; margin: 14mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #17242b; margin: 0; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            h2 { margin: 18px 0 10px; font-size: 16px; }
            .meta { color: #5b6f7a; font-size: 12px; margin-bottom: 12px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
            .box { border: 1px solid #d7e2e7; border-radius: 6px; padding: 10px; }
            .label { color: #6a7e88; font-size: 10px; text-transform: uppercase; }
            .value { font-size: 17px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #d7e2e7; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #eef5f7; color: #40535c; font-size: 9px; text-transform: uppercase; }
            tr:nth-child(even) td { background: #f8fbfc; }
            .page { break-after: page; page-break-after: always; }
          </style>
        </head>
        <body>
          <h1>Compensi medici - dettaglio agenda</h1>
          <div class="meta">
            Periodo: ${escapeHtml(periodo)} · ${escapeHtml(privacy)}
          </div>
          ${sezioniHtml}
          <script>
            window.addEventListener("load", () => window.print());
          </script>
        </body>
      </html>
    `);
    finestra.document.close();
    finestra.focus();
    mostraNotifica(
      gruppi.length > 1 ? "PDF preparato con sezioni separate per medico." : "PDF preparato con il filtro corrente.",
    );
  };

  const apriExportCompensi = (formato: FormatoExportCompensi) => {
    setFormatoExportCompensi(formato);
    setExportCompensiOpen(true);
  };

  const confermaExportCompensi = () => {
    if (formatoExportCompensi === "pdf") esportaDettaglioCompensiPdf();
    if (formatoExportCompensi === "csv") esportaDettaglioCompensiCsv();
    setExportCompensiOpen(false);
  };

  const esportaConfigurazione = () => {
    const payload: AdminSettingsData = {
      specialita: specialita.map((item) => ({ ...item })),
      prestazioni: copiaPrestazioni(prestazioni),
      medici: medici.map(normalizzaMedico),
      listini: listini.map((item) => ({ ...item })),
      conventionTemplates: copiaConventionTemplates(conventionTemplates),
      risorseSedi: copiaRisorseSedi(risorseSedi),
    };

    scaricaBlob(
      JSON.stringify(payload, null, 2),
      `m-medical-configurazione-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json;charset=utf-8;",
    );
    mostraNotifica("Configurazione esportata in JSON.");
  };

  const importaConfigurazione = async (file: File) => {
    if (!file.name.toLocaleLowerCase("it-IT").endsWith(".json")) {
      throw new Error("Formato non supportato");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error("JSON non valido");
    }

    if (!isAdminSettingsData(parsed)) {
      throw new Error("Configurazione non valida");
    }

    const data = parsed;
    const prossimeSpecialita = data.specialita
      .filter((item) => Boolean(item?.nome))
      .map((item, index) => ({
        id: item.id || slugId("specialita", item.nome, index),
        nome: item.nome,
        attiva: item.attiva !== false,
      }));
    const prossimePrestazioni = data.prestazioni
      .filter((item) => Boolean(item?.nome))
      .map((item, index) => ({
        id: item.id || slugId("prestazione", item.nome, index),
        nome: item.nome,
        specialita: item.specialita || "Generale",
        durata: Math.max(5, Number(item.durata) || 30),
        attiva: item.attiva !== false,
      }));
    const prossimiMedici = data.medici
      .filter((item) => Boolean(item?.nome))
      .map((item, index) => normalizzaMedico({
        ...item,
        id: item.id || slugId("medico", item.nome, index),
      }));
    const prestazioneIds = new Set(prossimePrestazioni.map((item) => item.id));
    const medicoIds = new Set(prossimiMedici.map((item) => item.id));
    const prossimiListini = data.listini
      .filter((item) => medicoIds.has(item.medicoId) && prestazioneIds.has(item.prestazioneId))
      .map((item, index): Listino => {
        const compensoTipo: CompensoTipo = item.compensoTipo === "fisso" ? "fisso" : "percentuale";
        return {
          id: item.id || `listino-${index + 1}`,
          medicoId: item.medicoId,
          prestazioneId: item.prestazioneId,
          durata: Math.max(5, Number(item.durata) || 30),
          prezzo: Math.max(0, Number(item.prezzo) || 0),
          compensoTipo,
          compensoValore: compensoTipo === "fisso"
            ? Math.max(0, Number(item.compensoValore) || 0)
            : limitaPercentuale(Number(item.compensoValore) || 0),
        };
      });
    const templateInput = (data as Partial<AdminSettingsData>).conventionTemplates;
    const prossimiTemplate = Array.isArray(templateInput) && templateInput.length > 0
      ? templateInput.map((template, index) => normalizzaConventionTemplate(template, index))
      : copiaConventionTemplates(CONVENTION_TEMPLATES_INIZIALI);
    const prossimeRisorse = Array.isArray(data.risorseSedi) && data.risorseSedi.length > 0
      ? data.risorseSedi.map((risorsa, index) => normalizzaRisorsaSede(risorsa, index))
      : copiaRisorseSedi(RISORSE_SEDI_INIZIALI);

    setSpecialita(prossimeSpecialita);
    setPrestazioni(prossimePrestazioni);
    setMedici(prossimiMedici);
    setListini(prossimiListini);
    setConventionTemplates(prossimiTemplate);
    setRisorseSedi(prossimeRisorse);
    setSelectedConventionTemplateId(prossimiTemplate[0]?.id ?? "");
    setSelectedSpecialita(prossimeSpecialita[0]?.nome ?? prossimePrestazioni[0]?.specialita ?? "");
    setSelectedMedicoId(prossimiMedici[0]?.id ?? "");
    mostraNotifica(
      `Import completato: ${prossimiMedici.length} medici, ${prossimePrestazioni.length} prestazioni, ${prossimiListini.length} listini, ${prossimiTemplate.length} convenzioni, ${prossimeRisorse.length} risorse.`,
    );
  };

  const apriImportConfigurazione = () => importInputRef.current?.click();

  const gestisciImportConfigurazione = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importaConfigurazione(file);
    } catch {
      mostraNotifica("Import non riuscito. Controlla il formato del file JSON.", "destructive");
    } finally {
      event.target.value = "";
    }
  };

  const settingsBadgeLabel: Record<SettingsSaveState, string> = {
    loading: "Caricamento DB",
    dirty: "Modifiche da salvare",
    saving: "Salvataggio...",
    saved: "DB collegato",
    error: "Errore salvataggio",
  };

  const settingsBadgeClass =
    settingsSaveState === "error"
      ? "w-fit border-red-200 bg-red-100 text-red-700 hover:bg-red-100"
      : settingsSaveState === "dirty"
        ? "w-fit border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-100"
      : settingsSaveState === "saved"
        ? "w-fit border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
        : "w-fit border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100";

  const risorseSediOrdinate = React.useMemo(
    () =>
      copiaRisorseSedi(risorseSedi).sort((a, b) => {
        const sedeDiff =
          SEDI_MEDICO.findIndex((sedeItem) => sedeItem.id === a.sedeId) -
          SEDI_MEDICO.findIndex((sedeItem) => sedeItem.id === b.sedeId);
        if (sedeDiff !== 0) return sedeDiff;

        const tipoDiff =
          TIPI_RISORSA_SEDE.findIndex((tipo) => tipo.id === a.tipo) -
          TIPI_RISORSA_SEDE.findIndex((tipo) => tipo.id === b.tipo);
        if (tipoDiff !== 0) return tipoDiff;

        return a.nome.localeCompare(b.nome, "it", { numeric: true });
      }),
    [risorseSedi],
  );

  const labelTipoRisorsa = (tipo: TipoRisorsaSede) =>
    TIPI_RISORSA_SEDE.find((item) => item.id === tipo)?.label ?? tipo;

  const contaRisorseSede = (sedeId: SedeMedicoId, tipo: TipoRisorsaSede) =>
    risorseSedi.filter((risorsa) => risorsa.sedeId === sedeId && risorsa.tipo === tipo && risorsa.attiva).length;

  const contaStrumentiSede = (sedeId: SedeMedicoId) =>
    risorseSedi.filter((risorsa) => risorsa.sedeId === sedeId && risorsa.tipo !== "ambulatorio" && risorsa.attiva).length;

  const aggiungiRisorsaSede = (sedeId: SedeMedicoId, tipo: TipoRisorsaSede) => {
    const numero = risorseSedi.filter((risorsa) => risorsa.sedeId === sedeId && risorsa.tipo === tipo).length + 1;
    const nomeBase = tipo === "strumento" ? "Strumento" : labelTipoRisorsa(tipo);
    setRisorseSedi((correnti) => [
      ...correnti,
      {
        id: creaIdAgenda("risorsa"),
        sedeId,
        tipo,
        nome: `${nomeBase} ${numero}`,
        attiva: true,
        note: "",
      },
    ]);
  };

  const aggiornaRisorsaSede = <K extends keyof RisorsaSede>(
    id: string,
    campo: K,
    valore: RisorsaSede[K],
  ) => {
    setRisorseSedi((correnti) =>
      correnti.map((risorsa, index) =>
        risorsa.id === id ? normalizzaRisorsaSede({ ...risorsa, [campo]: valore }, index) : risorsa,
      ),
    );
  };

  const eliminaRisorsaSede = (id: string) => {
    setRisorseSedi((correnti) => correnti.filter((risorsa) => risorsa.id !== id));
  };

  const ripristinaRisorseSedi = () => {
    setRisorseSedi(copiaRisorseSedi(RISORSE_SEDI_INIZIALI));
    mostraNotifica("Preset risorse sedi ripristinato.");
  };

  const settingsQuickLinks = [
    {
      tab: "prestazioni" as SettingsTabId,
      icon: <Stethoscope className="h-5 w-5" />,
      title: "Prestazioni",
      description: "Catalogo unico delle prestazioni erogate",
      count: `${prestazioni.length} voci`,
    },
    {
      tab: "medici" as SettingsTabId,
      icon: <CalendarDays className="h-5 w-5" />,
      title: "Medici e agende",
      description: "Disponibilita, ferie, eccezioni e listini medico",
      count: `${medici.length} medici`,
    },
    {
      tab: "specialita" as SettingsTabId,
      icon: <Tags className="h-5 w-5" />,
      title: "Specialita",
      description: "Gruppi clinici e prestazioni associate",
      count: `${specialitaDisponibili.length} gruppi`,
    },
    {
      tab: "convenzioni" as SettingsTabId,
      icon: <FileText className="h-5 w-5" />,
      title: "Convenzioni",
      description: "Modelli base per aziende e societa sportive",
      count: `${conventionTemplates.length} modelli`,
    },
    {
      tab: "risorse" as SettingsTabId,
      icon: <Building2 className="h-5 w-5" />,
      title: "Risorse sedi",
      description: "Ambulatori e strumenti per Modena e Sassuolo",
      count: `${risorseSedi.filter((risorsa) => risorsa.attiva).length} attive`,
    },
    {
      tab: "log" as SettingsTabId,
      icon: <Activity className="h-5 w-5" />,
      title: "Log operatore",
      description: "Audit delle azioni eseguite dal backend",
      count: "Solo admin",
    },
  ];
  const settingsFeatureCards = [
    {
      tab: "compensi" as SettingsTabId,
      icon: <Euro className="h-6 w-6" />,
      title: "Compensi medici",
      description: "Calcola quote, netto studio e percentuali sui fatturati.",
      action: "Apri compensi",
    },
    {
      tab: "medici" as SettingsTabId,
      icon: <Plane className="h-6 w-6" />,
      title: "Piano ferie",
      description: "Blocca giorni o periodi, anche diversi per sede.",
      action: "Gestisci agende",
    },
    {
      tab: "convenzioni" as SettingsTabId,
      icon: <Percent className="h-6 w-6" />,
      title: "Listini convenzionati",
      description: "Prezzo finale o sconto percentuale per ogni prestazione.",
      action: "Configura",
    },
  ];
  const settingsTabTitles: Record<SettingsTabId, string> = {
    specialita: "Specialita",
    prestazioni: "Prestazioni",
    convenzioni: "Convenzioni",
    risorse: "Risorse sedi",
    medici: "Medici e agende",
    compensi: "Compensi medici",
    log: "Log operatore",
  };
  const apriSchedaImpostazioni = React.useCallback((tab: SettingsTabId) => {
    setSettingsTab(tab);
    setSettingsOverviewVisible(false);
  }, []);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-semibold tracking-tight text-foreground">Impostazioni</h1>
          <p className="text-sm text-muted-foreground">
            Configura il gestionale adattandolo alle esigenze del tuo centro.
          </p>
        </div>
        <Badge className={settingsBadgeClass}>
          {settingsBadgeLabel[settingsSaveState]}
        </Badge>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={gestisciImportConfigurazione}
      />

      {settingsOverviewVisible ? (
        <>
      <div className="flex flex-col gap-3 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">i</span>
          <span className="font-medium">Prima imposta prestazioni, medici e disponibilita: l'agenda usa questi dati per generare gli slot.</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => apriSchedaImpostazioni("medici")}>
          Completa configurazione agende
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Impostazioni generali</h2>
          <div className="mt-5 grid gap-2">
            {settingsQuickLinks.map((item) => (
              <button
                key={item.tab}
                type="button"
                onClick={() => apriSchedaImpostazioni(item.tab)}
                className={`flex items-center gap-4 rounded-md px-3 py-3 text-left transition-colors ${
                  !settingsOverviewVisible && settingsTab === item.tab ? "bg-primary/10" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-slate-50 text-slate-600">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="block text-sm text-muted-foreground">{item.description}</span>
                </span>
                <Badge variant="secondary">{item.count}</Badge>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Operativita e comunicazioni</h2>
          <div className="mt-5 grid gap-2">
            {[
              ["Domande per i pazienti", "Informazioni importanti durante prenotazione"],
              ["Indicazioni per i pazienti", "Note da mostrare prima della prestazione"],
              ["Messaggi", "Template e comunicazioni operative"],
            ].map(([title, description]) => (
              <div key={title} className="flex items-center gap-4 rounded-md px-3 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-slate-50 text-slate-600">
                  <FileText className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{title}</span>
                  <span className="block text-sm text-muted-foreground">{description}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Funzionalita operative</h2>
          <p className="text-sm text-muted-foreground">Scorciatoie alle aree che governano listini, ferie e compensi.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {settingsFeatureCards.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => apriSchedaImpostazioni(item.tab)}
              className="min-h-44 rounded-lg border border-border bg-white p-5 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                {item.icon}
              </span>
              <span className="mt-4 flex items-center gap-2">
                <span className="text-base font-semibold text-foreground">{item.title}</span>
                <Badge variant="secondary">Attivo</Badge>
              </span>
              <span className="mt-3 block text-sm leading-6 text-muted-foreground">{item.description}</span>
              <span className="mt-4 block text-sm font-semibold text-primary">{item.action}</span>
            </button>
          ))}
        </div>
      </section>

        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheda impostazioni</p>
              <h2 className="text-xl font-semibold text-foreground">{settingsTabTitles[settingsTab]}</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsOverviewVisible(true)}
              className="w-full gap-2 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Tutte le impostazioni
            </Button>
          </div>

      <Tabs
        value={settingsTab}
        onValueChange={(value) => {
          setSettingsTab(value as SettingsTabId);
          setSettingsOverviewVisible(false);
        }}
        className="space-y-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-white p-1 shadow-sm">
          <TabsTrigger value="specialita" className="gap-2">
            <Tags className="h-4 w-4" />
            Specialita
          </TabsTrigger>
          <TabsTrigger value="prestazioni" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Prestazioni
          </TabsTrigger>
          <TabsTrigger value="convenzioni" className="gap-2">
            <FileText className="h-4 w-4" />
            Convenzioni
          </TabsTrigger>
          <TabsTrigger value="risorse" className="gap-2">
            <Building2 className="h-4 w-4" />
            Risorse
          </TabsTrigger>
          <TabsTrigger value="medici" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Medici
          </TabsTrigger>
          <TabsTrigger value="compensi" className="gap-2">
            <Euro className="h-4 w-4" />
            Compensi
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-2">
            <Activity className="h-4 w-4" />
            Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="space-y-4">
          <AdminAuditLogs />
        </TabsContent>

        <TabsContent value="specialita" className="space-y-4">
          <SettingsPanel
            title="Specialita"
            description="Raggruppa le prestazioni per area clinica, ad esempio Ortopedia, Cardiologia o Diagnostica."
            icon={<Tags className="h-5 w-5" />}
            actions={
              <div className="flex flex-wrap justify-end gap-2">
                <PrestazioniUnlockAction
                  editing={prestazioniModificaAttiva}
                  onUnlock={sbloccaModificaPrestazioni}
                />
                <ImportExportActions onExport={esportaConfigurazione} onImportClick={apriImportConfigurazione} />
              </div>
            }
          >
            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Nuova specialita</h3>
                    <p className="text-xs text-muted-foreground">
                      Crea il contenitore prima di associare le prestazioni.
                    </p>
                  </div>
                  <Field label="Nome">
                    <Input
                      value={nuovaSpecialita}
                      disabled={!prestazioniModificaAttiva}
                      onChange={(event) => setNuovaSpecialita(event.target.value)}
                      placeholder="Es. Ortopedia"
                    />
                  </Field>
                  <Button
                    type="button"
                    onClick={aggiungiSpecialita}
                    disabled={!prestazioniModificaAttiva}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Aggiungi specialita
                  </Button>
                </div>

                <div className="overflow-hidden rounded-md border border-border bg-white">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Elenco specialita</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {specialitaDisponibili.map((nomeSpecialita) => {
                      const selezionata = stessaSpecialita(nomeSpecialita, selectedSpecialita);
                      const numeroPrestazioni = prestazioniInGestione.filter((prestazione) =>
                        stessaSpecialita(prestazione.specialita, nomeSpecialita),
                      ).length;

                      return (
                        <button
                          key={nomeSpecialita}
                          type="button"
                          onClick={() => setSelectedSpecialita(nomeSpecialita)}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            selezionata ? "bg-primary/10" : "bg-white hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{nomeSpecialita}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {numeroPrestazioni} prestazioni collegate
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {numeroPrestazioni}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-md border border-border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{selectedSpecialita}</h3>
                      <p className="text-sm text-muted-foreground">
                        Prestazioni disponibili per questa specialita.
                      </p>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      {prestazioniSpecialita.length} prestazioni
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <Field label="Nuova prestazione">
                      <Input
                        value={nuovaPrestazioneSpecialita.nome}
                        disabled={!prestazioniModificaAttiva}
                        onChange={(event) =>
                          setNuovaPrestazioneSpecialita((corrente) => ({
                            ...corrente,
                            nome: event.target.value,
                          }))
                        }
                        placeholder={`Es. Visita ${selectedSpecialita.toLocaleLowerCase("it-IT")}`}
                      />
                    </Field>
                    <Field label="Durata base">
                      <Input
                        type="number"
                        min={5}
                        step={5}
                        value={nuovaPrestazioneSpecialita.durata}
                        disabled={!prestazioniModificaAttiva}
                        onChange={(event) =>
                          setNuovaPrestazioneSpecialita((corrente) => ({
                            ...corrente,
                            durata: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={aggiungiPrestazioneASpecialita}
                        disabled={!prestazioniModificaAttiva}
                        className="w-full gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Aggiungi
                      </Button>
                    </div>
                  </div>

                  {prestazioniSpecialita.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prestazione</TableHead>
                            <TableHead>Durata base</TableHead>
                            <TableHead>Attiva</TableHead>
                            <TableHead className="w-16">Azioni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {prestazioniSpecialita.map((prestazione) => (
                            <TableRow key={prestazione.id}>
                              <TableCell className="min-w-[220px]">
                                <Input
                                  value={prestazione.nome}
                                  disabled={!prestazioniModificaAttiva}
                                  onChange={(event) =>
                                    aggiornaPrestazione(prestazione.id, "nome", event.target.value)
                                  }
                                />
                              </TableCell>
                              <TableCell className="w-28">
                                <Input
                                  type="number"
                                  min={5}
                                  step={5}
                                  value={prestazione.durata}
                                  disabled={!prestazioniModificaAttiva}
                                  onChange={(event) =>
                                    aggiornaPrestazione(prestazione.id, "durata", Number(event.target.value) || 0)
                                  }
                                />
                              </TableCell>
                              <TableCell className="w-24">
                                <Checkbox
                                  checked={prestazione.attiva}
                                  disabled={!prestazioniModificaAttiva}
                                  onCheckedChange={(checked) =>
                                    aggiornaPrestazione(prestazione.id, "attiva", Boolean(checked))
                                  }
                                />
                              </TableCell>
                              <TableCell className="w-16">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => eliminaPrestazione(prestazione.id)}
                                  disabled={!prestazioniModificaAttiva}
                                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={`Elimina ${prestazione.nome}`}
                                  title="Elimina prestazione"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                      Nessuna prestazione collegata a questa specialita.
                    </div>
                  )}
                  <div className="mt-4">
                    <PrestazioniSaveBar
                      editing={prestazioniModificaAttiva}
                      onCancel={annullaModificaPrestazioni}
                      onSave={salvaModificaPrestazioni}
                    />
                  </div>
                </div>
              </div>
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="prestazioni" className="space-y-4">
          <SettingsPanel
            title="Prestazioni dei medici"
            description="La prestazione esiste una sola volta; durata e importo effettivi si definiscono nel listino del medico."
            icon={<Stethoscope className="h-5 w-5" />}
            actions={
              <div className="flex flex-wrap justify-end gap-2">
                <PrestazioniUnlockAction
                  editing={prestazioniModificaAttiva}
                  onUnlock={sbloccaModificaPrestazioni}
                />
                <ImportExportActions onExport={esportaConfigurazione} onImportClick={apriImportConfigurazione} />
              </div>
            }
          >
            <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <Field label="Cerca prestazione">
                <Input
                  value={ricercaPrestazioni}
                  onChange={(event) => setRicercaPrestazioni(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applicaRicercaPrestazioni();
                  }}
                  placeholder="Cerca per nome o specialita"
                />
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={applicaRicercaPrestazioni} className="w-full gap-2">
                  <Search className="h-4 w-4" />
                  Cerca
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_200px_120px_auto]">
              <Field label="Prestazione">
                <Input
                  value={nuovaPrestazione.nome}
                  disabled={!prestazioniModificaAttiva}
                  onChange={(event) =>
                    setNuovaPrestazione((corrente) => ({ ...corrente, nome: event.target.value }))
                  }
                  placeholder="Es. Visita ortopedica"
                />
              </Field>
              <Field label="Specialita">
                <Select
                  value={nuovaPrestazione.specialita}
                  disabled={!prestazioniModificaAttiva}
                  onValueChange={(valore) =>
                    setNuovaPrestazione((corrente) => ({ ...corrente, specialita: valore }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {specialitaDisponibili.map((nomeSpecialita) => (
                      <SelectItem key={nomeSpecialita} value={nomeSpecialita}>
                        {nomeSpecialita}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Durata base">
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={nuovaPrestazione.durata}
                  disabled={!prestazioniModificaAttiva}
                  onChange={(event) =>
                    setNuovaPrestazione((corrente) => ({ ...corrente, durata: event.target.value }))
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={aggiungiPrestazione}
                  disabled={!prestazioniModificaAttiva}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Aggiungi
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestazione</TableHead>
                  <TableHead>Specialita</TableHead>
                  <TableHead>Durata base</TableHead>
                  <TableHead>Attiva</TableHead>
                  <TableHead className="w-16">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestazioniFiltrate.length > 0 ? (
                  prestazioniFiltrate.map((prestazione) => (
                    <TableRow key={prestazione.id}>
                      <TableCell className="min-w-[220px]">
                        <Input
                          value={prestazione.nome}
                          disabled={!prestazioniModificaAttiva}
                          onChange={(event) => aggiornaPrestazione(prestazione.id, "nome", event.target.value)}
                        />
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Select
                          value={prestazione.specialita}
                          disabled={!prestazioniModificaAttiva}
                          onValueChange={(valore) => aggiornaPrestazione(prestazione.id, "specialita", valore)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {specialitaDisponibili.map((nomeSpecialita) => (
                              <SelectItem key={nomeSpecialita} value={nomeSpecialita}>
                                {nomeSpecialita}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="w-28">
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={prestazione.durata}
                          disabled={!prestazioniModificaAttiva}
                          onChange={(event) =>
                            aggiornaPrestazione(prestazione.id, "durata", Number(event.target.value) || 0)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={prestazione.attiva}
                          disabled={!prestazioniModificaAttiva}
                          onCheckedChange={(checked) =>
                            aggiornaPrestazione(prestazione.id, "attiva", Boolean(checked))
                          }
                        />
                      </TableCell>
                      <TableCell className="w-16">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => eliminaPrestazione(prestazione.id)}
                          disabled={!prestazioniModificaAttiva}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Elimina ${prestazione.nome}`}
                          title="Elimina prestazione"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Nessuna prestazione trovata.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PrestazioniSaveBar
              editing={prestazioniModificaAttiva}
              onCancel={annullaModificaPrestazioni}
              onSave={salvaModificaPrestazioni}
            />
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="convenzioni" className="space-y-4">
          <SettingsPanel
            title="Convenzioni base"
            description="Crea il modello standard con prestazioni e prezzi convenzionati; poi lo applichi ad aziende e societa sportive."
            icon={<FileText className="h-5 w-5" />}
            actions={<ImportExportActions onExport={esportaConfigurazione} onImportClick={apriImportConfigurazione} />}
          >
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold text-foreground">Modelli convenzione</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Usa un modello base comune e personalizzalo dopo nella scheda azienda/societa.
                  </p>
                  <Button type="button" onClick={aggiungiConventionTemplate} className="mt-3 w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Nuovo modello
                  </Button>
                </div>

                <div className="overflow-hidden rounded-md border border-border bg-white">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Elenco</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {conventionTemplates.length > 0 ? (
                      conventionTemplates.map((template) => {
                        const selected = template.id === conventionTemplateSelezionato?.id;
                        return (
                          <div
                            key={template.id}
                            className={`flex items-stretch gap-2 p-2 ${selected ? "bg-primary/10" : "bg-white hover:bg-muted/40"}`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedConventionTemplateId(template.id)}
                              className="min-w-0 flex-1 rounded-md px-2 py-2 text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">{template.nome}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {template.attiva ? "Attiva" : "Disattivata"}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {template.services.length} voci
                                </Badge>
                              </div>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => eliminaConventionTemplate(template.id)}
                              disabled={conventionTemplates.length <= 1}
                              className="mt-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Elimina modello"
                              aria-label={`Elimina ${template.nome}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Nessun modello inserito.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {conventionTemplateSelezionato ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-border bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Scheda modello</h3>
                        <p className="text-sm text-muted-foreground">
                          Questi dati vengono copiati nella convenzione dell'azienda, poi puoi modificarli.
                        </p>
                      </div>
                      <Badge variant={conventionTemplateSelezionato.attiva ? "default" : "outline"}>
                        {conventionTemplateSelezionato.attiva ? "Attiva" : "Disattivata"}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                      <Field label="Nome modello">
                        <Input
                          value={conventionTemplateSelezionato.nome}
                          onChange={(event) =>
                            aggiornaConventionTemplate(conventionTemplateSelezionato.id, "nome", event.target.value)
                          }
                          placeholder="Convenzione base"
                        />
                      </Field>
                      <Field label="Attiva">
                        <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3">
                          <Checkbox
                            checked={conventionTemplateSelezionato.attiva}
                            onCheckedChange={(checked) =>
                              aggiornaConventionTemplate(conventionTemplateSelezionato.id, "attiva", Boolean(checked))
                            }
                          />
                          <span className="text-sm text-foreground">Usabile in anagrafica</span>
                        </div>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Testo base convenzione">
                        <Textarea
                          value={conventionTemplateSelezionato.descrizione}
                          onChange={(event) =>
                            aggiornaConventionTemplate(conventionTemplateSelezionato.id, "descrizione", event.target.value)
                          }
                          placeholder="Condizioni generali, testo standard, note interne..."
                          className="min-h-24"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Prestazioni nel modello</h3>
                        <p className="text-sm text-muted-foreground">
                          Aggiungi prestazioni dal catalogo e imposta sconto o prezzo finale standard.
                        </p>
                      </div>
                      <Badge variant="secondary">{conventionTemplateSelezionato.services.length} voci</Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Field label="Cerca prestazione">
                        <Input
                          value={ricercaPrestazioniConvenzione}
                          onChange={(event) => setRicercaPrestazioniConvenzione(event.target.value)}
                          placeholder="Cerca per nome o specialita"
                        />
                      </Field>
                      {ricercaPrestazioniConvenzione.trim() && (
                        <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-white shadow-sm">
                          {prestazioniDisponibiliConvenzioneBase.length > 0 ? (
                            prestazioniDisponibiliConvenzioneBase.map((prestazione) => (
                              <button
                                key={prestazione.id}
                                type="button"
                                className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-primary/5"
                                onClick={() => aggiungiPrestazioneAConvenzioneBase(prestazione)}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-foreground">{prestazione.nome}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {prestazione.specialita} · {prestazione.durata} min
                                  </span>
                                </span>
                                <Plus className="h-4 w-4 shrink-0 text-primary" />
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                              Nessuna prestazione trovata o gia inserita.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {conventionTemplateSelezionato.services.length > 0 ? (
                      <div className="mt-4 overflow-x-auto rounded-md border border-border">
                        <Table className="min-w-[920px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Prestazione</TableHead>
                              <TableHead>Specialita</TableHead>
                              <TableHead className="w-32">Durata</TableHead>
                              <TableHead className="w-44">Modalita</TableHead>
                              <TableHead className="w-44">Valore convenzione</TableHead>
                              <TableHead className="w-16">Azioni</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {conventionTemplateSelezionato.services.map((service) => (
                              <TableRow key={service.id}>
                                <TableCell className="min-w-[240px] font-medium text-foreground">{service.nome}</TableCell>
                                <TableCell className="min-w-[180px] text-muted-foreground">{service.specialita || "-"}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={5}
                                    step={5}
                                    value={service.durata}
                                    onChange={(event) =>
                                      aggiornaPrestazioneConvenzioneBase(service.id, "durata", Number(event.target.value) || 0)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={service.pricingMode}
                                    onValueChange={(value) =>
                                      aggiornaPrestazioneConvenzioneBase(
                                        service.id,
                                        "pricingMode",
                                        value === "discount" ? "discount" : "fixed",
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fixed">Prezzo finale</SelectItem>
                                      <SelectItem value="discount">Sconto %</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <div className="relative">
                                    {service.pricingMode === "discount" ? (
                                      <Percent className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    ) : (
                                      <Euro className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    )}
                                    <Input
                                      type="number"
                                      min={0}
                                      max={service.pricingMode === "discount" ? 100 : undefined}
                                      step={service.pricingMode === "discount" ? 1 : 1}
                                      value={service.pricingMode === "discount" ? service.discountPercent : service.prezzo}
                                      onChange={(event) =>
                                        aggiornaPrestazioneConvenzioneBase(
                                          service.id,
                                          service.pricingMode === "discount" ? "discountPercent" : "prezzo",
                                          Number(event.target.value) || 0,
                                        )
                                      }
                                      className="pl-8"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => rimuoviPrestazioneConvenzioneBase(service.id)}
                                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    title="Rimuovi prestazione"
                                    aria-label={`Rimuovi ${service.nome}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                        Nessuna prestazione nel modello. Cerca una prestazione e aggiungila.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Crea un modello convenzione per iniziare.
                </div>
              )}
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="risorse" className="space-y-4">
          <SettingsPanel
            title="Risorse sedi"
            description="Configura ambulatori e strumenti disponibili per ogni sede. L'agenda ambulatorio usa queste risorse per organizzare la giornata."
            icon={<Building2 className="h-5 w-5" />}
            actions={
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={ripristinaRisorseSedi}>
                  Ripristina preset sedi
                </Button>
                <ImportExportActions onExport={esportaConfigurazione} onImportClick={apriImportConfigurazione} />
              </div>
            }
          >
            <div className="grid gap-4 xl:grid-cols-2">
              {SEDI_MEDICO.map((sedeItem) => {
                const risorseSede = risorseSediOrdinate.filter((risorsa) => risorsa.sedeId === sedeItem.id);
                return (
                  <section key={sedeItem.id} className="rounded-md border border-border bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{sedeItem.label}</h3>
                        <p className="text-sm text-muted-foreground">
                          Risorse utilizzabili nell'agenda della sede {sedeItem.sigla}.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="whitespace-nowrap">
                          Ambulatori: {contaRisorseSede(sedeItem.id, "ambulatorio")}
                        </Badge>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          Strumenti: {contaStrumentiSede(sedeItem.id)}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => aggiungiRisorsaSede(sedeItem.id, "ambulatorio")}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Aggiungi ambulatorio
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => aggiungiRisorsaSede(sedeItem.id, "strumento")}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Aggiungi strumento
                      </Button>
                    </div>

                    {risorseSede.length > 0 ? (
                      <div className="mt-4 overflow-x-auto rounded-md border border-border">
                        <Table className="min-w-[760px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[220px]">Nome</TableHead>
                              <TableHead className="w-44">Categoria</TableHead>
                              <TableHead className="w-36">Stato</TableHead>
                              <TableHead className="min-w-[220px]">Note</TableHead>
                              <TableHead className="w-16">Azioni</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {risorseSede.map((risorsa) => (
                              <TableRow key={risorsa.id}>
                                <TableCell>
                                  <Input
                                    value={risorsa.nome}
                                    onChange={(event) =>
                                      aggiornaRisorsaSede(risorsa.id, "nome", event.target.value)
                                    }
                                    placeholder="Nome risorsa"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={risorsa.tipo}
                                    onValueChange={(value: TipoRisorsaSede) =>
                                      aggiornaRisorsaSede(risorsa.id, "tipo", value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIPI_RISORSA_SEDE.map((tipo) => (
                                        <SelectItem key={tipo.id} value={tipo.id}>
                                          {tipo.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                                    <Checkbox
                                      checked={risorsa.attiva}
                                      onCheckedChange={(checked) =>
                                        aggiornaRisorsaSede(risorsa.id, "attiva", checked === true)
                                      }
                                    />
                                    {risorsa.attiva ? "Attiva" : "Disattiva"}
                                  </label>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={risorsa.note}
                                    onChange={(event) =>
                                      aggiornaRisorsaSede(risorsa.id, "note", event.target.value)
                                    }
                                    placeholder="Es. piano terra, stanza 3"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => eliminaRisorsaSede(risorsa.id)}
                                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    title="Elimina risorsa"
                                    aria-label={`Elimina ${risorsa.nome}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                        Nessuna risorsa configurata per questa sede.
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="medici" className="space-y-4">
          <SettingsPanel
            title="Medici"
            description="Seleziona un medico per modificare anagrafica, agenda, disponibilita e listino prezzi."
            icon={<CalendarDays className="h-5 w-5" />}
            actions={
              <div className="flex flex-wrap justify-end gap-2">
                <ImportExportActions onExport={esportaConfigurazione} onImportClick={apriImportConfigurazione} />
              </div>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Nuovo medico</h3>
                    <p className="text-xs text-muted-foreground">
                      Il listino nasce vuoto e si compila dalla scheda del medico.
                    </p>
                  </div>
                  <Field label="Medico">
                    <Input
                      value={nuovoMedico.nome}
                      onChange={(event) =>
                        setNuovoMedico((corrente) => ({ ...corrente, nome: event.target.value }))
                      }
                      placeholder="Es. Dott.ssa Anna Neri"
                    />
                  </Field>
                  <Field label="Specialita">
                    <Select
                      value={nuovoMedico.specialita}
                      onValueChange={(valore) =>
                        setNuovoMedico((corrente) => ({ ...corrente, specialita: valore }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {specialitaDisponibili.map((nomeSpecialita) => (
                          <SelectItem key={nomeSpecialita} value={nomeSpecialita}>
                            {nomeSpecialita}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button type="button" onClick={aggiungiMedico} className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Inserisci medico
                  </Button>
                </div>

                <div className="overflow-hidden rounded-md border border-border bg-white">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Elenco medici</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {medici.length > 0 ? (
                      medici.map((medico) => {
                        const selezionato = medico.id === medicoSelezionato?.id;
                        const righeListino = listini.filter((listino) => {
                          if (listino.medicoId !== medico.id) return false;
                          const prestazione = prestazioni.find((item) => item.id === listino.prestazioneId);
                          return prestazione ? stessaSpecialita(prestazione.specialita, medico.specialita) : false;
                        }).length;
                        const fasceDisponibilitaPerSede = normalizzaFasceDisponibilitaPerSede(medico);
                        const riepilogoSedi = SEDI_MEDICO.map((sede) => {
                          const fasce = fasceDisponibilitaPerSede[sede.id];
                          return `${sede.sigla}: ${fasce.length > 0 ? fasce.map(descriviFasciaDisponibilita).join(", ") : "-"}`;
                        }).join(" · ");

                        return (
                          <div
                            key={medico.id}
                            className={`flex items-stretch gap-2 p-2 transition-colors ${
                              selezionato ? "bg-primary/10" : "bg-white hover:bg-muted/40"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedMedicoId(medico.id)}
                              className="min-w-0 flex-1 rounded-md px-2 py-2 text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">{medico.nome}</p>
                                  <p className="truncate text-xs text-muted-foreground">{medico.specialita}</p>
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {righeListino} voci
                                </Badge>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {riepilogoSedi}
                              </p>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setMedicoDaEliminareId(medico.id)}
                              className="mt-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Elimina ${medico.nome}`}
                              title="Elimina medico"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Nessun medico inserito. Aggiungi il primo medico dal modulo sopra.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {medicoSelezionato ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-border bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Scheda medico</h3>
                        <p className="text-sm text-muted-foreground">
                          Modifica dati anagrafici e profilo di fatturazione.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {schedaMedicoModificaAttiva ? (
                          <>
                            <Badge variant="secondary" className="h-9 px-3">
                              Modifica attiva
                            </Badge>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={annullaModificaSchedaMedico}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" />
                              Annulla
                            </Button>
                            <Button type="button" size="sm" onClick={salvaModificaSchedaMedico} className="gap-2">
                              <Check className="h-4 w-4" />
                              Salva
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={sbloccaModificaSchedaMedico}
                            className="gap-2"
                          >
                            <Unlock className="h-4 w-4" />
                            Modifica
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMedicoDaEliminareId(medicoSelezionato.id)}
                          className="gap-2 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Elimina
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Field label="Nome medico">
                        <Input
                          value={medicoSchedaInGestione?.nome ?? ""}
                          disabled={!schedaMedicoModificaAttiva}
                          onChange={(event) =>
                            aggiornaMedico(medicoSelezionato.id, "nome", event.target.value)
                          }
                          className="font-semibold"
                        />
                      </Field>
                      <Field label="Specialita">
                        <Select
                          value={medicoSchedaInGestione?.specialita ?? ""}
                          disabled={!schedaMedicoModificaAttiva}
                          onValueChange={(valore) =>
                            aggiornaSpecialitaMedico(medicoSelezionato.id, valore)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {specialitaDisponibili.map((nomeSpecialita) => (
                              <SelectItem key={nomeSpecialita} value={nomeSpecialita}>
                                {nomeSpecialita}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <div className="mt-5 rounded-md border border-border bg-muted/20 p-4">
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-foreground">Dati fatturazione</h4>
                        <p className="text-xs text-muted-foreground">
                          Profilo fiscale del medico per documenti e pagamenti.
                        </p>
                      </div>
                      <fieldset
                        disabled={!schedaMedicoModificaAttiva}
                        className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                      >
                        <Field label="Ragione sociale / intestatario">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.intestatario}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "intestatario",
                                event.target.value,
                              )
                            }
                            placeholder={medicoSchedaInGestione?.nome ?? medicoSelezionato.nome}
                          />
                        </Field>
                        <Field label="Partita IVA">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.partitaIva}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "partitaIva",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Codice fiscale">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.codiceFiscale}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "codiceFiscale",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Indirizzo">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.indirizzo}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "indirizzo",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="CAP">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.cap}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "cap",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Citta">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.citta}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "citta",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Provincia">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.provincia}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "provincia",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Email fatturazione">
                          <Input
                            type="email"
                            value={datiFatturazioneMedicoSelezionato.emailFatturazione}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "emailFatturazione",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="PEC">
                          <Input
                            type="email"
                            value={datiFatturazioneMedicoSelezionato.pec}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "pec",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Codice SDI">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.codiceSdi}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "codiceSdi",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Regime fiscale">
                          <Input
                            value={datiFatturazioneMedicoSelezionato.regimeFiscale}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "regimeFiscale",
                                event.target.value,
                              )
                            }
                            placeholder="Es. forfettario, ordinario"
                          />
                        </Field>
                        <Field label="Note fatturazione">
                          <Textarea
                            value={datiFatturazioneMedicoSelezionato.noteFatturazione}
                            onChange={(event) =>
                              aggiornaDatiFatturazioneMedico(
                                medicoSelezionato.id,
                                "noteFatturazione",
                                event.target.value,
                              )
                            }
                            className="min-h-10 resize-y xl:col-span-1"
                          />
                        </Field>
                      </fieldset>
                    </div>

                    <div className="mt-5 rounded-md border border-border bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Agenda medico
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Imposta fasce orarie ricorrenti per sede ed eccezioni su giorno preciso.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {agendaMedicoModificaAttiva ? (
                            <>
                              <Badge variant="secondary" className="h-9 px-3">
                                Modifica attiva
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={annullaModificaAgendaMedico}
                                className="gap-2"
                              >
                                <X className="h-4 w-4" />
                                Annulla
                              </Button>
                              <Button type="button" size="sm" onClick={salvaModificaAgendaMedico} className="gap-2">
                                <Check className="h-4 w-4" />
                                Salva
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={sbloccaModificaAgendaMedico}
                              className="gap-2"
                            >
                              <Unlock className="h-4 w-4" />
                              Modifica
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        {SEDI_MEDICO.map((sede) => {
                          const fasceSede = agendaMedicoInGestione.fasceDisponibilitaPerSede[sede.id];

                          return (
                            <div key={sede.id} className="rounded-md border border-border bg-muted/20 p-3">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground">{sede.label}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {descriviFasceDisponibilita(fasceSede)}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {fasceSede.length} fasce
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                {fasceSede.length > 0 ? (
                                  fasceSede.map((fascia) => (
                                    <div
                                      key={fascia.id}
                                      className="grid gap-2 rounded-md border border-border bg-white p-2 md:grid-cols-[140px_1fr_1fr_auto]"
                                    >
                                      <Select
                                        value={fascia.giorno}
                                        disabled={!agendaMedicoModificaAttiva}
                                        onValueChange={(valore) =>
                                          aggiornaFasciaDisponibilita(sede.id, fascia.id, "giorno", valore)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {GIORNI.map((giorno) => (
                                            <SelectItem key={`${sede.id}-${fascia.id}-${giorno}`} value={giorno}>
                                              {giorno}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="time"
                                        value={fascia.dalle}
                                        disabled={!agendaMedicoModificaAttiva}
                                        onChange={(event) =>
                                          aggiornaFasciaDisponibilita(sede.id, fascia.id, "dalle", event.target.value)
                                        }
                                        aria-label="Dalle"
                                      />
                                      <Input
                                        type="time"
                                        value={fascia.alle}
                                        disabled={!agendaMedicoModificaAttiva}
                                        onChange={(event) =>
                                          aggiornaFasciaDisponibilita(sede.id, fascia.id, "alle", event.target.value)
                                        }
                                        aria-label="Alle"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={!agendaMedicoModificaAttiva}
                                        onClick={() => eliminaFasciaDisponibilita(sede.id, fascia.id)}
                                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        aria-label="Elimina fascia"
                                        title="Elimina fascia"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-md border border-dashed border-border bg-white p-3 text-sm text-muted-foreground">
                                    Nessuna fascia impostata.
                                  </div>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!agendaMedicoModificaAttiva}
                                  onClick={() => aggiungiFasciaDisponibilita(sede.id)}
                                  className="w-full gap-2"
                                >
                                  <Plus className="h-4 w-4" />
                                  Aggiungi fascia
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">Eccezioni agenda</h4>
                            <p className="text-xs text-muted-foreground">
                              Aggiungi presenza o disponibilita su data e orario preciso.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!agendaMedicoModificaAttiva}
                            onClick={aggiungiEccezioneAgenda}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Aggiungi eccezione
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {agendaMedicoInGestione.eccezioniAgenda.length > 0 ? (
                            agendaMedicoInGestione.eccezioniAgenda.map((eccezione) => (
                              <div
                                key={eccezione.id}
                                className="grid gap-2 rounded-md border border-border bg-white p-2 lg:grid-cols-[150px_160px_120px_120px_minmax(180px,1fr)_auto]"
                              >
                                <Select
                                  value={eccezione.sedeId}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onValueChange={(valore) =>
                                    aggiornaEccezioneAgenda(eccezione.id, "sedeId", valore as SedeMedicoId)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SEDI_MEDICO.map((sede) => (
                                      <SelectItem key={`${eccezione.id}-${sede.id}`} value={sede.id}>
                                        {sede.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="date"
                                  value={eccezione.data}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) =>
                                    aggiornaEccezioneAgenda(eccezione.id, "data", event.target.value)
                                  }
                                  aria-label="Data eccezione"
                                />
                                <Input
                                  type="time"
                                  value={eccezione.dalle}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) =>
                                    aggiornaEccezioneAgenda(eccezione.id, "dalle", event.target.value)
                                  }
                                  aria-label="Dalle"
                                />
                                <Input
                                  type="time"
                                  value={eccezione.alle}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) =>
                                    aggiornaEccezioneAgenda(eccezione.id, "alle", event.target.value)
                                  }
                                  aria-label="Alle"
                                />
                                <Input
                                  value={eccezione.note}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) =>
                                    aggiornaEccezioneAgenda(eccezione.id, "note", event.target.value)
                                  }
                                  placeholder="Note"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={!agendaMedicoModificaAttiva}
                                  onClick={() => eliminaEccezioneAgenda(eccezione.id)}
                                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  aria-label="Elimina eccezione"
                                  title="Elimina eccezione"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-md border border-dashed border-border bg-white p-3 text-sm text-muted-foreground">
                              Nessuna eccezione inserita.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-700">
                              <Plane className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">Piano ferie</h4>
                              <p className="text-xs text-muted-foreground">
                                Blocca giorni o periodi in cui il medico non deve risultare disponibile in agenda.
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!agendaMedicoModificaAttiva}
                            onClick={aggiungiFerieMedico}
                            className="gap-2 bg-white"
                          >
                            <Plus className="h-4 w-4" />
                            Aggiungi ferie
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {agendaMedicoInGestione.pianoFerie.length > 0 ? (
                            agendaMedicoInGestione.pianoFerie.map((ferie) => (
                              <div
                                key={ferie.id}
                                className="grid gap-2 rounded-md border border-amber-200 bg-white p-2 xl:grid-cols-[150px_150px_150px_120px_120px_minmax(180px,1fr)_auto]"
                              >
                                <Select
                                  value={ferie.sedeId}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onValueChange={(valore) =>
                                    aggiornaFerieMedico(ferie.id, "sedeId", valore as PianoFerieMedico["sedeId"])
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="tutte">Tutte le sedi</SelectItem>
                                    {SEDI_MEDICO.map((sede) => (
                                      <SelectItem key={`${ferie.id}-${sede.id}`} value={sede.id}>
                                        {sede.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="date"
                                  value={ferie.dal}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) => aggiornaFerieMedico(ferie.id, "dal", event.target.value)}
                                  aria-label="Dal"
                                />
                                <Input
                                  type="date"
                                  value={ferie.al}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) => aggiornaFerieMedico(ferie.id, "al", event.target.value)}
                                  aria-label="Al"
                                />
                                <Input
                                  type="time"
                                  value={ferie.dalle}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) => aggiornaFerieMedico(ferie.id, "dalle", event.target.value)}
                                  aria-label="Dalle"
                                />
                                <Input
                                  type="time"
                                  value={ferie.alle}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) => aggiornaFerieMedico(ferie.id, "alle", event.target.value)}
                                  aria-label="Alle"
                                />
                                <Input
                                  value={ferie.note}
                                  disabled={!agendaMedicoModificaAttiva}
                                  onChange={(event) => aggiornaFerieMedico(ferie.id, "note", event.target.value)}
                                  placeholder="Es. ferie estive"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={!agendaMedicoModificaAttiva}
                                  onClick={() => eliminaFerieMedico(ferie.id)}
                                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  aria-label="Elimina ferie"
                                  title="Elimina ferie"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-md border border-dashed border-amber-200 bg-white p-3 text-sm text-muted-foreground">
                              Nessun periodo ferie inserito.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                          <Euro className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">Listino prezzi</h3>
                          <p className="text-sm text-muted-foreground">
                            Aggiungi prestazioni di {medicoSelezionato.specialita}, prezzo e compenso medico specifico.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {listinoMedicoModificaAttiva ? (
                          <>
                            <Badge variant="secondary" className="h-9 px-3">
                              Modifica attiva
                            </Badge>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={annullaModificaListinoMedico}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" />
                              Annulla
                            </Button>
                            <Button type="button" size="sm" onClick={salvaModificaListinoMedico} className="gap-2">
                              <Check className="h-4 w-4" />
                              Salva
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={sbloccaModificaListinoMedico}
                            className="gap-2"
                          >
                            <Unlock className="h-4 w-4" />
                            Modifica
                          </Button>
                        )}
                        <Badge variant="secondary" className="w-fit">
                          {listinoMedico.length} voci
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_120px_140px_180px_150px] 2xl:grid-cols-[minmax(320px,1fr)_120px_140px_190px_150px_auto]">
                      <Field label="Prestazione">
                        <Popover
                          open={prestazioneListinoOpen}
                          onOpenChange={(open) => {
                            setPrestazioneListinoOpen(open);
                            if (open) setRicercaPrestazioniMedico("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={prestazioneListinoOpen}
                              disabled={!listinoMedicoModificaAttiva || prestazioniDisponibiliListino.length === 0}
                              className="w-full justify-between font-normal"
                            >
                              <span className="truncate">
                                {prestazioneNuovoListino?.nome ?? "Nessuna prestazione disponibile"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="p-0"
                            style={{ width: "var(--radix-popover-trigger-width)" }}
                          >
                            <Command shouldFilter={false}>
                              <CommandInput
                                value={ricercaPrestazioniMedico}
                                onValueChange={setRicercaPrestazioniMedico}
                                placeholder={`Cerca prestazione di ${medicoSelezionato.specialita}`}
                              />
                              <CommandList>
                                <CommandEmpty>Nessuna prestazione trovata</CommandEmpty>
                                {prestazioniDisponibiliListinoFiltrate.map((prestazione) => (
                                  <CommandItem
                                    key={prestazione.id}
                                    value={`${prestazione.nome} ${prestazione.specialita}`}
                                    onSelect={() => {
                                      setNuovoListino((corrente) => ({
                                        ...corrente,
                                        prestazioneId: prestazione.id,
                                        durata: String(prestazione.durata),
                                      }));
                                      setPrestazioneListinoOpen(false);
                                      setRicercaPrestazioniMedico("");
                                    }}
                                  >
                                    <Check
                                      className={`h-4 w-4 ${
                                        nuovoListino.prestazioneId === prestazione.id ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    <span className="truncate">{prestazione.nome}</span>
                                  </CommandItem>
                                ))}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </Field>
                      <Field label="Durata">
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={nuovoListino.durata}
                          disabled={!listinoMedicoModificaAttiva}
                          onChange={(event) =>
                            setNuovoListino((corrente) => ({ ...corrente, durata: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Importo">
                        <Input
                          type="number"
                          min={1}
                          step={5}
                          value={nuovoListino.prezzo}
                          disabled={!listinoMedicoModificaAttiva}
                          onChange={(event) =>
                            setNuovoListino((corrente) => ({ ...corrente, prezzo: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Tipo compenso">
                        <Select
                          value={nuovoListino.compensoTipo}
                          disabled={!listinoMedicoModificaAttiva}
                          onValueChange={(compensoTipo: CompensoTipo) =>
                            setNuovoListino((corrente) => ({
                              ...corrente,
                              compensoTipo,
                              compensoValore:
                                compensoTipo === "percentuale"
                                  ? String(limitaPercentuale(Number(corrente.compensoValore) || 0))
                                  : corrente.compensoValore,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentuale">Percentuale</SelectItem>
                            <SelectItem value="fisso">Fisso</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={nuovoListino.compensoTipo === "percentuale" ? "Compenso %" : "Compenso fisso"}>
                        <Input
                          type="number"
                          min={0}
                          max={nuovoListino.compensoTipo === "percentuale" ? 100 : undefined}
                          step={nuovoListino.compensoTipo === "percentuale" ? 1 : 5}
                          value={nuovoListino.compensoValore}
                          disabled={!listinoMedicoModificaAttiva}
                          onChange={(event) =>
                            setNuovoListino((corrente) => ({ ...corrente, compensoValore: event.target.value }))
                          }
                        />
                      </Field>
                      <div className="flex items-end md:col-span-2 xl:col-span-5 2xl:col-span-1">
                        <Button
                          type="button"
                          onClick={aggiungiListino}
                          disabled={!listinoMedicoModificaAttiva || !prestazioneNuovoListino}
                          className="w-full gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Aggiungi
                        </Button>
                      </div>
                    </div>

                    {listinoMedico.length > 0 ? (
                      <div className="mt-4 rounded-md border border-border">
                        <Table className="min-w-[1240px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[260px]">Prestazione</TableHead>
                              <TableHead className="w-32">Durata</TableHead>
                              <TableHead className="w-36">Importo</TableHead>
                              <TableHead className="min-w-[240px]">Compenso</TableHead>
                              <TableHead className="min-w-[180px] whitespace-nowrap">Quota medico</TableHead>
                              <TableHead className="min-w-[160px] whitespace-nowrap">Netto studio</TableHead>
                              <TableHead className="w-16">Azioni</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {listinoMedico.map((listino) => (
                              <TableRow key={listino.id}>
                                <TableCell className="min-w-[260px] font-medium">
                                  {nomePrestazione(listino.prestazioneId)}
                                </TableCell>
                                <TableCell className="w-32">
                                  <Input
                                    type="number"
                                    min={5}
                                    step={5}
                                    value={listino.durata}
                                    disabled={!listinoMedicoModificaAttiva}
                                    onChange={(event) =>
                                      aggiornaDurataListino(listino.id, Number(event.target.value) || 0)
                                    }
                                  />
                                </TableCell>
                                <TableCell className="w-36">
                                  <Input
                                    type="number"
                                    min={1}
                                    step={5}
                                    value={listino.prezzo}
                                    disabled={!listinoMedicoModificaAttiva}
                                    onChange={(event) =>
                                      aggiornaPrezzo(listino.id, Number(event.target.value) || 0)
                                    }
                                  />
                                </TableCell>
                                <TableCell className="min-w-[240px]">
                                  <div className="grid grid-cols-[1fr_90px] gap-2">
                                    <Select
                                      value={listino.compensoTipo}
                                      disabled={!listinoMedicoModificaAttiva}
                                      onValueChange={(compensoTipo: CompensoTipo) =>
                                        aggiornaCompensoTipo(listino.id, compensoTipo)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percentuale">%</SelectItem>
                                        <SelectItem value="fisso">Fisso</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={listino.compensoTipo === "percentuale" ? 100 : undefined}
                                      step={listino.compensoTipo === "percentuale" ? 1 : 5}
                                      value={listino.compensoValore}
                                      disabled={!listinoMedicoModificaAttiva}
                                      onChange={(event) =>
                                        aggiornaCompensoValore(listino.id, Number(event.target.value) || 0)
                                      }
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-[180px]">
                                  <Badge variant="secondary" className="whitespace-nowrap">
                                    {listino.compensoTipo === "percentuale"
                                      ? `${listino.compensoValore}%`
                                      : "Fisso"} · {valuta.format(quotaMedico(listino))}
                                  </Badge>
                                </TableCell>
                                <TableCell className="min-w-[160px]">
                                  <Badge className="whitespace-nowrap border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
                                    {valuta.format(nettoStudio(listino))}
                                  </Badge>
                                </TableCell>
                                <TableCell className="w-16">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={!listinoMedicoModificaAttiva}
                                    onClick={() => eliminaListino(listino.id)}
                                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`Elimina ${nomePrestazione(listino.prestazioneId)}`}
                                    title="Elimina voce listino"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                        Listino vuoto. Aggiungi una prestazione per costruire il tariffario di questo medico.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Nessun medico inserito.
                </div>
              )}
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="compensi" className="space-y-4">
          <SettingsPanel
            title="Compensi"
            description="Calcola il compenso dei medici nel periodo selezionato usando prenotazioni agenda e listini."
            icon={<Euro className="h-5 w-5" />}
          >
            <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-[160px_160px_260px_minmax(180px,1fr)]">
              <Field label="Dal">
                <Input
                  type="date"
                  value={periodoCompensi.dal}
                  onChange={(event) =>
                    setPeriodoCompensi((corrente) => ({ ...corrente, dal: event.target.value }))
                  }
                />
              </Field>
              <Field label="Al">
                <Input
                  type="date"
                  value={periodoCompensi.al}
                  onChange={(event) =>
                    setPeriodoCompensi((corrente) => ({ ...corrente, al: event.target.value }))
                  }
                />
              </Field>
              <Field label="Medico">
                <Select value={medicoCompensiFiltro} onValueChange={setMedicoCompensiFiltro}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti i medici</SelectItem>
                    {medici.map((medico) => (
                      <SelectItem key={medico.id} value={medico.id}>
                        {medico.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end justify-start xl:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPeriodoCompensi({ dal: "2026-07-01", al: "2026-07-31" });
                    setMedicoCompensiFiltro("tutti");
                  }}
                  className="w-full xl:w-auto"
                >
                  Luglio demo
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Export dettaglio agenda</h3>
                <p className="text-xs text-muted-foreground">
                  Esporta solo prestazioni eseguite e fatturate, con opzioni prima del download.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => apriExportCompensi("pdf")}
                  disabled={prenotazioniCompensi.length === 0}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => apriExportCompensi("csv")}
                  disabled={prenotazioniCompensi.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CompensoMetric
                label="Eseguite e fatturate"
                value={String(totaliCompensi.prenotazioni)}
                detail={`${totaliCompensi.minuti} min agenda · ${prenotazioniEscluseDaiCompensi.length} escluse`}
              />
              <CompensoMetric
                label="Incasso"
                value={valuta.format(totaliCompensi.incasso)}
                detail="Solo fatturato eseguito"
              />
              <CompensoMetric
                label="Compensi medici"
                value={valuta.format(totaliCompensi.compenso)}
                detail={`Quote da riconoscere · ${formattaPercentualeSuIncasso(
                  totaliCompensi.compenso,
                  totaliCompensi.incasso,
                )}`}
              />
              <CompensoMetric
                label="Netto studio"
                value={valuta.format(totaliCompensi.netto)}
                detail={`Dopo compensi · ${formattaPercentualeSuIncasso(totaliCompensi.netto, totaliCompensi.incasso)}`}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[440px_minmax(0,1fr)]">
              <div className="rounded-md border border-border bg-white">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Riepilogo medici</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medico</TableHead>
                        <TableHead>Visite</TableHead>
                        <TableHead>Compenso</TableHead>
                        <TableHead>Netto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riepilogoCompensiMedici.length > 0 ? (
                        riepilogoCompensiMedici.map((riga) => (
                          <TableRow key={riga.medico.id}>
                            <TableCell className="min-w-[180px]">
                              <p className="font-medium text-foreground">{riga.medico.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {riga.medico.specialita}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{riga.prenotazioni}</div>
                              <div className="text-xs text-muted-foreground">{riga.minuti} min</div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-semibold text-foreground">
                              {valuta.format(riga.compenso)}
                            </TableCell>
                            <TableCell>
                              <Badge className="whitespace-nowrap border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
                                {valuta.format(riga.netto)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            Nessun compenso nel periodo selezionato.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="rounded-md border border-border bg-white">
                <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Dettaglio compensi maturati</h3>
                    <p className="text-xs text-muted-foreground">
                      Conteggia solo appuntamenti eseguiti e fatturati.
                    </p>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {prenotazioniCompensi.length} su {prenotazioniPeriodoCompensi.length} righe
                  </Badge>
                </div>
                {prenotazioniEscluseDaiCompensi.length > 0 && (
                  <div className="border-b border-border bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {prenotazioniEscluseDaiCompensi.length} prenotazioni filtrate non maturano compenso perche non sono
                    ancora eseguite o fatturate.
                  </div>
                )}
                <div className="overflow-x-auto">
                  <Table className="min-w-[1180px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Paziente</TableHead>
                        <TableHead>Medico</TableHead>
                        <TableHead>Prestazione</TableHead>
                        <TableHead>Fatturato</TableHead>
                        <TableHead>Compenso</TableHead>
                        <TableHead>Netto studio</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Fattura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prenotazioniCompensi.length > 0 ? (
                        prenotazioniCompensi.map(({ prenotazione, medico, prestazione, listino, incasso, quota, netto }) => (
                          <TableRow key={prenotazione.id}>
                            <TableCell className="whitespace-nowrap">
                              <p className="font-medium text-foreground">{formattaData(prenotazione.data)}</p>
                              <p className="text-xs text-muted-foreground">{prenotazione.ora}</p>
                            </TableCell>
                            <TableCell className="min-w-[160px] font-medium">{prenotazione.paziente}</TableCell>
                            <TableCell className="min-w-[180px]">{medico.nome}</TableCell>
                            <TableCell className="min-w-[220px]">
                              <p className="font-medium text-foreground">{prestazione.nome}</p>
                              <p className="text-xs text-muted-foreground">{listino.durata} min</p>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <p className="font-medium text-foreground">{valuta.format(incasso)}</p>
                              {incasso !== listino.prezzo && (
                                <p className="text-xs text-muted-foreground">
                                  listino {valuta.format(listino.prezzo)}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="whitespace-nowrap">
                                {listino.compensoTipo === "percentuale" ? `${listino.compensoValore}%` : "Fisso"} ·{" "}
                                {valuta.format(quota)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="whitespace-nowrap border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
                                {valuta.format(netto)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  prenotazione.stato === "eseguita"
                                    ? "whitespace-nowrap border-green-200 bg-green-100 text-green-700 hover:bg-green-100"
                                    : "whitespace-nowrap border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100"
                                }
                              >
                                {LABEL_STATO_PRENOTAZIONE[prenotazione.stato]}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <Badge className="whitespace-nowrap border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
                                {prenotazione.numeroFattura ?? "Fatturata"}
                              </Badge>
                              {prenotazione.dataFattura && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formattaData(prenotazione.dataFattura)}
                                </p>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                            Nessuna prestazione eseguita e fatturata nel periodo.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </SettingsPanel>
        </TabsContent>

      </Tabs>
        </>
      )}

      <Dialog open={exportCompensiOpen} onOpenChange={setExportCompensiOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Export {formatoExportCompensi.toUpperCase()} compensi</DialogTitle>
            <DialogDescription>
              Le opzioni vengono applicate solo alle prestazioni eseguite e fatturate nel periodo filtrato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              {prenotazioniCompensi.length} eseguite e fatturate · {prenotazioniEscluseDaiCompensi.length} escluse ·{" "}
              {medicoCompensiFiltro === "tutti" ? "tutti i medici" : "medico selezionato"}
            </div>

            <div className="space-y-3">
              <ExportOption
                id="export-oscura-pazienti"
                checked={opzioniExportCompensi.oscuraPazienti}
                label="Oscura nomi pazienti"
                description="Dalla seconda lettera in poi usa asterischi, ad esempio G***** C****."
                onCheckedChange={(checked) => aggiornaOpzioneExportCompensi("oscuraPazienti", checked)}
              />
              <ExportOption
                id="export-totale-prenotazioni"
                checked={opzioniExportCompensi.mostraTotalePrenotazioni}
                label="Mostra totale prestazioni conteggiate"
                description="Inserisce il numero di visite eseguite e fatturate nel riepilogo export."
                onCheckedChange={(checked) => aggiornaOpzioneExportCompensi("mostraTotalePrenotazioni", checked)}
              />
              <ExportOption
                id="export-incasso"
                checked={opzioniExportCompensi.mostraIncasso}
                label="Mostra incasso / fatturato"
                description="Mostra importi visita e totale incassato nel riepilogo."
                onCheckedChange={(checked) => aggiornaOpzioneExportCompensi("mostraIncasso", checked)}
              />
              <ExportOption
                id="export-compensi"
                checked={opzioniExportCompensi.mostraCompensi}
                label="Mostra compensi medici"
                description="Mostra quota medico per prestazione e totale compensi."
                onCheckedChange={(checked) => aggiornaOpzioneExportCompensi("mostraCompensi", checked)}
              />
              <ExportOption
                id="export-netto-studio"
                checked={opzioniExportCompensi.mostraNettoStudio}
                label="Mostra netto studio"
                description="Mostra il netto dopo i compensi, sia nel dettaglio sia nel riepilogo."
                onCheckedChange={(checked) => aggiornaOpzioneExportCompensi("mostraNettoStudio", checked)}
              />
              <ExportOption
                id="export-separa-medici"
                checked={medicoCompensiFiltro === "tutti" && opzioniExportCompensi.separaMedici}
                disabled={medicoCompensiFiltro !== "tutti"}
                label="Separa i medici"
                description="Con più medici: CSV scarica file distinti e PDF crea sezioni separate."
                onCheckedChange={(checked) => aggiornaOpzioneExportCompensi("separaMedici", checked)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpzioniExportCompensi(OPZIONI_EXPORT_COMPENSI_DEFAULT)}
            >
              Ripristina flag
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setExportCompensiOpen(false)}>
                Annulla
              </Button>
              <Button type="button" onClick={confermaExportCompensi} className="gap-2">
                <Download className="h-4 w-4" />
                Esporta
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(medicoDaEliminare)}
        onOpenChange={(open) => {
          if (!open) setMedicoDaEliminareId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo medico?</AlertDialogTitle>
            <AlertDialogDescription>
              {medicoDaEliminare
                ? `${medicoDaEliminare.nome} verra rimosso dall'elenco medici. Verranno eliminate anche le righe del suo listino prezzi.`
                : "Il medico verra rimosso dall'elenco medici."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={eliminaMedico} className="bg-destructive text-destructive-foreground">
              Elimina medico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingsPanel({
  title,
  description,
  icon,
  actions,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
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

function ExportOption({
  id,
  checked,
  disabled,
  label,
  description,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-md border border-border p-3 ${disabled ? "opacity-60" : ""}`}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CompensoMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ImportExportActions({
  onExport,
  onImportClick,
}: {
  onExport: () => void;
  onImportClick: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onExport} className="gap-2">
        <Download className="h-4 w-4" />
        Esporta
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onImportClick} className="gap-2">
        <Upload className="h-4 w-4" />
        Importa
      </Button>
    </div>
  );
}

function PrestazioniUnlockAction({
  editing,
  onUnlock,
}: {
  editing: boolean;
  onUnlock: () => void;
}) {
  return editing ? (
    <Badge variant="secondary" className="h-9 px-3">
      Modifica attiva
    </Badge>
  ) : (
    <Button type="button" variant="outline" size="sm" onClick={onUnlock} className="gap-2">
      <Unlock className="h-4 w-4" />
      Modifica
    </Button>
  );
}

function PrestazioniSaveBar({
  editing,
  onCancel,
  onSave,
}: {
  editing: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!editing) return null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-foreground">Modifiche prestazioni in bozza.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="gap-2">
          <X className="h-4 w-4" />
          Annulla
        </Button>
        <Button type="button" onClick={onSave} className="gap-2">
          <Check className="h-4 w-4" />
          Salva modifiche
        </Button>
      </div>
    </div>
  );
}
