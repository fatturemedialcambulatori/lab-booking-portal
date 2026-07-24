import React from "react";
import {
  Banknote,
  Camera,
  CreditCard,
  Download,
  Landmark,
  Plus,
  QrCode,
  RefreshCw,
  ReceiptText,
  Save,
  Trash2,
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
type SaveState = "loading" | "saving" | "saved" | "error";

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

const todayKey = () => new Date().toISOString().slice(0, 10);

const firstDayOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};

const emptyState = (): CassaState => ({
  giorni: [],
  spese: [],
  documenti: [],
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

const parseImporto = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (data: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));

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

const normalizeState = (value: unknown): CassaState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyState();
  const item = value as Partial<CassaState>;
  return {
    giorni: Array.isArray(item.giorni) ? item.giorni.map(normalizeChiusura).filter(Boolean) as ChiusuraCassa[] : [],
    spese: Array.isArray(item.spese) ? item.spese.map(normalizeSpesa).filter(Boolean) as SpesaCassa[] : [],
    documenti: Array.isArray(item.documenti) ? item.documenti.map(normalizeDocumento).filter(Boolean) as DocumentoCassa[] : [],
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

export function AdminCassa({ scope }: { scope: CassaScope }) {
  const [state, setState] = React.useState<CassaState>(emptyState);
  const [giorno, setGiorno] = React.useState(todayKey);
  const [periodoDal, setPeriodoDal] = React.useState(firstDayOfMonth);
  const [periodoAl, setPeriodoAl] = React.useState(todayKey);
  const [saveState, setSaveState] = React.useState<SaveState>("loading");
  const [persistenzaAttiva, setPersistenzaAttiva] = React.useState(false);
  const [uploadingDocId, setUploadingDocId] = React.useState<string | null>(null);
  const [moneyDrafts, setMoneyDrafts] = React.useState<MoneyDrafts>({});
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

  const aggiornaDaDb = React.useCallback(async (showToast = true) => {
    try {
      const response = await fetch("/api/cassa-state");
      if (!response.ok) throw new Error("Cassa non disponibile");
      const data: unknown = await response.json();
      setState(normalizeState(data));
      setSaveState("saved");
      if (showToast) mostraNotifica("Cassa aggiornata dal DB.");
    } catch {
      if (showToast) mostraNotifica("Non sono riuscito ad aggiornare la cassa dal DB.", "destructive");
    }
  }, [mostraNotifica]);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/cassa-state");
        if (!response.ok) throw new Error("Cassa non disponibile");
        const data: unknown = await response.json();
        if (!active) return;
        setState(normalizeState(data));
        setSaveState("saved");
        setPersistenzaAttiva(true);
      } catch {
        if (!active) return;
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
    writeLocalState(state);
    setSaveState("saving");

    const timer = window.setTimeout(() => {
      void fetch("/api/cassa-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Salvataggio non riuscito");
          setSaveState("saved");
        })
        .catch(() => {
          setSaveState("error");
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [persistenzaAttiva, state]);

  React.useEffect(() => {
    if (!mobileCapture) return;
    const timer = window.setInterval(() => {
      void aggiornaDaDb(false);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [aggiornaDaDb, mobileCapture]);

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

  const eliminaSpesa = (id: string) => {
    setState((current) => ({
      ...current,
      spese: current.spese.filter((spesa) => spesa.id !== id),
    }));
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
        fileUrl: data.fileUrl ?? `/api/cassa-files/${encodeURIComponent(id)}`,
        contentType: data.contentType ?? file.type,
        sizeBytes: data.sizeBytes ?? file.size,
        uploadedAt: data.uploadedAt ?? new Date().toISOString(),
      };

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

  const eliminaDocumento = (id: string) => {
    setState((current) => ({
      ...current,
      documenti: current.documenti.filter((documento) => documento.id !== id),
    }));
  };

  const chiusureGiorno = sediVisibili.map((sedeId) => getChiusura(sedeId, giorno));
  const speseGiorno = state.spese.filter((spesa) => sediVisibili.includes(spesa.sedeId) && spesa.data === giorno);
  const totaliGiorno = sommaTotali(chiusureGiorno, speseGiorno);

  const righePeriodo = React.useMemo(() => {
    const dayKeys = new Set<string>();
    state.giorni.forEach((item) => {
      if (sediVisibili.includes(item.sedeId) && item.data >= periodoDal && item.data <= periodoAl) {
        dayKeys.add(item.data);
      }
    });
    state.spese.forEach((item) => {
      if (sediVisibili.includes(item.sedeId) && item.data >= periodoDal && item.data <= periodoAl) {
        dayKeys.add(item.data);
      }
    });
    state.documenti.forEach((item) => {
      if (sediVisibili.includes(item.sedeId) && item.data >= periodoDal && item.data <= periodoAl) {
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
        };
      });
  }, [periodoAl, periodoDal, sediVisibili, state.documenti, state.giorni, state.spese]);

  const statusLabel =
    saveState === "loading"
      ? "Carico"
      : saveState === "saving"
        ? "Salvataggio"
        : saveState === "saved"
          ? "Salvato"
          : "Solo locale";

  const captureUrl = React.useMemo(() => {
    if (!mobileCapture || typeof window === "undefined") return "";
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = new URL(`${basePath}/cassa-camera`, window.location.origin);
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
        <Badge variant="secondary" className="w-fit gap-2">
          <Save className="h-3.5 w-3.5" />
          {statusLabel}
        </Badge>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-border bg-white p-3 sm:p-4 lg:grid-cols-[220px_1fr_1fr_220px]">
        <Field label="Giorno chiusura">
          <Input type="date" value={giorno} onChange={(event) => setGiorno(event.target.value)} />
        </Field>
        <Field label="Riepilogo dal">
          <Input type="date" value={periodoDal} onChange={(event) => setPeriodoDal(event.target.value)} />
        </Field>
        <Field label="Riepilogo al">
          <Input type="date" value={periodoAl} onChange={(event) => setPeriodoAl(event.target.value)} />
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

      <div className={scope === "tutte" ? "grid gap-4 xl:grid-cols-2" : "grid gap-4"}>
        {sediVisibili.map((sedeId) => (
          <CassaSedePanel
            key={sedeId}
            sedeId={sedeId}
            giorno={giorno}
            chiusura={getChiusura(sedeId, giorno)}
            spese={speseGiornoSede(sedeId, giorno)}
            documenti={documentiGiornoSede(sedeId, giorno)}
            nuovaSpesa={nuoveSpese[sedeId]}
            uploadingDocId={uploadingDocId}
            onUpdateChiusura={updateChiusura}
            onUpdateNuovaSpesa={(patch) =>
              setNuoveSpese((current) => ({ ...current, [sedeId]: { ...current[sedeId], ...patch } }))
            }
            onAddSpesa={() => aggiungiSpesa(sedeId)}
            onUpdateSpesa={updateSpesa}
            onDeleteSpesa={eliminaSpesa}
            onUploadDocumento={uploadDocumento}
            onDeleteDocumento={eliminaDocumento}
            onOpenMobileCapture={(tipo) => setMobileCapture({ sedeId, tipo })}
            moneyDrafts={moneyDrafts}
            onMoneyDraftChange={updateMoneyDraft}
            onMoneyDraftCommit={clearMoneyDraft}
            wideLayout={scope !== "tutte"}
          />
        ))}
      </div>

      <div className="rounded-md border border-border bg-white">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Riepilogo giorno per giorno</h2>
            <p className="text-sm text-muted-foreground">
              Totali dal {formatDate(periodoDal)} al {formatDate(periodoAl)} per {scopeLabel.toLowerCase()}.
            </p>
          </div>
          <Badge variant="secondary">{righePeriodo.length} giorni</Badge>
        </div>
        <RiepilogoPeriodoChart righe={righePeriodo} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-right">Contanti</th>
                <th className="px-4 py-3 text-right">Bancomat</th>
                <th className="px-4 py-3 text-right">Assegni</th>
                <th className="px-4 py-3 text-right">Fondo cassa</th>
                <th className="px-4 py-3 text-right">Spese</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-left">Documenti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {righePeriodo.length > 0 ? (
                righePeriodo.map((riga) => (
                  <tr key={riga.data}>
                    <td className="px-4 py-3 font-medium text-foreground">{formatDate(riga.data)}</td>
                    <td className="px-4 py-3 text-right">{valuta.format(riga.totali.contanti)}</td>
                    <td className="px-4 py-3 text-right">{valuta.format(riga.totali.bancomat)}</td>
                    <td className="px-4 py-3 text-right">{valuta.format(riga.totali.assegni)}</td>
                    <td className="px-4 py-3 text-right">{valuta.format(riga.totali.fondoCassa)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{valuta.format(riga.totali.spese)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{valuta.format(riga.totali.saldo)}</td>
                    <td className="px-4 py-3">
                      {riga.documenti.length > 0 ? `${riga.documenti.length} allegati` : "Nessun allegato"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Nessuna chiusura nel periodo selezionato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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

function CassaSedePanel({
  sedeId,
  giorno,
  chiusura,
  spese,
  documenti,
  nuovaSpesa,
  uploadingDocId,
  onUpdateChiusura,
  onUpdateNuovaSpesa,
  onAddSpesa,
  onUpdateSpesa,
  onDeleteSpesa,
  onUploadDocumento,
  onDeleteDocumento,
  onOpenMobileCapture,
  moneyDrafts,
  onMoneyDraftChange,
  onMoneyDraftCommit,
  wideLayout,
}: {
  sedeId: SedeCassaId;
  giorno: string;
  chiusura: ChiusuraCassa;
  spese: SpesaCassa[];
  documenti: DocumentoCassa[];
  nuovaSpesa: NuovaSpesaDraft;
  uploadingDocId: string | null;
  onUpdateChiusura: <K extends keyof ChiusuraCassa>(sedeId: SedeCassaId, field: K, value: ChiusuraCassa[K]) => void;
  onUpdateNuovaSpesa: (patch: Partial<NuovaSpesaDraft>) => void;
  onAddSpesa: () => void;
  onUpdateSpesa: <K extends keyof SpesaCassa>(id: string, field: K, value: SpesaCassa[K]) => void;
  onDeleteSpesa: (id: string) => void;
  onUploadDocumento: (sedeId: SedeCassaId, tipo: TipoDocumentoCassa, file: File | undefined) => void | Promise<void>;
  onDeleteDocumento: (id: string) => void;
  onOpenMobileCapture: (tipo: TipoDocumentoCassa) => void;
  moneyDrafts: MoneyDrafts;
  onMoneyDraftChange: (key: string, value: string) => void;
  onMoneyDraftCommit: (key: string) => void;
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
        <Badge className="border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
          Saldo {valuta.format(totali.saldo)}
        </Badge>
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
              type="number"
              min={0}
              step={0.01}
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
        </div>
      </div>
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

function RiepilogoPeriodoChart({
  righe,
}: {
  righe: Array<{ data: string; totali: TotaliCassa; documenti: DocumentoCassa[] }>;
}) {
  const rows = righe.slice(0, 10).reverse();
  const max = Math.max(
    ...rows.flatMap((row) => [
      row.totali.contanti + row.totali.bancomat + row.totali.assegni,
      row.totali.spese,
    ]),
    1,
  );

  return (
    <div className="border-b border-border p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Andamento giornaliero</h3>
          <p className="text-xs text-muted-foreground">Ultimi {rows.length} giorni nel filtro corrente.</p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Incassi</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Spese</span>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="flex min-h-40 gap-2 overflow-x-auto pb-1">
          {rows.map((row) => {
            const incassi = row.totali.contanti + row.totali.bancomat + row.totali.assegni;
            return (
              <div key={row.data} className="flex min-w-16 flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-28 w-full items-end justify-center gap-1 rounded-md bg-muted/40 p-1.5">
                  <div
                    className="w-4 rounded-sm bg-primary"
                    style={{ height: `${Math.max(4, (incassi / max) * 100)}%` }}
                    title={`Incassi ${valuta.format(incassi)}`}
                  />
                  <div
                    className="w-4 rounded-sm bg-red-500"
                    style={{ height: `${Math.max(4, (row.totali.spese / max) * 100)}%` }}
                    title={`Spese ${valuta.format(row.totali.spese)}`}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-medium text-muted-foreground">{formatDate(row.data).slice(0, 5)}</p>
                  <p className="text-xs font-semibold text-foreground">{valuta.format(row.totali.saldo)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Nessun dato giornaliero da rappresentare.
        </div>
      )}
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
