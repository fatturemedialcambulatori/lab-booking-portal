import React from "react";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Camera,
  CalendarRange,
  ChevronDown,
  CreditCard,
  Download,
  Landmark,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  ReceiptText,
  RotateCcw,
  Save,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { uploadCassaDocument } from "@/lib/cassaFiles";

type SedeCassaId = "modena" | "sassuolo";
type CassaScope = "tutte" | SedeCassaId;
type TipoDocumentoCassa = "fatturato" | "pos";
type MetodoPagamentoSpesa = "contanti" | "bancomat" | "assegno" | "bonifico" | "altro";
type CategoriaSpesa = "medico" | "materiale" | "servizi" | "rimborso" | "altro";
type SaveState = "loading" | "dirty" | "saving" | "saved" | "error";
type CestinoChiusuraCassa = {
  id: string;
  deletedAt: string;
  sedeId: SedeCassaId;
  data: string;
  giorni: ChiusuraCassa[];
  spese: SpesaCassa[];
  documenti: DocumentoCassa[];
};

type ChiusuraCassa = {
  id: string;
  data: string;
  sedeId: SedeCassaId;
  contanti: number;
  bancomat: number;
  assegni: number;
  fondoCassa: number;
  note: string;
};

type SpesaCassa = {
  id: string;
  data: string;
  sedeId: SedeCassaId;
  descrizione: string;
  categoria: CategoriaSpesa;
  importo: number;
  metodoPagamento: MetodoPagamentoSpesa;
  note: string;
};

type DocumentoCassa = {
  id: string;
  data: string;
  sedeId: SedeCassaId;
  tipo: TipoDocumentoCassa;
  bucket?: string;
  storagePath?: string;
  fileName: string;
  fileUrl: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedAt: string;
};

type CassaState = {
  giorni: ChiusuraCassa[];
  spese: SpesaCassa[];
  documenti: DocumentoCassa[];
  cestino: CestinoChiusuraCassa[];
};

type NuovaSpesaDraft = {
  descrizione: string;
  categoria: CategoriaSpesa;
  importo: string;
  metodoPagamento: MetodoPagamentoSpesa;
  note: string;
};

type MoneyDrafts = Record<string, string>;

type TotaliCassa = {
  contanti: number;
  bancomat: number;
  assegni: number;
  fondoCassa: number;
  spese: number;
  saldo: number;
};

type RigaPeriodoCassa = {
  data: string;
  totali: TotaliCassa;
  documenti: DocumentoCassa[];
  speseCount: number;
  documentiCount: number;
  chiusureCount: number;
};

type RigaMeseCassa = {
  key: string;
  label: string;
  dal: string;
  al: string;
  totali: TotaliCassa;
  giorniConDati: number;
};

type RigaChiusuraCassa = {
  key: string;
  sedeId: SedeCassaId;
  data: string;
  totali: TotaliCassa;
  speseCount: number;
  documentiCount: number;
  canSave: boolean;
};

const SEDI_CASSA: Array<{ id: SedeCassaId; label: string }> = [
  { id: "modena", label: "Modena" },
  { id: "sassuolo", label: "Sassuolo" },
];

const CATEGORIE_SPESE: Array<{ id: CategoriaSpesa; label: string; color: string }> = [
  { id: "medico", label: "Medico", color: "bg-sky-500" },
  { id: "materiale", label: "Materiale", color: "bg-amber-500" },
  { id: "servizi", label: "Servizi", color: "bg-violet-500" },
  { id: "rimborso", label: "Rimborso", color: "bg-emerald-500" },
  { id: "altro", label: "Altro", color: "bg-slate-500" },
];

const CASSA_STORAGE_KEY = "mmedical_cassa_state_v1";

const valuta = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayKey = () => localDateKey(new Date());

const firstDayOfMonth = () => {
  const date = new Date();
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
};

const addDaysToKey = (data: string, days: number) => {
  const date = new Date(`${data}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

const monthStartKey = (year: number, monthIndex: number) =>
  localDateKey(new Date(year, monthIndex, 1));

const monthEndKey = (year: number, monthIndex: number) =>
  localDateKey(new Date(year, monthIndex + 1, 0));

const monthLabel = (year: number, monthIndex: number) =>
  new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date(year, monthIndex, 1));

const daysBetween = (dal: string, al: string) => {
  if (!dal || !al || dal > al) return [];
  const days: string[] = [];
  let current = dal;
  while (current <= al) {
    days.push(current);
    current = addDaysToKey(current, 1);
  }
  return days;
};

const emptyState = (): CassaState => ({
  giorni: [],
  spese: [],
  documenti: [],
  cestino: [],
});

const emptySpesa = (): NuovaSpesaDraft => ({
  descrizione: "",
  categoria: "altro",
  importo: "",
  metodoPagamento: "contanti",
  note: "",
});

const chiusuraId = (sedeId: SedeCassaId, data: string) => `${sedeId}-${data}`;
const documentoId = (sedeId: SedeCassaId, data: string, tipo: TipoDocumentoCassa) =>
  `${sedeId}-${data}-${tipo}`;

const saveButtonClassName = (enabled: boolean, extra = "") =>
  [
    "gap-2 transition-colors",
    enabled
      ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-900 hover:text-white"
      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-100 hover:bg-slate-100 hover:text-slate-400 disabled:opacity-100",
    extra,
  ].filter(Boolean).join(" ");

const parseImporto = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (data: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));

const sedeLabel = (sedeId: SedeCassaId) =>
  SEDI_CASSA.find((sede) => sede.id === sedeId)?.label ?? sedeId;

const isSedeCassa = (value: unknown): value is SedeCassaId =>
  value === "modena" || value === "sassuolo";

const isTipoDocumento = (value: unknown): value is TipoDocumentoCassa =>
  value === "fatturato" || value === "pos";

const isCategoriaSpesa = (value: unknown): value is CategoriaSpesa =>
  value === "medico" || value === "materiale" || value === "servizi" || value === "rimborso" || value === "altro";

const isMetodoPagamento = (value: unknown): value is MetodoPagamentoSpesa =>
  value === "contanti" || value === "bancomat" || value === "assegno" || value === "bonifico" || value === "altro";

const normalizeChiusura = (value: unknown): ChiusuraCassa | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ChiusuraCassa>;
  if (!isSedeCassa(item.sedeId) || typeof item.data !== "string") return null;

  return {
    id: typeof item.id === "string" ? item.id : chiusuraId(item.sedeId, item.data),
    data: item.data,
    sedeId: item.sedeId,
    contanti: parseImporto(item.contanti ?? 0),
    bancomat: parseImporto(item.bancomat ?? 0),
    assegni: parseImporto(item.assegni ?? 0),
    fondoCassa: parseImporto(item.fondoCassa ?? 0),
    note: item.note ?? "",
  };
};

const normalizeSpesa = (value: unknown): SpesaCassa | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<SpesaCassa>;
  if (!isSedeCassa(item.sedeId) || typeof item.data !== "string") return null;

  return {
    id: typeof item.id === "string" ? item.id : `spesa-${Date.now()}`,
    data: item.data,
    sedeId: item.sedeId,
    descrizione: item.descrizione ?? "",
    categoria: isCategoriaSpesa(item.categoria) ? item.categoria : "altro",
    importo: parseImporto(item.importo ?? 0),
    metodoPagamento: isMetodoPagamento(item.metodoPagamento) ? item.metodoPagamento : "contanti",
    note: item.note ?? "",
  };
};

const normalizeDocumento = (value: unknown): DocumentoCassa | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<DocumentoCassa>;
  if (!isSedeCassa(item.sedeId) || typeof item.data !== "string" || !isTipoDocumento(item.tipo)) return null;
  if (typeof item.fileName !== "string") return null;
  const id = typeof item.id === "string" ? item.id : documentoId(item.sedeId, item.data, item.tipo);

  return {
    id,
    data: item.data,
    sedeId: item.sedeId,
    tipo: item.tipo,
    bucket: item.bucket,
    storagePath: item.storagePath,
    fileName: item.fileName,
    fileUrl:
      typeof item.fileUrl === "string" && item.fileUrl.includes("cassa-file-download")
        ? item.fileUrl
        : `/api/cassa-file-download?id=${encodeURIComponent(id)}`,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    uploadedAt: item.uploadedAt ?? new Date().toISOString(),
  };
};

const normalizeCestinoChiusura = (value: unknown): CestinoChiusuraCassa | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<CestinoChiusuraCassa>;
  if (!isSedeCassa(item.sedeId) || typeof item.data !== "string") return null;

  return {
    id: typeof item.id === "string" ? item.id : `cestino-${item.sedeId}-${item.data}`,
    deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : new Date().toISOString(),
    sedeId: item.sedeId,
    data: item.data,
    giorni: Array.isArray(item.giorni) ? item.giorni.map(normalizeChiusura).filter(Boolean) as ChiusuraCassa[] : [],
    spese: Array.isArray(item.spese) ? item.spese.map(normalizeSpesa).filter(Boolean) as SpesaCassa[] : [],
    documenti: Array.isArray(item.documenti) ? item.documenti.map(normalizeDocumento).filter(Boolean) as DocumentoCassa[] : [],
  };
};

const normalizeState = (value: unknown): CassaState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyState();
  const item = value as Partial<CassaState>;
  return {
    giorni: Array.isArray(item.giorni) ? item.giorni.map(normalizeChiusura).filter(Boolean) as ChiusuraCassa[] : [],
    spese: Array.isArray(item.spese) ? item.spese.map(normalizeSpesa).filter(Boolean) as SpesaCassa[] : [],
    documenti: Array.isArray(item.documenti) ? item.documenti.map(normalizeDocumento).filter(Boolean) as DocumentoCassa[] : [],
    cestino: Array.isArray(item.cestino) ? item.cestino.map(normalizeCestinoChiusura).filter(Boolean) as CestinoChiusuraCassa[] : [],
  };
};

const readLocalState = () => {
  try {
    return normalizeState(JSON.parse(window.localStorage.getItem(CASSA_STORAGE_KEY) ?? "null"));
  } catch {
    return emptyState();
  }
};

const writeLocalState = (state: CassaState) => {
  window.localStorage.setItem(CASSA_STORAGE_KEY, JSON.stringify(state));
};

const sommaTotali = (giorni: ChiusuraCassa[], spese: SpesaCassa[]): TotaliCassa => {
  const totali = giorni.reduce(
    (acc, item) => ({
      contanti: acc.contanti + item.contanti,
      bancomat: acc.bancomat + item.bancomat,
      assegni: acc.assegni + item.assegni,
      fondoCassa: acc.fondoCassa + item.fondoCassa,
    }),
    { contanti: 0, bancomat: 0, assegni: 0, fondoCassa: 0 },
  );
  const totaleSpese = spese.reduce((sum, spesa) => sum + spesa.importo, 0);

  return {
    ...totali,
    spese: totaleSpese,
    saldo: totali.contanti + totali.bancomat + totali.assegni + totali.fondoCassa - totaleSpese,
  };
};

const incassiDaTotali = (totali: TotaliCassa) =>
  totali.contanti + totali.bancomat + totali.assegni;

const creaRighePeriodo = (
  state: CassaState,
  sediVisibili: SedeCassaId[],
  dal: string,
  al: string,
  includeGiorniVuoti = false,
): RigaPeriodoCassa[] => {
  const dayKeys = new Set<string>();
  if (includeGiorniVuoti) {
    daysBetween(dal, al).forEach((data) => dayKeys.add(data));
  }
  state.giorni.forEach((item) => {
    if (sediVisibili.includes(item.sedeId) && item.data >= dal && item.data <= al) {
      dayKeys.add(item.data);
    }
  });
  state.spese.forEach((item) => {
    if (sediVisibili.includes(item.sedeId) && item.data >= dal && item.data <= al) {
      dayKeys.add(item.data);
    }
  });
  state.documenti.forEach((item) => {
    if (sediVisibili.includes(item.sedeId) && item.data >= dal && item.data <= al) {
      dayKeys.add(item.data);
    }
  });

  return Array.from(dayKeys)
    .sort((a, b) => b.localeCompare(a))
    .map((data) => {
      const giorni = state.giorni.filter((item) => sediVisibili.includes(item.sedeId) && item.data === data);
      const spese = state.spese.filter((item) => sediVisibili.includes(item.sedeId) && item.data === data);
      const documenti = state.documenti.filter((item) => sediVisibili.includes(item.sedeId) && item.data === data);
      return {
        data,
        totali: sommaTotali(giorni, spese),
        documenti,
        speseCount: spese.length,
        documentiCount: documenti.length,
        chiusureCount: giorni.length,
      };
    });
};

export function AdminCassa({ scope }: { scope: CassaScope }) {
  const [state, setState] = React.useState<CassaState>(emptyState);
  const [giorno, setGiorno] = React.useState(todayKey);
  const [saveState, setSaveState] = React.useState<SaveState>("loading");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [persistenzaAttiva, setPersistenzaAttiva] = React.useState(false);
  const [uploadingDocId, setUploadingDocId] = React.useState<string | null>(null);
  const [recoveringKey, setRecoveringKey] = React.useState<string | null>(null);
  const [moneyDrafts, setMoneyDrafts] = React.useState<MoneyDrafts>({});
  const [openChiusure, setOpenChiusure] = React.useState<Set<string>>(() => new Set());
  const [pendingChiusure, setPendingChiusure] = React.useState<Set<string>>(() => new Set());
  const [dettaglioMeseAperto, setDettaglioMeseAperto] = React.useState(false);
  const [selectedAnnoMese, setSelectedAnnoMese] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const queuedStateRef = React.useRef<CassaState | null>(null);
  const saveInFlightRef = React.useRef(false);
  const saveToastRequestedRef = React.useRef(false);
  const skipNextAutosaveRef = React.useRef(false);
  const [mobileCapture, setMobileCapture] = React.useState<{
    sedeId: SedeCassaId;
    tipo: TipoDocumentoCassa;
  } | null>(null);
  const [nuoveSpese, setNuoveSpese] = React.useState<Record<SedeCassaId, NuovaSpesaDraft>>({
    modena: emptySpesa(),
    sassuolo: emptySpesa(),
  });

  const sediVisibili = React.useMemo(
    () => scope === "tutte" ? SEDI_CASSA.map((sede) => sede.id) : [scope],
    [scope],
  );

  const scopeLabel = scope === "tutte" ? "Totale entrambe le sedi" : sedeLabel(scope);

  const mostraNotifica = React.useCallback((description: string, variant: "default" | "destructive" = "default") => {
    toast({
      title: variant === "destructive" ? "Attenzione" : "Notifica",
      description,
      variant,
    });
  }, []);

  const setKeyState = React.useCallback((
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
    action: "add" | "remove",
  ) => {
    setter((current) => {
      const hasKey = current.has(key);
      if (action === "add" && hasKey) return current;
      if (action === "remove" && !hasKey) return current;
      const next = new Set(current);
      if (action === "add") next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const markChiusuraEdited = React.useCallback((sedeId: SedeCassaId, data: string) => {
    const key = chiusuraId(sedeId, data);
    setKeyState(setOpenChiusure, key, "add");
    setKeyState(setPendingChiusure, key, "add");
  }, [setKeyState]);

  const closeChiusure = React.useCallback((keys?: string[]) => {
    setOpenChiusure((current) => {
      if (!keys) return new Set();
      const next = new Set(current);
      keys.forEach((key) => next.delete(key));
      return next;
    });
    setPendingChiusure((current) => {
      if (!keys) return new Set();
      const next = new Set(current);
      keys.forEach((key) => next.delete(key));
      return next;
    });
  }, []);

  const flushSaveQueue = React.useCallback(async () => {
    if (saveInFlightRef.current) return;
    const payload = queuedStateRef.current;
    if (!payload) return;

    saveInFlightRef.current = true;
    queuedStateRef.current = null;
    writeLocalState(payload);
    setSaveState("saving");

    try {
      const response = await fetch("/api/cassa-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Salvataggio non riuscito");

      const saved: unknown = await response.json();
      const normalized = normalizeState(saved);
      const savedAt = new Date().toISOString();
      setLastSavedAt(savedAt);

      if (!queuedStateRef.current) {
        skipNextAutosaveRef.current = true;
        setState(normalized);
        writeLocalState(normalized);
        setSaveState("saved");
        if (saveToastRequestedRef.current) mostraNotifica("Cassa salvata.");
        saveToastRequestedRef.current = false;
      } else {
        setSaveState("dirty");
      }
    } catch {
      setSaveState("error");
      if (saveToastRequestedRef.current) mostraNotifica("Salvataggio cassa non riuscito.", "destructive");
      saveToastRequestedRef.current = false;
    } finally {
      saveInFlightRef.current = false;
      if (queuedStateRef.current) {
        window.setTimeout(() => void flushSaveQueue(), 0);
      }
    }
  }, [mostraNotifica]);

  const queueSave = React.useCallback((
    nextState: CassaState,
    options: { immediate?: boolean; showToast?: boolean } = {},
  ) => {
    queuedStateRef.current = nextState;
    writeLocalState(nextState);
    if (options.showToast) saveToastRequestedRef.current = true;
    setSaveState(saveInFlightRef.current ? "saving" : "dirty");

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (options.immediate) {
      void flushSaveQueue();
      return;
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushSaveQueue();
    }, 450);
  }, [flushSaveQueue]);

  const flushPendingSaves = React.useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (queuedStateRef.current && !saveInFlightRef.current) {
      await flushSaveQueue();
    }

    while (saveInFlightRef.current || queuedStateRef.current) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
      if (queuedStateRef.current && !saveInFlightRef.current) {
        await flushSaveQueue();
      }
    }
  }, [flushSaveQueue]);

  const aggiornaDaDb = React.useCallback(async (showToast = true) => {
    try {
      if (showToast) await flushPendingSaves();
      const response = await fetch("/api/cassa-state");
      if (!response.ok) throw new Error("Cassa non disponibile");
      const data: unknown = await response.json();
      const normalized = normalizeState(data);
      skipNextAutosaveRef.current = true;
      setState(normalized);
      writeLocalState(normalized);
      setSaveState("saved");
      setLastSavedAt(new Date().toISOString());
      if (showToast) mostraNotifica("Cassa aggiornata dal DB.");
    } catch {
      if (showToast) mostraNotifica("Non sono riuscito ad aggiornare la cassa dal DB.", "destructive");
    }
  }, [flushPendingSaves, mostraNotifica]);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/cassa-state");
        if (!response.ok) throw new Error("Cassa non disponibile");
        const data: unknown = await response.json();
        if (!active) return;
        const normalized = normalizeState(data);
        skipNextAutosaveRef.current = true;
        setState(normalized);
        writeLocalState(normalized);
        setSaveState("saved");
        setLastSavedAt(new Date().toISOString());
        setPersistenzaAttiva(true);
      } catch {
        if (!active) return;
        skipNextAutosaveRef.current = true;
        setState(readLocalState());
        setSaveState("error");
        setPersistenzaAttiva(true);
        mostraNotifica("Cassa non collegata al DB. Sto usando il salvataggio locale del browser.", "destructive");
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [mostraNotifica]);

  React.useEffect(() => {
    if (!persistenzaAttiva) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    queueSave(state);
  }, [persistenzaAttiva, queueSave, state]);

  React.useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (!mobileCapture) return;
    const timer = window.setInterval(() => {
      void aggiornaDaDb(false);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [aggiornaDaDb, mobileCapture]);

  const salvaCassa = React.useCallback(async (payload?: CassaState, showToast = true) => {
    const dataToSave = payload ?? state;
    queueSave(dataToSave, { immediate: true, showToast });
  }, [queueSave, state]);

  const confermaChiusure = React.useCallback((keys?: string[]) => {
    void salvaCassa(undefined, true);
    closeChiusure(keys);
  }, [closeChiusure, salvaCassa]);

  const eliminaDocumentoRemoto = React.useCallback(async (id: string) => {
    const response = await fetch("/api/cassa-file-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: id }),
    });
    if (!response.ok) throw new Error("Eliminazione documento non riuscita");
  }, []);

  const eliminaSpesaRemota = React.useCallback(async (id: string) => {
    const response = await fetch("/api/cassa-spesa-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spesaId: id }),
    });
    if (!response.ok) throw new Error("Eliminazione spesa non riuscita");
    return normalizeState(await response.json());
  }, []);

  const eliminaChiusuraRemota = React.useCallback(async (sedeId: SedeCassaId, data: string) => {
    const response = await fetch("/api/cassa-chiusura-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, data }),
    });
    if (!response.ok) throw new Error("Eliminazione chiusura non riuscita");
    return normalizeState(await response.json());
  }, []);

  const ripristinaChiusuraRemota = React.useCallback(async (trashId: string) => {
    const response = await fetch("/api/cassa-chiusura-restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashId }),
    });
    if (!response.ok) throw new Error("Ripristino chiusura non riuscito");
    return normalizeState(await response.json());
  }, []);

  const getChiusura = React.useCallback(
    (sedeId: SedeCassaId, data: string): ChiusuraCassa =>
      state.giorni.find((item) => item.sedeId === sedeId && item.data === data) ?? {
        id: chiusuraId(sedeId, data),
        data,
        sedeId,
        contanti: 0,
        bancomat: 0,
        assegni: 0,
        fondoCassa: 0,
        note: "",
      },
    [state.giorni],
  );

  const updateChiusura = <K extends keyof ChiusuraCassa>(
    sedeId: SedeCassaId,
    field: K,
    value: ChiusuraCassa[K],
  ) => {
    markChiusuraEdited(sedeId, giorno);
    setState((current) => {
      const existing = current.giorni.find((item) => item.sedeId === sedeId && item.data === giorno);
      const next: ChiusuraCassa = {
        ...(existing ?? getChiusura(sedeId, giorno)),
        [field]: value,
      };
      return {
        ...current,
        giorni: [
          ...current.giorni.filter((item) => !(item.sedeId === sedeId && item.data === giorno)),
          next,
        ].sort((a, b) => `${a.data}${a.sedeId}`.localeCompare(`${b.data}${b.sedeId}`)),
      };
    });
  };

  const speseGiornoSede = React.useCallback(
    (sedeId: SedeCassaId, data: string) =>
      state.spese
        .filter((spesa) => spesa.sedeId === sedeId && spesa.data === data)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [state.spese],
  );

  const documentiGiornoSede = React.useCallback(
    (sedeId: SedeCassaId, data: string) =>
      state.documenti.filter((documento) => documento.sedeId === sedeId && documento.data === data),
    [state.documenti],
  );

  const updateSpesa = <K extends keyof SpesaCassa>(id: string, field: K, value: SpesaCassa[K]) => {
    const spesaCorrente = state.spese.find((spesa) => spesa.id === id);
    if (spesaCorrente) markChiusuraEdited(spesaCorrente.sedeId, spesaCorrente.data);
    setState((current) => ({
      ...current,
      spese: current.spese.map((spesa) => spesa.id === id ? { ...spesa, [field]: value } : spesa),
    }));
  };

  const updateMoneyDraft = React.useCallback((key: string, value: string) => {
    setMoneyDrafts((current) => ({ ...current, [key]: value }));
  }, []);

  const clearMoneyDraft = React.useCallback((key: string) => {
    setMoneyDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const eliminaSpesa = async (id: string) => {
    const spesaCorrente = state.spese.find((spesa) => spesa.id === id);
    if (spesaCorrente) markChiusuraEdited(spesaCorrente.sedeId, spesaCorrente.data);
    try {
      await flushPendingSaves();
      const saved = await eliminaSpesaRemota(id);
      skipNextAutosaveRef.current = true;
      setState(saved);
      writeLocalState(saved);
      setSaveState("saved");
      setLastSavedAt(new Date().toISOString());
      mostraNotifica("Spesa eliminata.");
    } catch {
      mostraNotifica("Eliminazione spesa non riuscita.", "destructive");
    }
  };

  const aggiungiSpesa = (sedeId: SedeCassaId) => {
    const draft = nuoveSpese[sedeId];
    const importo = parseImporto(draft.importo);
    if (!draft.descrizione.trim() || importo <= 0) {
      mostraNotifica("Inserisci descrizione e importo della spesa.", "destructive");
      return;
    }

    const nuovaSpesa: SpesaCassa = {
      id: `spesa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      data: giorno,
      sedeId,
      descrizione: draft.descrizione.trim(),
      categoria: draft.categoria,
      importo,
      metodoPagamento: draft.metodoPagamento,
      note: draft.note.trim(),
    };

    markChiusuraEdited(sedeId, giorno);
    setState((current) => ({
      ...current,
      spese: [...current.spese, nuovaSpesa],
    }));
    setNuoveSpese((current) => ({ ...current, [sedeId]: emptySpesa() }));
  };

  const uploadDocumento = async (sedeId: SedeCassaId, tipo: TipoDocumentoCassa, file: File | undefined) => {
    if (!file) return;

    const id = documentoId(sedeId, giorno, tipo);
    setUploadingDocId(id);

    try {
      const data = await uploadCassaDocument({
        id,
        sedeId,
        data: giorno,
        tipo,
        file,
      });
      const documento: DocumentoCassa = {
        id,
        data: giorno,
        sedeId,
        tipo,
        bucket: data.bucket,
        storagePath: data.storagePath,
        fileName: data.fileName ?? file.name,
        fileUrl: data.fileUrl ?? `/api/cassa-file-download?id=${encodeURIComponent(id)}`,
        contentType: data.contentType ?? file.type,
        sizeBytes: data.sizeBytes ?? file.size,
        uploadedAt: data.uploadedAt ?? new Date().toISOString(),
      };

      markChiusuraEdited(sedeId, giorno);
      setState((current) => ({
        ...current,
        documenti: [
          ...current.documenti.filter((item) => item.id !== id),
          documento,
        ],
      }));
      mostraNotifica(tipo === "fatturato" ? "Foglio fatturato caricato." : "Chiusura POS caricata.");
    } catch (err) {
      mostraNotifica(
        err instanceof Error ? err.message : "Upload documento non riuscito. Verifica Supabase Storage.",
        "destructive",
      );
    } finally {
      setUploadingDocId(null);
    }
  };

  const recuperaDocumenti = async (sedeId: SedeCassaId) => {
    const key = `${sedeId}-${giorno}`;
    setRecoveringKey(key);

    try {
      await flushPendingSaves();
      const response = await fetch("/api/cassa-documents-recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId, data: giorno }),
      });
      if (!response.ok) throw new Error("Recupero allegati non riuscito");

      const data: unknown = await response.json();
      const payload = data && typeof data === "object" ? data as { recovered?: unknown; state?: unknown } : {};
      const recovered = Number(payload.recovered ?? 0);
      const saved = normalizeState(payload.state);
      skipNextAutosaveRef.current = true;
      setState(saved);
      writeLocalState(saved);
      setSaveState("saved");
      setLastSavedAt(new Date().toISOString());

      if (recovered > 0) {
        markChiusuraEdited(sedeId, giorno);
        mostraNotifica(`${recovered} allegati recuperati da Supabase Storage.`);
      } else {
        mostraNotifica("Nessun allegato trovato nello Storage per questa sede e data.", "destructive");
      }
    } catch {
      mostraNotifica("Recupero allegati non riuscito. Verifica Supabase Storage.", "destructive");
    } finally {
      setRecoveringKey(null);
    }
  };

  const eliminaDocumento = async (id: string) => {
    const documentoCorrente = state.documenti.find((documento) => documento.id === id);
    if (documentoCorrente) markChiusuraEdited(documentoCorrente.sedeId, documentoCorrente.data);
    try {
      await flushPendingSaves();
      await eliminaDocumentoRemoto(id);
      setState((current) => ({
        ...current,
        documenti: current.documenti.filter((documento) => documento.id !== id),
      }));
      mostraNotifica("Documento eliminato.");
    } catch {
      mostraNotifica("Eliminazione documento non riuscita.", "destructive");
    }
  };

  const eliminaChiusura = async (sedeId: SedeCassaId, data: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Spostare nel cestino la chiusura ${sedeLabel(sedeId)} del ${formatDate(data)}? Potrai ripristinarla.`)
    ) {
      return;
    }

    try {
      await flushPendingSaves();
      const saved = await eliminaChiusuraRemota(sedeId, data);
      skipNextAutosaveRef.current = true;
      setState(saved);
      writeLocalState(saved);
      setSaveState("saved");
      setLastSavedAt(new Date().toISOString());
      closeChiusure([chiusuraId(sedeId, data)]);
      mostraNotifica(`Chiusura ${sedeLabel(sedeId)} del ${formatDate(data)} spostata nel cestino.`);
    } catch {
      mostraNotifica("Eliminazione chiusura non riuscita.", "destructive");
    }
  };

  const ripristinaChiusura = async (trashId: string) => {
    const closureToRestore = state.cestino.find((item) => item.id === trashId);
    try {
      await flushPendingSaves();
      const saved = await ripristinaChiusuraRemota(trashId);
      skipNextAutosaveRef.current = true;
      setState(saved);
      writeLocalState(saved);
      setSaveState("saved");
      setLastSavedAt(new Date().toISOString());
      if (closureToRestore) closeChiusure([chiusuraId(closureToRestore.sedeId, closureToRestore.data)]);
      mostraNotifica("Chiusura ripristinata.");
    } catch {
      mostraNotifica("Ripristino chiusura non riuscito.", "destructive");
    }
  };

  const chiusureGiorno = sediVisibili.map((sedeId) => getChiusura(sedeId, giorno));
  const speseGiorno = state.spese.filter((spesa) => sediVisibili.includes(spesa.sedeId) && spesa.data === giorno);
  const totaliGiorno = sommaTotali(chiusureGiorno, speseGiorno);
  const today = todayKey();
  const yesterday = addDaysToKey(today, -1);
  const dashboardMonthStart = firstDayOfMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();

  const righeMeseCorrente = React.useMemo(
    () => creaRighePeriodo(state, sediVisibili, dashboardMonthStart, today, true),
    [dashboardMonthStart, sediVisibili, state, today],
  );

  const totaliMeseCorrente = React.useMemo(
    () => sommaTotali(
      state.giorni.filter((item) => sediVisibili.includes(item.sedeId) && item.data >= dashboardMonthStart && item.data <= today),
      state.spese.filter((item) => sediVisibili.includes(item.sedeId) && item.data >= dashboardMonthStart && item.data <= today),
    ),
    [dashboardMonthStart, sediVisibili, state.giorni, state.spese, today],
  );

  const situazioneIeri = React.useMemo(
    () => creaRighePeriodo(state, sediVisibili, yesterday, yesterday, true)[0],
    [sediVisibili, state, yesterday],
  );

  const righeAnnoCorrente = React.useMemo<RigaMeseCassa[]>(() =>
    Array.from({ length: currentMonthIndex + 1 }, (_, monthIndex) => {
      const dal = monthStartKey(currentYear, monthIndex);
      const al = monthIndex === currentMonthIndex ? today : monthEndKey(currentYear, monthIndex);
      const righeMese = creaRighePeriodo(state, sediVisibili, dal, al, false);
      const totali = sommaTotali(
        state.giorni.filter((item) => sediVisibili.includes(item.sedeId) && item.data >= dal && item.data <= al),
        state.spese.filter((item) => sediVisibili.includes(item.sedeId) && item.data >= dal && item.data <= al),
      );
      return {
        key: `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}`,
        label: monthLabel(currentYear, monthIndex),
        dal,
        al,
        totali,
        giorniConDati: righeMese.length,
      };
    }),
    [currentMonthIndex, currentYear, sediVisibili, state, today],
  );

  const elencoChiusure = React.useMemo<RigaChiusuraCassa[]>(() => {
    const keys = new Set<string>();
    state.giorni.forEach((item) => {
      if (sediVisibili.includes(item.sedeId)) keys.add(`${item.sedeId}|${item.data}`);
    });
    state.spese.forEach((item) => {
      if (sediVisibili.includes(item.sedeId)) keys.add(`${item.sedeId}|${item.data}`);
    });
    state.documenti.forEach((item) => {
      if (sediVisibili.includes(item.sedeId)) keys.add(`${item.sedeId}|${item.data}`);
    });

    return Array.from(keys)
      .map((key) => {
        const [sedeId, data] = key.split("|") as [SedeCassaId, string];
        const giorni = state.giorni.filter((item) => item.sedeId === sedeId && item.data === data);
        const spese = state.spese.filter((item) => item.sedeId === sedeId && item.data === data);
        const documenti = state.documenti.filter((item) => item.sedeId === sedeId && item.data === data);
        return {
          key,
          sedeId,
          data,
          totali: sommaTotali(giorni, spese),
          speseCount: spese.length,
          documentiCount: documenti.length,
          canSave: pendingChiusure.has(key),
        };
      })
      .sort((a, b) => `${b.data}${b.sedeId}`.localeCompare(`${a.data}${a.sedeId}`));
  }, [pendingChiusure, sediVisibili, state.documenti, state.giorni, state.spese]);

  const selectedMonth = React.useMemo(
    () => righeAnnoCorrente.find((row) => row.key === selectedAnnoMese) ?? null,
    [righeAnnoCorrente, selectedAnnoMese],
  );

  const selectedMonthRows = React.useMemo(
    () => selectedMonth
      ? elencoChiusure.filter((row) => row.data >= selectedMonth.dal && row.data <= selectedMonth.al)
      : [],
    [elencoChiusure, selectedMonth],
  );

  const chiusureDaMostrare = React.useMemo(
    () => sediVisibili.filter((sedeId) => {
      const key = chiusuraId(sedeId, giorno);
      const hasContent =
        state.giorni.some((item) => item.sedeId === sedeId && item.data === giorno) ||
        state.spese.some((item) => item.sedeId === sedeId && item.data === giorno) ||
        state.documenti.some((item) => item.sedeId === sedeId && item.data === giorno);

      return !hasContent || openChiusure.has(key) || pendingChiusure.has(key);
    }),
    [giorno, openChiusure, pendingChiusure, sediVisibili, state.documenti, state.giorni, state.spese],
  );

  const cestinoVisibile = React.useMemo(
    () => state.cestino
      .filter((item) => sediVisibili.includes(item.sedeId))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    [sediVisibili, state.cestino],
  );

  const allegatiSenzaChiusura = React.useMemo(() => {
    const dataKeys = new Set<string>();
    state.giorni.forEach((item) => dataKeys.add(`${item.sedeId}|${item.data}`));
    state.spese.forEach((item) => dataKeys.add(`${item.sedeId}|${item.data}`));

    const grouped = new Map<string, {
      key: string;
      sedeId: SedeCassaId;
      data: string;
      documentiCount: number;
    }>();

    state.documenti.forEach((documento) => {
      if (!sediVisibili.includes(documento.sedeId)) return;
      const key = `${documento.sedeId}|${documento.data}`;
      if (dataKeys.has(key)) return;
      const current = grouped.get(key);
      grouped.set(key, {
        key,
        sedeId: documento.sedeId,
        data: documento.data,
        documentiCount: (current?.documentiCount ?? 0) + 1,
      });
    });

    return Array.from(grouped.values()).sort((a, b) => `${b.data}${b.sedeId}`.localeCompare(`${a.data}${a.sedeId}`));
  }, [sediVisibili, state.documenti, state.giorni, state.spese]);

  const statusLabel =
    saveState === "loading"
      ? "Carico"
      : saveState === "dirty"
        ? "Modifiche da salvare"
      : saveState === "saving"
        ? "Salvataggio in corso"
        : saveState === "saved"
          ? lastSavedAt ? `Salvato ${formatTime(lastSavedAt)}` : "Salvato"
          : "Solo locale";

  const statusDescription =
    saveState === "dirty"
      ? "Ho rilevato modifiche: le sto mettendo in coda."
      : saveState === "saving"
        ? "Sto salvando sul DB, una richiesta alla volta."
        : saveState === "saved"
          ? "Tutte le modifiche visibili sono state salvate."
          : saveState === "error"
            ? "Non sono riuscito a salvare sul DB: resta una copia locale nel browser."
            : "Caricamento dati cassa.";

  const canManualSave = pendingChiusure.size > 0 || saveState === "error";

  const apriChiusuraInModifica = React.useCallback((sedeId: SedeCassaId, data: string) => {
    setGiorno(data);
    setMobileCapture(null);
    setKeyState(setOpenChiusure, chiusuraId(sedeId, data), "add");
    mostraNotifica(`Chiusura ${sedeLabel(sedeId)} del ${formatDate(data)} aperta in modifica.`);
  }, [mostraNotifica, setKeyState]);

  const captureUrl = React.useMemo(() => {
    if (!mobileCapture || typeof window === "undefined") return "";
    const url = new URL("/cassa-camera", window.location.origin);
    url.searchParams.set("doc", documentoId(mobileCapture.sedeId, giorno, mobileCapture.tipo));
    url.searchParams.set("sede", mobileCapture.sedeId);
    url.searchParams.set("data", giorno);
    url.searchParams.set("tipo", mobileCapture.tipo);
    return url.toString();
  }, [giorno, mobileCapture]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-md border border-border bg-white p-4 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cassa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chiusure giornaliere, spese sostenute, fondo cassa e documenti POS/fatturato.
          </p>
        </div>
        <div className="w-full rounded-md border border-border bg-white p-3 shadow-sm lg:w-auto lg:min-w-[320px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge
                variant={saveState === "error" ? "destructive" : saveState === "saved" ? "secondary" : "outline"}
                className="w-fit gap-2"
              >
                <Save className={`h-3.5 w-3.5 ${saveState === "saving" ? "animate-pulse" : ""}`} />
                {statusLabel}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">{statusDescription}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => confermaChiusure()}
              disabled={!canManualSave}
              className={saveButtonClassName(canManualSave, "shrink-0")}
            >
              <Save className="h-4 w-4" />
              Salva ora
            </Button>
          </div>
        </div>
        </div>
      </div>

      <CassaDashboard
        scopeLabel={scopeLabel}
        today={today}
        yesterday={yesterday}
        monthStart={dashboardMonthStart}
        monthRows={righeMeseCorrente}
        monthTotals={totaliMeseCorrente}
        previousDay={situazioneIeri}
        yearRows={righeAnnoCorrente}
        selectedMonthKey={selectedAnnoMese}
        selectedMonth={selectedMonth}
        selectedMonthRows={selectedMonthRows}
        activeData={giorno}
        expanded={dettaglioMeseAperto}
        onToggleExpanded={() => setDettaglioMeseAperto((current) => !current)}
        onSelectMonth={setSelectedAnnoMese}
        onSelectDay={(data) => {
          setGiorno(data);
          setMobileCapture(null);
        }}
        onEditClosure={apriChiusuraInModifica}
        onSaveClosure={(sedeId, data) => confermaChiusure([chiusuraId(sedeId, data)])}
        canRetrySave={saveState === "error"}
        onDeleteClosure={(sedeId, data) => void eliminaChiusura(sedeId, data)}
      />

      <div className="grid gap-3 rounded-md border border-border bg-white p-3 sm:p-4 lg:grid-cols-[220px_1fr]">
        <Field label="Giorno chiusura">
          <Input type="date" value={giorno} onChange={(event) => setGiorno(event.target.value)} />
        </Field>
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vista</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{scopeLabel}</p>
        </div>
      </div>

      <section className="rounded-md border border-border bg-white p-3 sm:p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Dati giornalieri</h2>
            <p className="text-sm text-muted-foreground">
              Chiusura del {formatDate(giorno)} per {scopeLabel.toLowerCase()}.
            </p>
          </div>
          <Badge variant="secondary">{valuta.format(totaliGiorno.saldo)} saldo</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <StatCard icon={<Banknote className="h-5 w-5" />} label="Contanti" value={valuta.format(totaliGiorno.contanti)} />
          <StatCard icon={<CreditCard className="h-5 w-5" />} label="Bancomat/POS" value={valuta.format(totaliGiorno.bancomat)} />
          <StatCard icon={<Landmark className="h-5 w-5" />} label="Assegni" value={valuta.format(totaliGiorno.assegni)} />
          <StatCard icon={<WalletCards className="h-5 w-5" />} label="Fondo cassa" value={valuta.format(totaliGiorno.fondoCassa)} />
          <StatCard
            icon={<ReceiptText className="h-5 w-5" />}
            label="Saldo giornaliero"
            value={valuta.format(totaliGiorno.saldo)}
            detail={`Spese: ${valuta.format(totaliGiorno.spese)}`}
            strong
          />
        </div>
        <DailyTotalsChart totali={totaliGiorno} />
      </section>

      {chiusureDaMostrare.length > 0 ? (
        <div className={scope === "tutte" ? "grid gap-4 xl:grid-cols-2" : "grid gap-4"}>
        {chiusureDaMostrare.map((sedeId) => (
          <CassaSedePanel
            key={sedeId}
            sedeId={sedeId}
            giorno={giorno}
            chiusura={getChiusura(sedeId, giorno)}
            spese={speseGiornoSede(sedeId, giorno)}
            documenti={documentiGiornoSede(sedeId, giorno)}
            nuovaSpesa={nuoveSpese[sedeId]}
            uploadingDocId={uploadingDocId}
            recovering={recoveringKey === `${sedeId}-${giorno}`}
            onUpdateChiusura={updateChiusura}
            onUpdateNuovaSpesa={(patch) =>
              setNuoveSpese((current) => ({ ...current, [sedeId]: { ...current[sedeId], ...patch } }))
            }
            onAddSpesa={() => aggiungiSpesa(sedeId)}
            onUpdateSpesa={updateSpesa}
            onDeleteSpesa={eliminaSpesa}
            onUploadDocumento={uploadDocumento}
            onDeleteDocumento={eliminaDocumento}
            onRecoverDocumenti={() => void recuperaDocumenti(sedeId)}
            onOpenMobileCapture={(tipo) => setMobileCapture({ sedeId, tipo })}
            moneyDrafts={moneyDrafts}
            onMoneyDraftChange={updateMoneyDraft}
            onMoneyDraftCommit={clearMoneyDraft}
            onSaveChiusura={() => confermaChiusure([chiusuraId(sedeId, giorno)])}
            canSave={pendingChiusure.has(chiusuraId(sedeId, giorno)) || saveState === "error"}
            onDeleteChiusura={() => void eliminaChiusura(sedeId, giorno)}
            wideLayout={scope !== "tutte"}
          />
        ))}
        </div>
      ) : (
        <section className="rounded-md border border-border bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Chiusura gia salvata</h2>
              <p className="text-sm text-muted-foreground">
                Per il {formatDate(giorno)} la scheda di inserimento e nascosta finche non viene riaperta in modifica.
              </p>
            </div>
            <Badge variant="secondary">{scopeLabel}</Badge>
          </div>
        </section>
      )}

      {allegatiSenzaChiusura.length > 0 && (
        <AllegatiSenzaChiusuraAlert
          rows={allegatiSenzaChiusura}
          onOpen={(sedeId, data) => {
            setGiorno(data);
            mostraNotifica(`Aperto ${sedeLabel(sedeId)} del ${formatDate(data)}: gli allegati sono presenti, i dati contabili vanno reinseriti o ripristinati.`);
          }}
        />
      )}

      <CestinoChiusure
        rows={cestinoVisibile}
        onRestore={(trashId) => void ripristinaChiusura(trashId)}
      />

      <MobileCaptureDialog
        capture={mobileCapture}
        giorno={giorno}
        captureUrl={captureUrl}
        onClose={() => setMobileCapture(null)}
        onRefresh={() => void aggiornaDaDb()}
      />
    </div>
  );
}

function CassaDashboard({
  scopeLabel,
  today,
  yesterday,
  monthStart,
  monthRows,
  monthTotals,
  previousDay,
  yearRows,
  selectedMonthKey,
  selectedMonth,
  selectedMonthRows,
  activeData,
  expanded,
  onToggleExpanded,
  onSelectMonth,
  onSelectDay,
  onEditClosure,
  onSaveClosure,
  canRetrySave,
  onDeleteClosure,
}: {
  scopeLabel: string;
  today: string;
  yesterday: string;
  monthStart: string;
  monthRows: RigaPeriodoCassa[];
  monthTotals: TotaliCassa;
  previousDay?: RigaPeriodoCassa;
  yearRows: RigaMeseCassa[];
  selectedMonthKey: string | null;
  selectedMonth: RigaMeseCassa | null;
  selectedMonthRows: RigaChiusuraCassa[];
  activeData: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelectMonth: (key: string) => void;
  onSelectDay: (data: string) => void;
  onEditClosure: (sedeId: SedeCassaId, data: string) => void;
  onSaveClosure: (sedeId: SedeCassaId, data: string) => void;
  canRetrySave: boolean;
  onDeleteClosure: (sedeId: SedeCassaId, data: string) => void;
}) {
  const incassiMese = incassiDaTotali(monthTotals);
  const previousDayTotals = previousDay?.totali ?? sommaTotali([], []);
  const previousDayHasData = Boolean(
    previousDay &&
    (previousDay.chiusureCount > 0 || previousDay.speseCount > 0 || previousDay.documentiCount > 0),
  );
  const giorniConDati = monthRows.filter(
    (row) => row.chiusureCount > 0 || row.speseCount > 0 || row.documentiCount > 0,
  ).length;

  return (
    <section className="overflow-hidden rounded-md border border-border bg-white">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Dashboard cassa</h2>
            <p className="text-sm text-muted-foreground">
              Situazione del mese corrente, confronto con ieri e andamento annuale.
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit">{scopeLabel}</Badge>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Mese corrente</p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                {formatDate(monthStart)} - {formatDate(today)}
              </h3>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo mese</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{valuta.format(monthTotals.saldo)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DashboardMetric label="Incassi" value={valuta.format(incassiMese)} detail="Contanti, POS e assegni" tone="income" />
            <DashboardMetric label="Spese" value={valuta.format(monthTotals.spese)} detail="Uscite registrate" tone="expense" />
            <DashboardMetric label="Fondo cassa" value={valuta.format(monthTotals.fondoCassa)} detail="Totale lasciato" tone="neutral" />
            <DashboardMetric label="Giorni con dati" value={`${giorniConDati}`} detail={`${monthRows.length} giorni nel mese`} tone="neutral" />
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-primary">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Giorno precedente</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{formatDate(yesterday)}</h3>
              <Badge variant={previousDayHasData ? "secondary" : "outline"} className="mt-2">
                {previousDayHasData ? "Dati presenti" : "Nessun dato"}
              </Badge>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <DashboardMetric label="Incassi" value={valuta.format(incassiDaTotali(previousDayTotals))} tone="income" compact />
            <DashboardMetric label="Spese" value={valuta.format(previousDayTotals.spese)} tone="expense" compact />
            <DashboardMetric label="Fondo" value={valuta.format(previousDayTotals.fondoCassa)} tone="neutral" compact />
            <DashboardMetric label="Saldo" value={valuta.format(previousDayTotals.saldo)} tone="neutral" compact />
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Mese giorno per giorno</h3>
            <p className="text-sm text-muted-foreground">
              Espandi per controllare tutte le chiusure del mese corrente.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onToggleExpanded} className="w-full gap-2 bg-white sm:w-auto">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Nascondi dettaglio" : "Espandi dettaglio"}
          </Button>
        </div>

        {expanded && (
          <CassaMonthRows
            rows={monthRows}
            onSelectDay={onSelectDay}
          />
        )}
      </div>

      <CassaYearTrend
        rows={yearRows}
        selectedMonthKey={selectedMonthKey}
        onSelectMonth={onSelectMonth}
      />

      {selectedMonth && (
        <CassaClosureRows
          title={`Chiusure ${selectedMonth.label} ${selectedMonth.key.slice(0, 4)}`}
          description={`${formatDate(selectedMonth.dal)} - ${formatDate(selectedMonth.al)}`}
          rows={selectedMonthRows}
          activeData={activeData}
          onEdit={onEditClosure}
          onSave={onSaveClosure}
          canRetrySave={canRetrySave}
          onDelete={onDeleteClosure}
        />
      )}
    </section>
  );
}

function DashboardMetric({
  label,
  value,
  detail,
  tone,
  compact,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: "income" | "expense" | "neutral";
  compact?: boolean;
}) {
  const toneClass =
    tone === "income"
      ? "text-emerald-700"
      : tone === "expense"
        ? "text-red-700"
        : "text-foreground";

  return (
    <div className={`rounded-md border border-border bg-white ${compact ? "p-3" : "p-4"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${compact ? "text-base" : "text-xl"} ${toneClass}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function CassaMonthRows({
  rows,
  onSelectDay,
}: {
  rows: RigaPeriodoCassa[];
  onSelectDay: (data: string) => void;
}) {
  const sortedRows = rows.slice().reverse();

  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Data</th>
            <th className="px-4 py-3 text-right">Incassi</th>
            <th className="px-4 py-3 text-right">Spese</th>
            <th className="px-4 py-3 text-right">Fondo</th>
            <th className="px-4 py-3 text-right">Saldo</th>
            <th className="px-4 py-3 text-left">Stato</th>
            <th className="px-4 py-3 text-right">Azione</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {sortedRows.map((row) => {
            const hasData = row.chiusureCount > 0 || row.speseCount > 0 || row.documentiCount > 0;
            return (
              <tr key={row.data} className={hasData ? "bg-white" : "bg-muted/10"}>
                <td className="px-4 py-3 font-medium text-foreground">{formatDate(row.data)}</td>
                <td className="px-4 py-3 text-right">{valuta.format(incassiDaTotali(row.totali))}</td>
                <td className="px-4 py-3 text-right text-red-700">{valuta.format(row.totali.spese)}</td>
                <td className="px-4 py-3 text-right">{valuta.format(row.totali.fondoCassa)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{valuta.format(row.totali.saldo)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={hasData ? "secondary" : "outline"}>
                      {hasData ? "Dati presenti" : "Vuoto"}
                    </Badge>
                    {row.documentiCount > 0 && <Badge variant="outline">{row.documentiCount} allegati</Badge>}
                    {row.speseCount > 0 && <Badge variant="outline">{row.speseCount} spese</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onSelectDay(row.data)}>
                    Apri
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CassaYearTrend({
  rows,
  selectedMonthKey,
  onSelectMonth,
}: {
  rows: RigaMeseCassa[];
  selectedMonthKey: string | null;
  onSelectMonth: (key: string) => void;
}) {
  const max = Math.max(
    ...rows.flatMap((row) => [incassiDaTotali(row.totali), row.totali.spese]),
    1,
  );

  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Andamento anno corrente</h3>
            <p className="text-sm text-muted-foreground">Riepilogo mese per mese di incassi, spese e saldo.</p>
          </div>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Incassi</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Spese</span>
        </div>
      </div>

      <div className="flex min-h-56 gap-3 overflow-x-auto pb-1">
        {rows.map((row) => {
          const incassi = incassiDaTotali(row.totali);
          const selected = row.key === selectedMonthKey;
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onSelectMonth(row.key)}
              aria-pressed={selected}
              className={`flex min-w-28 flex-1 flex-col justify-end gap-2 rounded-md border p-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 ${
                selected
                  ? "border-primary/35 bg-primary/5 shadow-sm"
                  : "border-transparent hover:border-border hover:bg-muted/30"
              }`}
            >
              <div
                className={`flex h-32 items-end justify-center gap-2 rounded-md border p-2 ${
                  selected ? "border-primary/20 bg-white" : "border-border bg-muted/20"
                }`}
              >
                <div
                  className="w-6 rounded-sm bg-primary"
                  style={{ height: `${Math.max(5, (incassi / max) * 100)}%` }}
                  title={`Incassi ${valuta.format(incassi)}`}
                />
                <div
                  className="w-6 rounded-sm bg-red-500"
                  style={{ height: `${Math.max(5, (row.totali.spese / max) * 100)}%` }}
                  title={`Spese ${valuta.format(row.totali.spese)}`}
                />
              </div>
              <div
                className={`rounded-md border bg-white p-2 text-center ${
                  selected ? "border-primary/20" : "border-border"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs font-semibold uppercase text-foreground">{row.label}</p>
                  {selected && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Selezionato
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{row.giorniConDati} giorni</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{valuta.format(row.totali.saldo)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CassaSedePanel({
  sedeId,
  giorno,
  chiusura,
  spese,
  documenti,
  nuovaSpesa,
  uploadingDocId,
  recovering,
  onUpdateChiusura,
  onUpdateNuovaSpesa,
  onAddSpesa,
  onUpdateSpesa,
  onDeleteSpesa,
  onUploadDocumento,
  onDeleteDocumento,
  onRecoverDocumenti,
  onOpenMobileCapture,
  moneyDrafts,
  onMoneyDraftChange,
  onMoneyDraftCommit,
  onSaveChiusura,
  canSave,
  onDeleteChiusura,
  wideLayout,
}: {
  sedeId: SedeCassaId;
  giorno: string;
  chiusura: ChiusuraCassa;
  spese: SpesaCassa[];
  documenti: DocumentoCassa[];
  nuovaSpesa: NuovaSpesaDraft;
  uploadingDocId: string | null;
  recovering: boolean;
  onUpdateChiusura: <K extends keyof ChiusuraCassa>(sedeId: SedeCassaId, field: K, value: ChiusuraCassa[K]) => void;
  onUpdateNuovaSpesa: (patch: Partial<NuovaSpesaDraft>) => void;
  onAddSpesa: () => void;
  onUpdateSpesa: <K extends keyof SpesaCassa>(id: string, field: K, value: SpesaCassa[K]) => void;
  onDeleteSpesa: (id: string) => void | Promise<void>;
  onUploadDocumento: (sedeId: SedeCassaId, tipo: TipoDocumentoCassa, file: File | undefined) => void | Promise<void>;
  onDeleteDocumento: (id: string) => void | Promise<void>;
  onRecoverDocumenti: () => void;
  onOpenMobileCapture: (tipo: TipoDocumentoCassa) => void;
  moneyDrafts: MoneyDrafts;
  onMoneyDraftChange: (key: string, value: string) => void;
  onMoneyDraftCommit: (key: string) => void;
  onSaveChiusura: () => void;
  canSave: boolean;
  onDeleteChiusura: () => void;
  wideLayout: boolean;
}) {
  const speseTotale = spese.reduce((sum, spesa) => sum + spesa.importo, 0);
  const totali = sommaTotali([chiusura], spese);
  const spesaGridClass = wideLayout
    ? "grid gap-2 xl:grid-cols-[minmax(180px,1.3fr)_minmax(130px,.75fr)_minmax(110px,.55fr)_minmax(130px,.75fr)_minmax(160px,1fr)_minmax(130px,.65fr)]"
    : "grid gap-2 md:grid-cols-2";
  const spesaRowClass = wideLayout
    ? "grid gap-2 rounded-md border border-border bg-white p-2 xl:grid-cols-[minmax(180px,1.3fr)_minmax(130px,.75fr)_minmax(110px,.55fr)_minmax(130px,.75fr)_minmax(160px,1fr)_44px]"
    : "grid gap-2 rounded-md border border-border bg-white p-2 md:grid-cols-2";

  return (
    <section className="rounded-md border border-border bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{sedeLabel(sedeId)}</h2>
          <p className="text-sm text-muted-foreground">Chiusura del {formatDate(giorno)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge className="border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
            Saldo {valuta.format(totali.saldo)}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRecoverDocumenti}
            disabled={recovering}
            className="gap-2 bg-white"
          >
            <RefreshCw className={`h-4 w-4 ${recovering ? "animate-spin" : ""}`} />
            {recovering ? "Recupero..." : "Recupera allegati"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDeleteChiusura}
            className="gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Elimina
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyField
            label="Contanti a fine chiusura"
            draftKey={`${sedeId}-${giorno}-contanti`}
            value={chiusura.contanti}
            onChange={(value) => onUpdateChiusura(sedeId, "contanti", value)}
            drafts={moneyDrafts}
            onDraftChange={onMoneyDraftChange}
            onDraftCommit={onMoneyDraftCommit}
          />
          <MoneyField
            label="Bancomat / POS"
            draftKey={`${sedeId}-${giorno}-bancomat`}
            value={chiusura.bancomat}
            onChange={(value) => onUpdateChiusura(sedeId, "bancomat", value)}
            drafts={moneyDrafts}
            onDraftChange={onMoneyDraftChange}
            onDraftCommit={onMoneyDraftCommit}
          />
          <MoneyField
            label="Assegni"
            draftKey={`${sedeId}-${giorno}-assegni`}
            value={chiusura.assegni}
            onChange={(value) => onUpdateChiusura(sedeId, "assegni", value)}
            drafts={moneyDrafts}
            onDraftChange={onMoneyDraftChange}
            onDraftCommit={onMoneyDraftCommit}
          />
          <MoneyField
            label="Fondo cassa lasciato"
            draftKey={`${sedeId}-${giorno}-fondo-cassa`}
            value={chiusura.fondoCassa}
            onChange={(value) => onUpdateChiusura(sedeId, "fondoCassa", value)}
            drafts={moneyDrafts}
            onDraftChange={onMoneyDraftChange}
            onDraftCommit={onMoneyDraftCommit}
          />
        </div>

        <Field label="Note chiusura">
          <Textarea
            value={chiusura.note}
            onChange={(event) => onUpdateChiusura(sedeId, "note", event.target.value)}
            placeholder="Annotazioni sulla chiusura di cassa..."
            className="min-h-20 resize-y"
          />
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <DocumentoUploader
            sedeId={sedeId}
            giorno={giorno}
            tipo="fatturato"
            label="Foglio fatturato giorno"
            documento={documenti.find((documento) => documento.tipo === "fatturato")}
            uploadingDocId={uploadingDocId}
            onUpload={onUploadDocumento}
            onDelete={onDeleteDocumento}
            onOpenMobileCapture={onOpenMobileCapture}
          />
          <DocumentoUploader
            sedeId={sedeId}
            giorno={giorno}
            tipo="pos"
            label="Chiusura giornaliera POS"
            documento={documenti.find((documento) => documento.tipo === "pos")}
            uploadingDocId={uploadingDocId}
            onUpload={onUploadDocumento}
            onDelete={onDeleteDocumento}
            onOpenMobileCapture={onOpenMobileCapture}
          />
        </div>

        <div className="rounded-md border border-border bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Spese giornaliere</h3>
              <p className="text-xs text-muted-foreground">
                Inserisci ogni uscita sostenuta, pagamento medico incluso.
              </p>
            </div>
            <Badge variant="secondary">{valuta.format(speseTotale)}</Badge>
          </div>

          <div className={spesaGridClass}>
            <Input
              value={nuovaSpesa.descrizione}
              onChange={(event) => onUpdateNuovaSpesa({ descrizione: event.target.value })}
              placeholder="Descrizione spesa"
            />
            <Select
              value={nuovaSpesa.categoria}
              onValueChange={(value: CategoriaSpesa) => onUpdateNuovaSpesa({ categoria: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medico">Medico</SelectItem>
                <SelectItem value="materiale">Materiale</SelectItem>
                <SelectItem value="servizi">Servizi</SelectItem>
                <SelectItem value="rimborso">Rimborso</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="text"
              inputMode="decimal"
              value={nuovaSpesa.importo}
              onChange={(event) => onUpdateNuovaSpesa({ importo: event.target.value })}
              placeholder="Importo"
            />
            <Select
              value={nuovaSpesa.metodoPagamento}
              onValueChange={(value: MetodoPagamentoSpesa) => onUpdateNuovaSpesa({ metodoPagamento: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contanti">Contanti</SelectItem>
                <SelectItem value="bancomat">Bancomat</SelectItem>
                <SelectItem value="assegno">Assegno</SelectItem>
                <SelectItem value="bonifico">Bonifico</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={nuovaSpesa.note}
              onChange={(event) => onUpdateNuovaSpesa({ note: event.target.value })}
              placeholder="Note"
            />
            <Button type="button" onClick={onAddSpesa} className="gap-2">
              <Plus className="h-4 w-4" />
              Aggiungi
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {spese.length > 0 ? (
              spese.map((spesa) => (
                <div
                  key={spesa.id}
                  className={spesaRowClass}
                >
                  <Input
                    value={spesa.descrizione}
                    onChange={(event) => onUpdateSpesa(spesa.id, "descrizione", event.target.value)}
                  />
                  <Select
                    value={spesa.categoria}
                    onValueChange={(value: CategoriaSpesa) => onUpdateSpesa(spesa.id, "categoria", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medico">Medico</SelectItem>
                      <SelectItem value="materiale">Materiale</SelectItem>
                      <SelectItem value="servizi">Servizi</SelectItem>
                      <SelectItem value="rimborso">Rimborso</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={moneyDrafts[`spesa-${spesa.id}-importo`] ?? String(spesa.importo).replace(".", ",")}
                    onChange={(event) => {
                      const key = `spesa-${spesa.id}-importo`;
                      onMoneyDraftChange(key, event.target.value);
                      onUpdateSpesa(spesa.id, "importo", parseImporto(event.target.value));
                    }}
                    onBlur={() => onMoneyDraftCommit(`spesa-${spesa.id}-importo`)}
                  />
                  <Select
                    value={spesa.metodoPagamento}
                    onValueChange={(value: MetodoPagamentoSpesa) => onUpdateSpesa(spesa.id, "metodoPagamento", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contanti">Contanti</SelectItem>
                      <SelectItem value="bancomat">Bancomat</SelectItem>
                      <SelectItem value="assegno">Assegno</SelectItem>
                      <SelectItem value="bonifico">Bonifico</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={spesa.note}
                    onChange={(event) => onUpdateSpesa(spesa.id, "note", event.target.value)}
                    placeholder="Note"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteSpesa(spesa.id)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:justify-self-start xl:justify-self-center"
                    aria-label="Elimina spesa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-border bg-white p-3 text-sm text-muted-foreground">
                Nessuna spesa inserita per questa chiusura.
              </div>
            )}
          </div>

          <SpeseMiniChart spese={spese} />

          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-sm text-muted-foreground sm:mr-auto">
              Salva la chiusura dopo aver controllato incassi, allegati e spese.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={onSaveChiusura}
              disabled={!canSave}
              className={saveButtonClassName(canSave, "w-full sm:w-auto")}
            >
              <Save className="h-4 w-4" />
              Salva chiusura
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CassaClosureRows({
  title,
  description,
  rows,
  activeData,
  onEdit,
  onSave,
  canRetrySave,
  onDelete,
}: {
  title: string;
  description: string;
  rows: RigaChiusuraCassa[];
  activeData: string;
  onEdit: (sedeId: SedeCassaId, data: string) => void;
  onSave: (sedeId: SedeCassaId, data: string) => void;
  canRetrySave: boolean;
  onDelete: (sedeId: SedeCassaId, data: string) => void;
}) {
  return (
    <div className="border-t border-border bg-white">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary">{rows.length} chiusure</Badge>
      </div>

      {rows.length > 0 ? (
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const incassi = row.totali.contanti + row.totali.bancomat + row.totali.assegni;
            const active = row.data === activeData;
            const canSaveRow = row.canSave || canRetrySave;
            return (
              <div
                key={row.key}
                className={`grid gap-3 px-4 py-3 md:grid-cols-[140px_120px_1fr_1fr_1fr_150px_auto] md:items-center ${
                  active ? "bg-primary/5" : "bg-white"
                }`}
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data</p>
                  <p className="font-semibold text-foreground">{formatDate(row.data)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sede</p>
                  <p className="font-medium text-foreground">{sedeLabel(row.sedeId)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Incassi</p>
                  <p className="font-semibold text-foreground">{valuta.format(incassi)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spese</p>
                  <p className="font-semibold text-red-700">{valuta.format(row.totali.spese)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo</p>
                  <p className="font-semibold text-foreground">{valuta.format(row.totali.saldo)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{row.speseCount} spese</Badge>
                  <Badge variant="outline">{row.documentiCount} allegati</Badge>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(row.sedeId, row.data)}
                    className="gap-2 bg-white"
                  >
                    <Pencil className="h-4 w-4" />
                    Modifica
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSave(row.sedeId, row.data)}
                    disabled={!canSaveRow}
                    className={saveButtonClassName(canSaveRow)}
                  >
                    <Save className="h-4 w-4" />
                    Salva
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(row.sedeId, row.data)}
                    className="gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4">
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Nessuna chiusura salvata per il mese selezionato.
          </div>
        </div>
      )}
    </div>
  );
}

function AllegatiSenzaChiusuraAlert({
  rows,
  onOpen,
}: {
  rows: Array<{
    key: string;
    sedeId: SedeCassaId;
    data: string;
    documentiCount: number;
  }>;
  onOpen: (sedeId: SedeCassaId, data: string) => void;
}) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-amber-950">Allegati presenti senza dati contabili</h2>
            <p className="mt-1 text-sm text-amber-900">
              Queste date hanno file caricati ma non hanno piu righe di chiusura o spese: per questo i totali risultano a zero.
            </p>
          </div>
        </div>
        <Badge className="w-fit bg-amber-100 text-amber-900 hover:bg-amber-100">{rows.length} date</Badge>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.slice(0, 6).map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{sedeLabel(row.sedeId)} - {formatDate(row.data)}</p>
              <p className="text-xs text-muted-foreground">{row.documentiCount} allegati recuperati</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpen(row.sedeId, row.data)} className="bg-white">
              Apri
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CestinoChiusure({
  rows,
  onRestore,
}: {
  rows: CestinoChiusuraCassa[];
  onRestore: (trashId: string) => void;
}) {
  return (
    <section className="rounded-md border border-border bg-white">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Cestino chiusure</h2>
          <p className="text-sm text-muted-foreground">
            Le chiusure eliminate restano ripristinabili insieme a spese e allegati.
          </p>
        </div>
        <Badge variant="secondary">{rows.length} elementi</Badge>
      </div>

      {rows.length > 0 ? (
        <div className="divide-y divide-border">
          {rows.slice(0, 10).map((row) => (
            <div key={row.id} className="grid gap-3 px-4 py-3 md:grid-cols-[140px_120px_1fr_1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data</p>
                <p className="font-semibold text-foreground">{formatDate(row.data)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sede</p>
                <p className="font-medium text-foreground">{sedeLabel(row.sedeId)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contenuto</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="outline">{row.giorni.length} chiusure</Badge>
                  <Badge variant="outline">{row.spese.length} spese</Badge>
                  <Badge variant="outline">{row.documenti.length} allegati</Badge>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Eliminata</p>
                <p className="text-sm text-muted-foreground">{formatDate(row.deletedAt.slice(0, 10))} {formatTime(row.deletedAt)}</p>
              </div>
              <div className="md:text-right">
                <Button type="button" variant="outline" size="sm" onClick={() => onRestore(row.id)} className="gap-2 bg-white">
                  <RotateCcw className="h-4 w-4" />
                  Ripristina
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4">
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Nessuna chiusura eliminata.
          </div>
        </div>
      )}
    </section>
  );
}

function DocumentoUploader({
  sedeId,
  giorno,
  tipo,
  label,
  documento,
  uploadingDocId,
  onUpload,
  onDelete,
  onOpenMobileCapture,
}: {
  sedeId: SedeCassaId;
  giorno: string;
  tipo: TipoDocumentoCassa;
  label: string;
  documento?: DocumentoCassa;
  uploadingDocId: string | null;
  onUpload: (sedeId: SedeCassaId, tipo: TipoDocumentoCassa, file: File | undefined) => void | Promise<void>;
  onDelete: (id: string) => void;
  onOpenMobileCapture: (tipo: TipoDocumentoCassa) => void;
}) {
  const inputId = `cassa-file-${sedeId}-${giorno}-${tipo}`;
  const docId = documentoId(sedeId, giorno, tipo);
  const uploading = uploadingDocId === docId;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">PDF o foto della giornata.</p>
        </div>
        <input
          id={inputId}
          type="file"
          className="hidden"
          accept=".pdf,image/*"
          onChange={(event) => {
            void onUpload(sedeId, tipo, event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {tipo === "pos" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenMobileCapture(tipo)}
              className="gap-2 bg-white"
            >
              <Camera className="h-4 w-4" />
              Scatta foto
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => document.getElementById(inputId)?.click()}
            className="gap-2 bg-white"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Carico..." : "Carica file"}
          </Button>
        </div>
      </div>

      {documento ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{documento.fileName}</p>
            <p className="text-xs text-muted-foreground">
              Caricato il {formatDate(documento.uploadedAt.slice(0, 10))}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="icon" asChild title="Scarica documento">
              <a href={documento.fileUrl} download={documento.fileName}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(documento.id)}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Elimina documento"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-border bg-white p-3 text-sm text-muted-foreground">
          Nessun documento caricato.
        </div>
      )}
    </div>
  );
}

function DailyTotalsChart({ totali }: { totali: TotaliCassa }) {
  const rows = [
    { label: "Contanti", value: totali.contanti, color: "bg-emerald-500" },
    { label: "Bancomat", value: totali.bancomat, color: "bg-sky-500" },
    { label: "Assegni", value: totali.assegni, color: "bg-violet-500" },
    { label: "Fondo", value: totali.fondoCassa, color: "bg-amber-500" },
    { label: "Spese", value: totali.spese, color: "bg-red-500" },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Grafico giornaliero</h3>
          <p className="text-xs text-muted-foreground">Incassi, fondo cassa e spese del giorno selezionato.</p>
        </div>
      </div>
      <div className="grid grid-cols-5 items-end gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end rounded-md bg-white p-1">
              <div
                className={`w-full rounded-sm ${row.color}`}
                style={{ height: `${Math.max(6, (row.value / max) * 100)}%` }}
              />
            </div>
            <div className="w-full text-center">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{row.label}</p>
              <p className="truncate text-xs font-semibold text-foreground">{valuta.format(row.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpeseMiniChart({ spese }: { spese: SpesaCassa[] }) {
  const rows = CATEGORIE_SPESE.map((categoria) => ({
    ...categoria,
    totale: spese
      .filter((spesa) => spesa.categoria === categoria.id)
      .reduce((sum, spesa) => sum + spesa.importo, 0),
  })).filter((row) => row.totale > 0);
  const max = Math.max(...rows.map((row) => row.totale), 1);

  return (
    <div className="mt-4 rounded-md border border-border bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Grafico spese</h4>
          <p className="text-xs text-muted-foreground">Distribuzione della giornata per categoria.</p>
        </div>
        <Badge variant="secondary">{valuta.format(spese.reduce((sum, spesa) => sum + spesa.importo, 0))}</Badge>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-[110px_1fr_90px] sm:items-center">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: `${Math.max(8, (row.totale / max) * 100)}%` }}
                />
              </div>
              <span className="text-right text-sm font-semibold text-foreground">{valuta.format(row.totale)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Nessuna spesa da rappresentare.
        </div>
      )}
    </div>
  );
}

function MobileCaptureDialog({
  capture,
  giorno,
  captureUrl,
  onClose,
  onRefresh,
}: {
  capture: { sedeId: SedeCassaId; tipo: TipoDocumentoCassa } | null;
  giorno: string;
  captureUrl: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const qrUrl = captureUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=16&data=${encodeURIComponent(captureUrl)}`
    : "";

  return (
    <Dialog open={Boolean(capture)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Scatta foto dal telefono
          </DialogTitle>
        </DialogHeader>

        {capture && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documento</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Chiusura giornaliera POS - {sedeLabel(capture.sedeId)} - {formatDate(giorno)}
              </p>
            </div>

            <div className="flex justify-center rounded-md border border-border bg-white p-4">
              {qrUrl ? (
                <img src={qrUrl} alt="QR per scatto foto cassa" className="h-64 w-64" />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-sm text-muted-foreground">
                  QR non disponibile.
                </div>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-sm text-muted-foreground">
                Apri il QR dal telefono, premi Scatta foto e carica la foto. Questa pagina controlla il DB ogni 5 secondi.
              </p>
              <a
                href={captureUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-xs font-medium text-primary"
              >
                {captureUrl}
              </a>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Aggiorna
              </Button>
              <Button type="button" onClick={onClose}>
                Chiudi
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoneyField({
  label,
  draftKey,
  value,
  onChange,
  drafts,
  onDraftChange,
  onDraftCommit,
}: {
  label: string;
  draftKey: string;
  value: number;
  onChange: (value: number) => void;
  drafts: MoneyDrafts;
  onDraftChange: (key: string, value: string) => void;
  onDraftCommit: (key: string) => void;
}) {
  const displayValue = drafts[draftKey] ?? String(value).replace(".", ",");

  return (
    <Field label={label}>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(event) => {
          onDraftChange(draftKey, event.target.value);
          onChange(parseImporto(event.target.value));
        }}
        onBlur={() => onDraftCommit(draftKey)}
      />
    </Field>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  strong,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${
          strong ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        }`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
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
