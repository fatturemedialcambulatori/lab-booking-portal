import React from "react";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  Download,
  Euro,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Stethoscope,
  Tags,
  Trash2,
  Upload,
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

type Prestazione = {
  id: string;
  nome: string;
  specialita: string;
  durata: number;
  attiva: boolean;
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

type DisponibilitaPerSedeMedico = Record<SedeMedicoId, string[]>;

type Medico = {
  id: string;
  nome: string;
  specialita: string;
  agendaAperta: boolean;
  disponibilita: string[];
  disponibilitaPerSede?: Partial<DisponibilitaPerSedeMedico>;
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

type FormatoExportCompensi = "pdf" | "csv" | "excel";

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
};

type SettingsSaveState = "loading" | "saving" | "saved" | "error";

type Specialita = {
  id: string;
  nome: string;
  attiva: boolean;
};

type ExcelRow = Record<string, unknown>;

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

const SEDI_MEDICO: Array<{ id: SedeMedicoId; label: string; sigla: string }> = [
  { id: "modena", label: "Modena", sigla: "MO" },
  { id: "sassuolo", label: "Sassuolo", sigla: "SASS" },
];

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

const normalizzaDisponibilitaPerSede = (
  medico: Pick<Medico, "disponibilita" | "disponibilitaPerSede">,
): DisponibilitaPerSedeMedico => ({
  modena: medico.disponibilitaPerSede?.modena ?? medico.disponibilita ?? [],
  sassuolo: medico.disponibilitaPerSede?.sassuolo ?? [],
});

const unisciDisponibilitaSedi = (disponibilitaPerSede: DisponibilitaPerSedeMedico) =>
  Array.from(new Set(SEDI_MEDICO.flatMap((sede) => disponibilitaPerSede[sede.id])));

const normalizzaMedico = (medico: Medico): Medico => {
  const disponibilitaPerSede = normalizzaDisponibilitaPerSede(medico);

  return {
    ...medico,
    disponibilita: unisciDisponibilitaSedi(disponibilitaPerSede),
    disponibilitaPerSede,
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

const trovaValore = (row: ExcelRow, chiavi: string[]) => {
  const chiaviNormalizzate = chiavi.map(normalizzaTesto);
  const entry = Object.entries(row).find(([key]) => chiaviNormalizzate.includes(normalizzaTesto(key)));
  return entry?.[1];
};

const leggiTesto = (row: ExcelRow, chiavi: string[], fallback = "") => {
  const valore = trovaValore(row, chiavi);
  return valore === undefined || valore === null ? fallback : String(valore).trim();
};

const leggiNumero = (row: ExcelRow, chiavi: string[], fallback = 0) => {
  const valore = trovaValore(row, chiavi);
  if (typeof valore === "number") return Number.isFinite(valore) ? valore : fallback;
  const numero = Number(String(valore ?? "").replace(",", "."));
  return Number.isFinite(numero) ? numero : fallback;
};

const leggiBooleano = (row: ExcelRow, chiavi: string[], fallback = true) => {
  const valore = trovaValore(row, chiavi);
  if (typeof valore === "boolean") return valore;
  const testo = normalizzaTesto(String(valore ?? ""));
  if (["si", "sì", "true", "1", "attivo", "aperta", "aperto"].includes(testo)) return true;
  if (["no", "false", "0", "inattivo", "chiusa", "chiuso"].includes(testo)) return false;
  return fallback;
};

const leggiGiorniDisponibilita = (row: ExcelRow, chiavi: string[], fallback: string[] = []) => {
  const testo = leggiTesto(row, chiavi);
  if (!testo) return fallback;

  return testo
    .split(/[;,|]/)
    .map((giorno) => giorno.trim())
    .filter(Boolean);
};

const leggiCompensoTipo = (row: ExcelRow) => {
  const valore = normalizzaTesto(leggiTesto(row, ["compensoTipo", "tipo compenso", "tipo", "compenso tipo"], "percentuale"));
  return valore.startsWith("f") ? "fisso" : "percentuale";
};

const righeFoglio = (workbook: XLSX.WorkBook, nomeFoglio: string) => {
  const nome = workbook.SheetNames.find((sheetName) => normalizzaTesto(sheetName) === normalizzaTesto(nomeFoglio));
  if (!nome) return null;
  return XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[nome], { defval: "" });
};

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

const MEDICI_INIZIALI: Medico[] = [
  {
    id: "rossi",
    nome: "Dott. Marco Rossi",
    specialita: "Cardiologia",
    agendaAperta: true,
    disponibilita: ["Lun", "Mer", "Ven"],
    disponibilitaPerSede: { modena: ["Lun", "Mer"], sassuolo: ["Ven"] },
  },
  {
    id: "bianchi",
    nome: "Dott.ssa Laura Bianchi",
    specialita: "Diagnostica",
    agendaAperta: true,
    disponibilita: ["Mar", "Gio"],
    disponibilitaPerSede: { modena: ["Mar"], sassuolo: ["Gio"] },
  },
  {
    id: "verdi",
    nome: "Dott. Paolo Verdi",
    specialita: "Dermatologia",
    agendaAperta: false,
    disponibilita: ["Lun", "Gio"],
    disponibilitaPerSede: { modena: ["Gio"], sassuolo: ["Lun"] },
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

export function AdminSettings() {
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const skipInitialSettingsSaveRef = React.useRef(true);
  const [specialita, setSpecialita] = React.useState(SPECIALITA_INIZIALI);
  const [prestazioni, setPrestazioni] = React.useState(PRESTAZIONI_INIZIALI);
  const [medici, setMedici] = React.useState(MEDICI_INIZIALI);
  const [listini, setListini] = React.useState(LISTINI_INIZIALI);
  const [settingsCanSave, setSettingsCanSave] = React.useState(false);
  const [settingsSaveState, setSettingsSaveState] = React.useState<SettingsSaveState>("loading");
  const [selectedSpecialita, setSelectedSpecialita] = React.useState(SPECIALITA_INIZIALI[0]?.nome ?? "");
  const [selectedMedicoId, setSelectedMedicoId] = React.useState(MEDICI_INIZIALI[0]?.id ?? "");
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

  React.useEffect(() => {
    let active = true;

    const caricaImpostazioni = async () => {
      try {
        const response = await fetch("/api/admin-settings");
        if (!response.ok) throw new Error("Impostazioni non disponibili");

        const data: unknown = await response.json();
        if (!active) return;

        if (isAdminSettingsData(data)) {
          setSpecialita(data.specialita);
          setPrestazioni(data.prestazioni);
          setMedici(data.medici.map(normalizzaMedico));
          setListini(data.listini);
          setSelectedSpecialita(data.specialita[0]?.nome ?? data.prestazioni[0]?.specialita ?? "");
          setSelectedMedicoId(data.medici[0]?.id ?? "");
        }

        setSettingsSaveState("saved");
        setSettingsCanSave(true);
      } catch {
        if (!active) return;
        setSettingsSaveState("error");
        mostraNotifica("Impostazioni non collegate al DB. Controlla DATABASE_URL su Vercel.", "destructive");
      }
    };

    void caricaImpostazioni();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!settingsCanSave) return;

    if (skipInitialSettingsSaveRef.current) {
      skipInitialSettingsSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const payload: AdminSettingsData = {
      specialita,
      prestazioni,
      medici,
      listini,
    };

    setSettingsSaveState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      void fetch("/api/admin-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Salvataggio non riuscito");
          setSettingsSaveState("saved");
        })
        .catch(() => {
          setSettingsSaveState("error");
          mostraNotifica("Salvataggio impostazioni non riuscito. Verifica Supabase e Vercel.", "destructive");
        });
    }, 700);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [settingsCanSave, specialita, prestazioni, medici, listini]);

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

  const prestazioniFiltrate = React.useMemo(
    () => filtraPrestazioni(prestazioni, ricercaPrestazioniApplicata),
    [filtraPrestazioni, prestazioni, ricercaPrestazioniApplicata],
  );

  const prestazioniSpecialita = React.useMemo(
    () => prestazioni.filter((prestazione) => stessaSpecialita(prestazione.specialita, selectedSpecialita)),
    [prestazioni, selectedSpecialita],
  );

  const medicoSelezionato = medici.find((medico) => medico.id === selectedMedicoId) ?? medici[0];
  const medicoDaEliminare = medici.find((medico) => medico.id === medicoDaEliminareId) ?? null;
  const disponibilitaPerSedeMedicoSelezionato = medicoSelezionato
    ? normalizzaDisponibilitaPerSede(medicoSelezionato)
    : creaDisponibilitaPerSedeVuota();
  const datiFatturazioneMedicoSelezionato: DatiFatturazioneMedico = {
    ...DATI_FATTURAZIONE_MEDICO_VUOTI,
    ...medicoSelezionato?.datiFatturazione,
  };

  const prestazioniDelMedico = React.useMemo(() => {
    if (!medicoSelezionato) return [];

    return prestazioni.filter(
      (prestazione) =>
        prestazione.attiva && stessaSpecialita(prestazione.specialita, medicoSelezionato.specialita),
    );
  }, [medicoSelezionato, prestazioni]);

  const listinoMedico = React.useMemo(
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

  const aggiungiSpecialita = () => {
    const nome = nuovaSpecialita.trim();
    if (!nome) return;

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

    setPrestazioni((correnti) => [
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
    const specialitaPrestazione = nuovaPrestazione.specialita || specialitaDisponibili[0] || "Generale";

    setPrestazioni((correnti) => [
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
    setPrestazioni((correnti) =>
      correnti.map((prestazione) =>
        prestazione.id === id ? { ...prestazione, [campo]: valore } : prestazione,
      ),
    );
  };

  const eliminaPrestazione = (id: string) => {
    setPrestazioni((correnti) => correnti.filter((prestazione) => prestazione.id !== id));
    setListini((correnti) => correnti.filter((listino) => listino.prestazioneId !== id));
  };

  const aggiornaDisponibilitaSede = (
    medicoId: string,
    sedeId: SedeMedicoId,
    giorno: string,
    attivo: boolean,
  ) => {
    setMedici((correnti) =>
      correnti.map((medico) => {
        if (medico.id !== medicoId) return medico;

        const disponibilitaPerSede = normalizzaDisponibilitaPerSede(medico);
        const giorniSede = disponibilitaPerSede[sedeId];
        const prossimiGiorniSede = attivo
          ? Array.from(new Set([...giorniSede, giorno]))
          : giorniSede.filter((g) => g !== giorno);
        const prossimaDisponibilitaPerSede = {
          ...disponibilitaPerSede,
          [sedeId]: prossimiGiorniSede,
        };

        return {
          ...medico,
          disponibilita: unisciDisponibilitaSedi(prossimaDisponibilitaPerSede),
          disponibilitaPerSede: prossimaDisponibilitaPerSede,
        };
      }),
    );
  };

  const impostaTutteLeAgende = (aperte: boolean) => {
    setMedici((correnti) => correnti.map((medico) => ({ ...medico, agendaAperta: aperte })));
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
        datiFatturazione: DATI_FATTURAZIONE_MEDICO_VUOTI,
      },
    ]);
    setSelectedMedicoId(id);
    setNuovoMedico((corrente) => ({ ...corrente, nome: "" }));
  };

  const eliminaMedico = () => {
    if (!medicoDaEliminare) return;

    const medicoId = medicoDaEliminare.id;
    const prossimiMedici = medici.filter((medico) => medico.id !== medicoId);

    setMedici(prossimiMedici);
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
    setMedici((correnti) =>
      correnti.map((medico) => (medico.id === id ? { ...medico, [campo]: valore } : medico)),
    );
  };

  const aggiornaSpecialitaMedico = (id: string, nuovaSpecialitaMedico: string) => {
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

  const aggiungiListino = () => {
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

    setListini((correnti) => {
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
    setListini((correnti) =>
      correnti.map((listino) => (listino.id === id ? { ...listino, durata } : listino)),
    );
  };

  const aggiornaPrezzo = (id: string, prezzo: number) => {
    setListini((correnti) =>
      correnti.map((listino) => (listino.id === id ? { ...listino, prezzo } : listino)),
    );
  };

  const aggiornaCompensoTipo = (id: string, compensoTipo: CompensoTipo) => {
    setListini((correnti) =>
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
    setListini((correnti) =>
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

  const nomeFoglioExcel = (nome: string, index: number) =>
    `${index + 1}-${nome}`.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Medico ${index + 1}`;

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
    formato: "excel" | "testo",
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
            : formato === "excel"
              ? listino.compensoValore
              : formattaNumeroCsv(listino.compensoValore),
        Stato: LABEL_STATO_PRENOTAZIONE[prenotazione.stato],
        Fatturazione: prenotazione.fatturata ? "Fatturata" : "Non fatturata",
        "Numero fattura": prenotazione.numeroFattura ?? "",
      };

      if (opzioni.mostraIncasso) riga["Importo fatturato"] = formato === "excel" ? incasso : formattaNumeroCsv(incasso);
      if (opzioni.mostraCompensi) riga["Quota medico"] = formato === "excel" ? quota : formattaNumeroCsv(quota);
      if (opzioni.mostraNettoStudio) riga["Netto studio"] = formato === "excel" ? netto : formattaNumeroCsv(netto);

      return riga;
    });

  const costruisciRigheRiepilogoExport = (gruppi: GruppoExportCompensi[], formato: "excel" | "testo") =>
    gruppi.map((gruppo) => {
      const totali = calcolaTotaliCompensi(gruppo.righe);
      const riga: RigaExportCompenso = { Medico: gruppo.nome };
      if (opzioniExportCompensi.mostraTotalePrenotazioni) riga["Eseguite e fatturate"] = totali.prenotazioni;
      if (opzioniExportCompensi.mostraIncasso) {
        riga["Incasso/Fatturato"] = formato === "excel" ? totali.incasso : formattaNumeroCsv(totali.incasso);
      }
      if (opzioniExportCompensi.mostraCompensi) {
        riga["Compensi medici"] = formato === "excel" ? totali.compenso : formattaNumeroCsv(totali.compenso);
      }
      if (opzioniExportCompensi.mostraNettoStudio) {
        riga["Netto studio"] = formato === "excel" ? totali.netto : formattaNumeroCsv(totali.netto);
      }
      return riga;
    });

  const esportaDettaglioCompensiExcel = () => {
    if (prenotazioniCompensi.length === 0) {
      mostraNotifica(
        "Nessuna prestazione eseguita e fatturata da esportare con il filtro corrente.",
        "destructive",
      );
      return;
    }

    const gruppi = costruisciGruppiExportCompensi();
    const workbook = XLSX.utils.book_new();
    if (mostraRiepilogoExport) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(costruisciRigheRiepilogoExport(gruppi, "excel")),
        "Riepilogo",
      );
    }

    const colonne = colonneExportCompensi(opzioniExportCompensi);
    gruppi.forEach((gruppo, index) => {
      const worksheet = XLSX.utils.json_to_sheet(
        costruisciRigheExportCompensi(gruppo.righe, opzioniExportCompensi, "excel"),
        { header: colonne },
      );
      XLSX.utils.book_append_sheet(workbook, worksheet, nomeFoglioExcel(gruppo.nome, index));
    });

    XLSX.writeFile(workbook, nomeFileCompensi("xlsx"));
    mostraNotifica(
      gruppi.length > 1 ? "Excel esportato con un foglio separato per medico." : "Excel dettaglio compensi esportato.",
    );
  };

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
      const righe = costruisciRigheExportCompensi(gruppo.righe, opzioniExportCompensi, "testo");
      const righeRiepilogo = mostraRiepilogoExport ? costruisciRigheRiepilogoExport([gruppo], "testo") : [];
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
        const righe = costruisciRigheExportCompensi(gruppo.righe, opzioniExportCompensi, "testo");
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
    if (formatoExportCompensi === "excel") esportaDettaglioCompensiExcel();
    setExportCompensiOpen(false);
  };

  const esportaExcel = () => {
    const workbook = XLSX.utils.book_new();
    const listaSpecialita = specialitaDisponibili.map((nome) => {
      const configurazione = specialita.find((item) => stessaSpecialita(item.nome, nome));
      return {
        id: configurazione?.id ?? slugId("specialita", nome),
        nome,
        attiva: configurazione?.attiva ?? true,
      };
    });
    const listaMedici = medici.map((medico) => {
      const datiFatturazione = {
        ...DATI_FATTURAZIONE_MEDICO_VUOTI,
        ...medico.datiFatturazione,
      };
      const disponibilitaPerSede = normalizzaDisponibilitaPerSede(medico);

      return {
        id: medico.id,
        nome: medico.nome,
        specialita: medico.specialita,
        agendaAperta: medico.agendaAperta,
        disponibilita: unisciDisponibilitaSedi(disponibilitaPerSede).join(", "),
        disponibilitaModena: disponibilitaPerSede.modena.join(", "),
        disponibilitaSassuolo: disponibilitaPerSede.sassuolo.join(", "),
        intestatarioFatturazione: datiFatturazione.intestatario,
        partitaIva: datiFatturazione.partitaIva,
        codiceFiscale: datiFatturazione.codiceFiscale,
        indirizzoFatturazione: datiFatturazione.indirizzo,
        cap: datiFatturazione.cap,
        citta: datiFatturazione.citta,
        provincia: datiFatturazione.provincia,
        emailFatturazione: datiFatturazione.emailFatturazione,
        pec: datiFatturazione.pec,
        codiceSdi: datiFatturazione.codiceSdi,
        regimeFiscale: datiFatturazione.regimeFiscale,
        noteFatturazione: datiFatturazione.noteFatturazione,
      };
    });
    const listaPrestazioni = prestazioni.map((prestazione) => ({
      id: prestazione.id,
      nome: prestazione.nome,
      specialita: prestazione.specialita,
      durata: prestazione.durata,
      attiva: prestazione.attiva,
    }));
    const listaListini = listini.map((listino) => {
      const medico = medici.find((item) => item.id === listino.medicoId);
      const prestazione = prestazioni.find((item) => item.id === listino.prestazioneId);
      return {
        id: listino.id,
        medicoId: listino.medicoId,
        medico: medico?.nome ?? "",
        prestazioneId: listino.prestazioneId,
        prestazione: prestazione?.nome ?? "",
        specialita: prestazione?.specialita ?? medico?.specialita ?? "",
        durata: listino.durata,
        importo: listino.prezzo,
        compensoTipo: listino.compensoTipo,
        compensoValore: listino.compensoValore,
        quotaMedico: quotaMedico(listino),
        nettoStudio: nettoStudio(listino),
      };
    });

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(listaMedici), "Medici");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(listaSpecialita), "Specialita");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(listaPrestazioni), "Prestazioni");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(listaListini), "Listini");
    XLSX.writeFile(workbook, `m-medical-configurazione-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const importaExcel = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const righeSpecialita = righeFoglio(workbook, "Specialita");
    const righePrestazioni = righeFoglio(workbook, "Prestazioni");
    const righeMedici = righeFoglio(workbook, "Medici");
    const righeListini = righeFoglio(workbook, "Listini");

    const prossimeSpecialita = righeSpecialita
      ? righeSpecialita
          .map((row, index) => {
            const nome = leggiTesto(row, ["nome", "specialita", "specialità"]);
            if (!nome) return null;
            return {
              id: leggiTesto(row, ["id"], slugId("specialita", nome, index)),
              nome,
              attiva: leggiBooleano(row, ["attiva", "stato"], true),
            } satisfies Specialita;
          })
          .filter((item): item is Specialita => Boolean(item))
      : specialita;

    const prossimePrestazioni = righePrestazioni
      ? righePrestazioni
          .map((row, index) => {
            const nome = leggiTesto(row, ["nome", "prestazione"]);
            if (!nome) return null;
            const specialitaPrestazione = leggiTesto(row, ["specialita", "specialità"], "Generale");
            return {
              id: leggiTesto(row, ["id", "prestazioneId", "prestazione id"], slugId("prestazione", nome, index)),
              nome,
              specialita: specialitaPrestazione,
              durata: Math.max(5, leggiNumero(row, ["durata", "durata base"], 30)),
              attiva: leggiBooleano(row, ["attiva", "stato"], true),
            } satisfies Prestazione;
          })
          .filter((item): item is Prestazione => Boolean(item))
      : prestazioni;

    const prossimiMedici = righeMedici
      ? righeMedici
          .map((row, index): Medico | null => {
            const nome = leggiTesto(row, ["nome", "medico"]);
            if (!nome) return null;
            const disponibilitaGenerale = leggiGiorniDisponibilita(row, [
              "disponibilita",
              "disponibilità",
              "giorni",
            ]);
            const disponibilitaPerSede: DisponibilitaPerSedeMedico = {
              modena: leggiGiorniDisponibilita(
                row,
                ["disponibilitaModena", "disponibilità modena", "giorni modena", "modena"],
                disponibilitaGenerale,
              ),
              sassuolo: leggiGiorniDisponibilita(
                row,
                ["disponibilitaSassuolo", "disponibilità sassuolo", "giorni sassuolo", "sassuolo"],
              ),
            };
            return {
              id: leggiTesto(row, ["id", "medicoId", "medico id"], slugId("medico", nome, index)),
              nome,
              specialita: leggiTesto(row, ["specialita", "specialità"], "Generale"),
              agendaAperta: leggiBooleano(row, ["agendaAperta", "agenda aperta", "agenda"], true),
              disponibilita: unisciDisponibilitaSedi(disponibilitaPerSede),
              disponibilitaPerSede,
              datiFatturazione: {
                intestatario: leggiTesto(
                  row,
                  ["intestatarioFatturazione", "intestatario fatturazione", "ragione sociale", "intestatario"],
                ),
                partitaIva: leggiTesto(row, ["partitaIva", "partita iva", "p iva", "p.iva", "iva"]),
                codiceFiscale: leggiTesto(row, ["codiceFiscale", "codice fiscale", "cf"]),
                indirizzo: leggiTesto(row, ["indirizzoFatturazione", "indirizzo fatturazione", "indirizzo"]),
                cap: leggiTesto(row, ["cap"]),
                citta: leggiTesto(row, ["citta", "città", "comune"]),
                provincia: leggiTesto(row, ["provincia", "prov"]),
                emailFatturazione: leggiTesto(
                  row,
                  ["emailFatturazione", "email fatturazione", "email"],
                ),
                pec: leggiTesto(row, ["pec"]),
                codiceSdi: leggiTesto(row, ["codiceSdi", "codice sdi", "sdi"]),
                regimeFiscale: leggiTesto(row, ["regimeFiscale", "regime fiscale", "regime"]),
                noteFatturazione: leggiTesto(
                  row,
                  ["noteFatturazione", "note fatturazione", "note"],
                ),
              },
            } satisfies Medico;
          })
          .filter((item): item is Medico => Boolean(item))
      : medici;

    const medicoById = new Map(prossimiMedici.map((medico) => [medico.id, medico]));
    const medicoByNome = new Map(prossimiMedici.map((medico) => [normalizzaTesto(medico.nome), medico]));
    const prestazioneById = new Map(prossimePrestazioni.map((prestazione) => [prestazione.id, prestazione]));
    const prestazioneByNome = new Map(
      prossimePrestazioni.map((prestazione) => [normalizzaTesto(prestazione.nome), prestazione]),
    );

    const prossimiListini = righeListini
      ? righeListini
          .map((row, index) => {
            const medicoId = leggiTesto(row, ["medicoId", "medico id"]);
            const medicoNome = leggiTesto(row, ["medico", "nome medico"]);
            const medico = medicoById.get(medicoId) ?? medicoByNome.get(normalizzaTesto(medicoNome));
            const prestazioneId = leggiTesto(row, ["prestazioneId", "prestazione id"]);
            const prestazioneNome = leggiTesto(row, ["prestazione", "nome prestazione"]);
            const prestazione =
              prestazioneById.get(prestazioneId) ?? prestazioneByNome.get(normalizzaTesto(prestazioneNome));

            if (!medico || !prestazione) return null;

            const compensoTipo = leggiCompensoTipo(row);
            const compensoRaw = leggiNumero(row, ["compensoValore", "compenso valore", "compenso", "compenso %", "compenso fisso"], 0);
            return {
              id: leggiTesto(row, ["id"], `listino-${index + 1}`),
              medicoId: medico.id,
              prestazioneId: prestazione.id,
              durata: Math.max(5, leggiNumero(row, ["durata"], prestazione.durata)),
              prezzo: Math.max(0, leggiNumero(row, ["prezzo", "importo", "costo visita"], 0)),
              compensoTipo,
              compensoValore:
                compensoTipo === "percentuale"
                  ? limitaPercentuale(compensoRaw)
                  : Math.max(0, compensoRaw),
            } satisfies Listino;
          })
          .filter((item): item is Listino => Boolean(item))
      : listini;

    setSpecialita(prossimeSpecialita);
    setPrestazioni(prossimePrestazioni);
    setMedici(prossimiMedici);
    setListini(prossimiListini);
    setSelectedSpecialita(prossimeSpecialita[0]?.nome ?? prossimePrestazioni[0]?.specialita ?? "");
    setSelectedMedicoId(prossimiMedici[0]?.id ?? "");
    mostraNotifica(
      `Import completato: ${prossimiMedici.length} medici, ${prossimePrestazioni.length} prestazioni, ${prossimiListini.length} listini.`,
    );
  };

  const apriImportExcel = () => importInputRef.current?.click();

  const gestisciImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importaExcel(file);
    } catch {
      mostraNotifica("Import non riuscito. Controlla il formato del file Excel.", "destructive");
    } finally {
      event.target.value = "";
    }
  };

  const settingsBadgeLabel: Record<SettingsSaveState, string> = {
    loading: "Caricamento DB",
    saving: "Salvataggio...",
    saved: "DB collegato",
    error: "DB non collegato",
  };

  const settingsBadgeClass =
    settingsSaveState === "error"
      ? "w-fit border-red-200 bg-red-100 text-red-700 hover:bg-red-100"
      : settingsSaveState === "saved"
        ? "w-fit border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
        : "w-fit border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Impostazioni</h1>
          <p className="text-sm text-muted-foreground">
            Configura prestazioni, specialita, medici, agende e listini del gestionale.
          </p>
        </div>
        <Badge className={settingsBadgeClass}>
          {settingsBadgeLabel[settingsSaveState]}
        </Badge>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={gestisciImportExcel}
      />

      <Tabs defaultValue="prestazioni" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-md">
          <TabsTrigger value="specialita" className="gap-2">
            <Tags className="h-4 w-4" />
            Specialita
          </TabsTrigger>
          <TabsTrigger value="prestazioni" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Prestazioni
          </TabsTrigger>
          <TabsTrigger value="medici" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Medici
          </TabsTrigger>
          <TabsTrigger value="compensi" className="gap-2">
            <Euro className="h-4 w-4" />
            Compensi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="specialita" className="space-y-4">
          <SettingsPanel
            title="Specialita"
            description="Raggruppa le prestazioni per area clinica, ad esempio Ortopedia, Cardiologia o Diagnostica."
            icon={<Tags className="h-5 w-5" />}
            actions={<ImportExportActions onExport={esportaExcel} onImportClick={apriImportExcel} />}
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
                      onChange={(event) => setNuovaSpecialita(event.target.value)}
                      placeholder="Es. Ortopedia"
                    />
                  </Field>
                  <Button type="button" onClick={aggiungiSpecialita} className="w-full gap-2">
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
                      const numeroPrestazioni = prestazioni.filter((prestazione) =>
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
                        onChange={(event) =>
                          setNuovaPrestazioneSpecialita((corrente) => ({
                            ...corrente,
                            durata: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button type="button" onClick={aggiungiPrestazioneASpecialita} className="w-full gap-2">
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
                                  onChange={(event) =>
                                    aggiornaPrestazione(prestazione.id, "durata", Number(event.target.value) || 0)
                                  }
                                />
                              </TableCell>
                              <TableCell className="w-24">
                                <Checkbox
                                  checked={prestazione.attiva}
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
            actions={<ImportExportActions onExport={esportaExcel} onImportClick={apriImportExcel} />}
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
                  onChange={(event) =>
                    setNuovaPrestazione((corrente) => ({ ...corrente, nome: event.target.value }))
                  }
                  placeholder="Es. Visita ortopedica"
                />
              </Field>
              <Field label="Specialita">
                <Select
                  value={nuovaPrestazione.specialita}
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
                  onChange={(event) =>
                    setNuovaPrestazione((corrente) => ({ ...corrente, durata: event.target.value }))
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button type="button" onClick={aggiungiPrestazione} className="w-full gap-2">
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
                          onChange={(event) => aggiornaPrestazione(prestazione.id, "nome", event.target.value)}
                        />
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Select
                          value={prestazione.specialita}
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
                          onChange={(event) =>
                            aggiornaPrestazione(prestazione.id, "durata", Number(event.target.value) || 0)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={prestazione.attiva}
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
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="medici" className="space-y-4">
          <SettingsPanel
            title="Medici"
            description="Seleziona un medico per modificare anagrafica, agenda, disponibilita e listino prezzi."
            icon={<CalendarDays className="h-5 w-5" />}
            actions={
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => impostaTutteLeAgende(true)}>
                  Apri tutte
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => impostaTutteLeAgende(false)}>
                  Chiudi tutte
                </Button>
                <ImportExportActions onExport={esportaExcel} onImportClick={apriImportExcel} />
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
                        const disponibilitaPerSede = normalizzaDisponibilitaPerSede(medico);
                        const riepilogoSedi = SEDI_MEDICO.map((sede) => {
                          const giorni = disponibilitaPerSede[sede.id];
                          return `${sede.sigla}: ${giorni.length > 0 ? giorni.join(", ") : "-"}`;
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
                                Agenda {medico.agendaAperta ? "aperta" : "chiusa"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
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
                          Modifica dati, apertura agenda e giorni disponibili.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={
                            medicoSelezionato.agendaAperta
                              ? "w-fit border-green-200 bg-green-100 text-green-700 hover:bg-green-100"
                              : "w-fit border-border bg-muted text-muted-foreground hover:bg-muted"
                          }
                        >
                          {medicoSelezionato.agendaAperta ? "Agenda aperta" : "Agenda chiusa"}
                        </Badge>
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
                          value={medicoSelezionato.nome}
                          onChange={(event) =>
                            aggiornaMedico(medicoSelezionato.id, "nome", event.target.value)
                          }
                          className="font-semibold"
                        />
                      </Field>
                      <Field label="Specialita">
                        <Select
                          value={medicoSelezionato.specialita}
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
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                            placeholder={medicoSelezionato.nome}
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
                      </div>
                    </div>

                    <div className="mt-5 rounded-md border border-border bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Disponibilita per sede
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Ogni sede puo avere giorni diversi per lo stesso medico.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant={medicoSelezionato.agendaAperta ? "outline" : "default"}
                          onClick={() =>
                            aggiornaMedico(
                              medicoSelezionato.id,
                              "agendaAperta",
                              !medicoSelezionato.agendaAperta,
                            )
                          }
                          className="w-full lg:w-auto"
                        >
                          {medicoSelezionato.agendaAperta ? "Chiudi agenda" : "Apri agenda"}
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        {SEDI_MEDICO.map((sede) => {
                          const giorniSede = disponibilitaPerSedeMedicoSelezionato[sede.id];

                          return (
                            <div key={sede.id} className="rounded-md border border-border bg-muted/20 p-3">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground">{sede.label}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {giorniSede.length > 0 ? giorniSede.join(", ") : "Nessun giorno impostato"}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {giorniSede.length} giorni
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-3">
                                {GIORNI.map((giorno) => {
                                  const selezionato = giorniSede.includes(giorno);
                                  return (
                                    <button
                                      key={`${sede.id}-${giorno}`}
                                      type="button"
                                      onClick={() =>
                                        aggiornaDisponibilitaSede(
                                          medicoSelezionato.id,
                                          sede.id,
                                          giorno,
                                          !selezionato,
                                        )
                                      }
                                      className={`min-h-9 rounded-md border px-2 text-xs font-medium transition-colors ${
                                        selezionato
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-white text-muted-foreground hover:bg-muted"
                                      }`}
                                    >
                                      {giorno}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
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
                      <Badge variant="secondary" className="w-fit">
                        {listinoMedico.length} voci
                      </Badge>
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
                              disabled={prestazioniDisponibiliListino.length === 0}
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
                          onChange={(event) =>
                            setNuovoListino((corrente) => ({ ...corrente, prezzo: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Tipo compenso">
                        <Select
                          value={nuovoListino.compensoTipo}
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
                          onChange={(event) =>
                            setNuovoListino((corrente) => ({ ...corrente, compensoValore: event.target.value }))
                          }
                        />
                      </Field>
                      <div className="flex items-end md:col-span-2 xl:col-span-5 2xl:col-span-1">
                        <Button
                          type="button"
                          onClick={aggiungiListino}
                          disabled={!prestazioneNuovoListino}
                          className="w-full gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Aggiungi
                        </Button>
                      </div>
                    </div>

                    {listinoMedico.length > 0 ? (
                      <div className="mt-4 rounded-md border border-border">
                        <Table className="min-w-[1180px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[260px]">Prestazione</TableHead>
                              <TableHead className="w-32">Durata</TableHead>
                              <TableHead className="w-36">Importo</TableHead>
                              <TableHead className="min-w-[240px]">Compenso</TableHead>
                              <TableHead className="min-w-[180px] whitespace-nowrap">Quota medico</TableHead>
                              <TableHead className="min-w-[160px] whitespace-nowrap">Netto studio</TableHead>
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
                                    onChange={(event) =>
                                      aggiornaPrezzo(listino.id, Number(event.target.value) || 0)
                                    }
                                  />
                                </TableCell>
                                <TableCell className="min-w-[240px]">
                                  <div className="grid grid-cols-[1fr_90px] gap-2">
                                    <Select
                                      value={listino.compensoTipo}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => apriExportCompensi("excel")}
                  disabled={prenotazioniCompensi.length === 0}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
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
                                {riga.medico.specialita} · agenda {riga.medico.agendaAperta ? "aperta" : "chiusa"}
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

      <Dialog open={exportCompensiOpen} onOpenChange={setExportCompensiOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Export {formatoExportCompensi === "excel" ? "Excel" : formatoExportCompensi.toUpperCase()} compensi
            </DialogTitle>
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
                description="Con più medici: Excel usa fogli separati, CSV scarica file distinti, PDF crea sezioni separate."
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
    <section className="space-y-5 rounded-md border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
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
