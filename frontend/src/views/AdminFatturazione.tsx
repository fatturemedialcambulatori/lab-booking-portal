import React from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  RefreshCw,
  ShieldCheck,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type InvoiceDirection = "out" | "in";

type ArubaStatus = {
  configured?: boolean;
  missing?: string[];
  environment?: "demo" | "production";
  readOnly?: boolean;
  authBaseUrl?: string;
  wsBaseUrl?: string;
  usernameConfigured?: boolean;
  senderVatConfigured?: boolean;
  receiverVatConfigured?: boolean;
};

type ArubaCompany = {
  description?: string;
  countryCode?: string;
  vatCode?: string;
  fiscalCode?: string;
};

type ArubaInvoiceRow = {
  invoiceDate?: string;
  number?: string;
  documentType?: string;
  status?: string;
  statusDescription?: string;
  totalDocument?: number | string;
  totalVat?: number | string;
  netPayable?: number | string;
};

type ArubaInvoiceLot = {
  id?: string;
  idSdi?: string;
  filename?: string;
  docType?: string;
  creationDate?: string;
  lastUpdate?: string;
  pddAvailable?: boolean;
  invoiceDate?: string;
  number?: string;
  documentType?: string;
  status?: string;
  statusDescription?: string;
  totalDocument?: number | string;
  totalVat?: number | string;
  netPayable?: number | string;
  counterpartyName?: string;
  counterpartyCountry?: string;
  counterpartyVatCode?: string;
  counterpartyFiscalCode?: string;
  sender?: ArubaCompany;
  receiver?: ArubaCompany;
  invoices?: ArubaInvoiceRow[];
};

type ArubaInvoicePayload = {
  content?: ArubaInvoiceLot[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  numberOfElements?: number;
  size?: number;
  first?: boolean;
  last?: boolean;
};

type ArubaInvoicesResponse = {
  direction?: InvoiceDirection;
  source?: "local-cache";
  cacheUpdatedAt?: string;
  lastSync?: ArubaSyncState | null;
  data?: ArubaInvoicePayload;
};

type ArubaSyncState = {
  id: string;
  direction: InvoiceDirection;
  status: "idle" | "running" | "completed" | "failed";
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  creationStartDate: string;
  creationEndDate: string;
  totalWindows: number;
  completedWindows: number;
  totalProviderRequests: number;
  importedCount: number;
  error?: string;
  providerStatus?: number;
  retryAfterSeconds?: number;
};

type FatturazioneApiErrorPayload = {
  error?: string;
  providerStatus?: number;
  providerMessage?: string;
  operation?: string;
  hint?: string;
  retryAfterSeconds?: number;
};

class FatturazioneApiError extends Error {
  readonly statusCode: number;
  readonly providerStatus?: number;
  readonly providerMessage?: string;
  readonly operation?: string;
  readonly hint?: string;
  readonly retryAfterSeconds?: number;

  constructor(statusCode: number, payload: FatturazioneApiErrorPayload) {
    super(payload.error || "Servizio fatturazione non disponibile");
    this.name = "FatturazioneApiError";
    this.statusCode = statusCode;
    this.providerStatus = payload.providerStatus;
    this.providerMessage = payload.providerMessage;
    this.operation = payload.operation;
    this.hint = payload.hint;
    this.retryAfterSeconds = payload.retryAfterSeconds;
  }
}

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayKey = () => localDateKey(new Date());
const yearStartKey = () => `${new Date().getFullYear()}-01-01`;

const formatDateTime = (value: string | undefined) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "dd MMM yyyy HH:mm", { locale: it });
  } catch {
    return value;
  }
};

const readAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const firstInvoice = (lot: ArubaInvoiceLot): ArubaInvoiceRow => lot.invoices?.[0] ?? {
  invoiceDate: lot.invoiceDate,
  number: lot.number,
  documentType: lot.documentType,
  status: lot.status,
  statusDescription: lot.statusDescription,
  totalDocument: lot.totalDocument,
  totalVat: lot.totalVat,
  netPayable: lot.netPayable,
};

const companyLabel = (company: ArubaCompany | undefined) => {
  if (!company) return "-";
  const fiscal = company.vatCode || company.fiscalCode;
  return [company.description, fiscal].filter(Boolean).join(" - ") || "-";
};

const counterpartyLabel = (lot: ArubaInvoiceLot, direction: InvoiceDirection) => {
  if (lot.counterpartyName || lot.counterpartyVatCode || lot.counterpartyFiscalCode) {
    return [lot.counterpartyName, lot.counterpartyVatCode || lot.counterpartyFiscalCode].filter(Boolean).join(" - ");
  }
  return companyLabel(direction === "out" ? lot.receiver : lot.sender);
};

const countCedenti = (value: unknown) => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const item = value as { content?: unknown[]; numberOfElements?: number };
    if (Array.isArray(item.content)) return item.content.length;
    if (typeof item.numberOfElements === "number") return item.numberOfElements;
  }
  return 0;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { credentials: "include" });
  const data = await response.json().catch(() => ({})) as FatturazioneApiErrorPayload;
  if (!response.ok) {
    throw new FatturazioneApiError(response.status, data);
  }
  return data as T;
};

const describeError = (err: unknown) => {
  if (!(err instanceof FatturazioneApiError)) {
    return err instanceof Error ? err.message : "Servizio fatturazione non disponibile";
  }

  return [
    err.message,
    err.providerStatus ? `Codice Aruba: ${err.providerStatus}` : null,
    err.retryAfterSeconds ? `Riprova tra circa ${err.retryAfterSeconds} secondi` : null,
    err.providerMessage ? `Dettaglio Aruba: ${err.providerMessage}` : null,
    err.hint,
  ].filter(Boolean).join(" · ");
};

export function AdminFatturazione() {
  const [status, setStatus] = React.useState<ArubaStatus | null>(null);
  const [userInfo, setUserInfo] = React.useState<unknown>(null);
  const [cedenti, setCedenti] = React.useState<unknown>(null);
  const [direction, setDirection] = React.useState<InvoiceDirection>("out");
  const [dateFrom, setDateFrom] = React.useState(yearStartKey);
  const [dateTo, setDateTo] = React.useState(todayKey);
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState("10");
  const [invoices, setInvoices] = React.useState<ArubaInvoicesResponse | null>(null);
  const [syncState, setSyncState] = React.useState<ArubaSyncState | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [loadingMeta, setLoadingMeta] = React.useState(false);
  const [loadingInvoices, setLoadingInvoices] = React.useState(false);
  const [startingSync, setStartingSync] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const invoicePayload = invoices?.data;
  const invoiceRows = Array.isArray(invoicePayload?.content) ? invoicePayload.content : [];
  const totalElements = invoicePayload?.totalElements ?? invoiceRows.length;
  const totalPages = Math.max(1, invoicePayload?.totalPages ?? 1);
  const totalAmount = invoiceRows.reduce((sum, lot) => sum + readAmount(firstInvoice(lot).totalDocument), 0);

  const loadStatus = React.useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const data = await fetchJson<ArubaStatus>("/api/fatturazione/status");
      setStatus(data);
    } catch (err) {
      setStatus(null);
      setError(describeError(err));
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadMeta = React.useCallback(async () => {
    if (!status?.configured) return;
    setLoadingMeta(true);
    try {
      const userResponse = await fetchJson<{ data?: unknown }>("/api/fatturazione/user-info");
      setUserInfo(userResponse.data ?? null);

      try {
        const cedentiResponse = await fetchJson<{ data?: unknown }>("/api/fatturazione/cedenti");
        setCedenti(cedentiResponse.data ?? null);
      } catch (err) {
        setCedenti(null);
        toast({
          title: "Cedenti Aruba non disponibili",
          description: describeError(err),
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Connessione Aruba non riuscita",
        description: describeError(err),
        variant: "destructive",
      });
    } finally {
      setLoadingMeta(false);
    }
  }, [status?.configured]);

  const loadInvoices = React.useCallback(async () => {
    if (!status?.configured) return;
    setLoadingInvoices(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        direction,
        creationStartDate: dateFrom,
        creationEndDate: dateTo,
        page: String(page),
        size,
      });
      const data = await fetchJson<ArubaInvoicesResponse>(`/api/fatturazione/cache?${params.toString()}`);
      setInvoices(data);
      setSyncState((current) => data.lastSync ?? current);
    } catch (err) {
      setInvoices(null);
      setError(describeError(err));
    } finally {
      setLoadingInvoices(false);
    }
  }, [dateFrom, dateTo, direction, page, size, status?.configured]);

  const loadSync = React.useCallback(async () => {
    if (!status?.configured) return;
    try {
      const data = await fetchJson<{ sync?: ArubaSyncState | null }>("/api/fatturazione/sync");
      setSyncState(data.sync ?? null);
    } catch {
      setSyncState(null);
    }
  }, [status?.configured]);

  const startSync = async () => {
    if (!status?.configured || startingSync) return;
    setStartingSync(true);
    setError(null);
    try {
      const response = await fetch("/api/fatturazione/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          creationStartDate: dateFrom,
          creationEndDate: dateTo,
          size: 100,
        }),
      });
      const data = await response.json().catch(() => ({})) as { sync?: ArubaSyncState } & FatturazioneApiErrorPayload;
      if (!response.ok) throw new FatturazioneApiError(response.status, data);
      setSyncState(data.sync ?? null);
      toast({
        title: "Sincronizzazione avviata",
        description: "Il backend recupera le fatture Aruba in background rispettando i limiti API.",
      });
    } catch (err) {
      toast({
        title: "Sincronizzazione non avviata",
        description: describeError(err),
        variant: "destructive",
      });
    } finally {
      setStartingSync(false);
    }
  };

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  React.useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  React.useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  React.useEffect(() => {
    void loadSync();
  }, [loadSync]);

  React.useEffect(() => {
    if (syncState?.status !== "running") return;
    const timer = window.setInterval(() => {
      void loadSync();
      void loadInvoices();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadInvoices, loadSync, syncState?.status]);

  const refreshAll = () => {
    void loadStatus();
    void loadMeta();
    void loadSync();
    void loadInvoices();
  };

  const environmentLabel = status?.environment === "production" ? "Produzione" : "Demo";
  const userInfoRecord = userInfo && typeof userInfo === "object" ? userInfo as Record<string, unknown> : {};
  const userLabel = typeof userInfoRecord["userName"] === "string"
    ? userInfoRecord["userName"]
    : typeof userInfoRecord["username"] === "string"
      ? userInfoRecord["username"]
      : status?.usernameConfigured
        ? "Configurata"
        : "-";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Solo lettura
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Solo Admin
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fatturazione</h1>
          <p className="text-sm text-muted-foreground">
            Consultazione Aruba Fatturazione Elettronica senza operazioni di emissione.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={refreshAll}>
            <RefreshCw className={`h-4 w-4 ${loadingStatus || loadingMeta || loadingInvoices ? "animate-spin" : ""}`} />
            Aggiorna archivio
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={!status?.configured || startingSync || syncState?.status === "running"}
            onClick={() => void startSync()}
          >
            <RefreshCw className={`h-4 w-4 ${startingSync || syncState?.status === "running" ? "animate-spin" : ""}`} />
            Sincronizza da Aruba
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stato</p>
          <p className="mt-2 flex items-center gap-2 text-lg font-bold text-foreground">
            {loadingStatus ? (
              <Skeleton className="h-6 w-24" />
            ) : status?.configured ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Configurata
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Da configurare
              </>
            )}
          </p>
        </div>
        <div className="rounded-md border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ambiente</p>
          <p className="mt-2 text-lg font-bold text-foreground">{loadingStatus ? <Skeleton className="h-6 w-20" /> : environmentLabel}</p>
        </div>
        <div className="rounded-md border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Utenza</p>
          <p className="mt-2 truncate text-lg font-bold text-foreground">{loadingMeta ? <Skeleton className="h-6 w-28" /> : userLabel}</p>
        </div>
        <div className="rounded-md border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cedenti</p>
          <p className="mt-2 text-lg font-bold text-foreground">{loadingMeta ? <Skeleton className="h-6 w-12" /> : countCedenti(cedenti)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {syncState && (
        <div className="rounded-md border border-border bg-white p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Sync {syncState.direction === "out" ? "fatture inviate" : "fatture ricevute"}: {syncState.status === "running" ? "in corso" : syncState.status === "completed" ? "completata" : syncState.status === "failed" ? "fallita" : "pronta"}
              </p>
              <p className="text-xs text-muted-foreground">
                Finestre {syncState.completedWindows}/{syncState.totalWindows} · richieste Aruba {syncState.totalProviderRequests} · righe importate {syncState.importedCount}
              </p>
              {syncState.error && (
                <p className="mt-1 text-xs text-destructive">
                  {syncState.error}{syncState.retryAfterSeconds ? ` · Riprova tra circa ${syncState.retryAfterSeconds} secondi` : ""}
                </p>
              )}
            </div>
            <Badge variant={syncState.status === "completed" ? "default" : syncState.status === "failed" ? "destructive" : "outline"}>
              {Math.round((syncState.completedWindows / Math.max(1, syncState.totalWindows)) * 100)}%
            </Badge>
          </div>
        </div>
      )}

      {status && !status.configured && (
        <div className="rounded-md border border-border bg-white p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Credenziali Aruba non configurate nel backend.</p>
              <p className="text-sm text-muted-foreground">
                Mancano: {(status.missing ?? []).map((item) => <code key={item} className="rounded bg-slate-100 px-1.5 py-0.5">{item}</code>)}
              </p>
              <p className="text-sm text-muted-foreground">
                Configura le variabili nel backend o nel secret manager, poi riavvia il server.
              </p>
            </div>
          </div>
        </div>
      )}

      {status?.configured && (
        <div className="rounded-md border border-border bg-white">
          <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={direction === "out" ? "default" : "outline"}
                className="gap-2"
                onClick={() => {
                  setDirection("out");
                  setPage(1);
                }}
              >
                <FileText className="h-4 w-4" />
                Inviate
              </Button>
              <Button
                type="button"
                variant={direction === "in" ? "default" : "outline"}
                className="gap-2"
                onClick={() => {
                  setDirection("in");
                  setPage(1);
                }}
              >
                <Building2 className="h-4 w-4" />
                Ricevute
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[160px_160px_120px_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Da</Label>
                <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">A</Label>
                <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Righe</Label>
                <Select value={size} onValueChange={(value) => { setSize(value); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" className="w-full gap-2" onClick={() => void loadInvoices()}>
                  <RefreshCw className={`h-4 w-4 ${loadingInvoices ? "animate-spin" : ""}`} />
                  Cerca
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b border-border p-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documenti</p>
              <p className="mt-1 text-xl font-bold text-foreground">{loadingInvoices ? <Skeleton className="h-7 w-16" /> : totalElements}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Totale pagina</p>
              <p className="mt-1 text-xl font-bold text-foreground">{loadingInvoices ? <Skeleton className="h-7 w-28" /> : euro.format(totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagina</p>
              <p className="mt-1 text-xl font-bold text-foreground">{page} / {totalPages}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>{direction === "out" ? "Cliente" : "Fornitore"}</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>SDI</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingInvoices && (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                )}

                {!loadingInvoices && invoiceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center">
                      <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-sm text-muted-foreground">
                        <p>
                          {syncState?.status === "running"
                            ? "Sincronizzazione in corso: le fatture compariranno appena Aruba restituisce finestre con documenti."
                            : syncState
                            ? "Nessuna fattura presente nella cache per l'intervallo selezionato."
                            : "Archivio locale vuoto: avvia la sincronizzazione per importare i metadati da Aruba."}
                        </p>
                        {!syncState && (
                          <Button
                            type="button"
                            className="gap-2"
                            disabled={startingSync}
                            onClick={() => void startSync()}
                          >
                            <RefreshCw className={`h-4 w-4 ${startingSync ? "animate-spin" : ""}`} />
                            Sincronizza da Aruba
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!loadingInvoices && invoiceRows.map((lot) => {
                  const invoice = firstInvoice(lot);
                  return (
                    <TableRow key={`${lot.id ?? lot.filename ?? lot.idSdi}`}>
                      <TableCell className="font-medium">{invoice.number || lot.id || "-"}</TableCell>
                      <TableCell>{formatDateTime(invoice.invoiceDate ?? lot.creationDate)}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{counterpartyLabel(lot, direction)}</TableCell>
                      <TableCell>{invoice.documentType || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{invoice.status || "Letta"}</Badge>
                      </TableCell>
                      <TableCell>{lot.idSdi || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{euro.format(readAmount(invoice.totalDocument))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">
              La tabella legge la cache locale{invoices?.cacheUpdatedAt ? `, stato aggiornato ${formatDateTime(invoices.cacheUpdatedAt)}` : ""}. La sincronizzazione parte dalle finestre piu recenti e rispetta il limite Aruba di 2 giorni.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1 || loadingInvoices} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Indietro
              </Button>
              <Button type="button" variant="outline" disabled={page >= totalPages || loadingInvoices} onClick={() => setPage((current) => current + 1)}>
                Avanti
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
