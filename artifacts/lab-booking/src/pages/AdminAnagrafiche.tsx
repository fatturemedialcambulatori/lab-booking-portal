import React from "react";
import {
  useListPatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
  getListPatientsQueryKey,
  type Patient,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  UserPlus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  CalendarDays,
  Users,
  Building2,
  Trophy,
  AlertCircle,
  UserCheck,
  Upload,
  Bell,
  Link2,
  Eye,
  Euro,
  Percent,
  FileText,
  Plus,
  X,
} from "lucide-react";
import { parseFiscalCode } from "@/lib/fiscalCode";
import { BulkImportDialog } from "@/components/BulkImportDialog";

type RecordType = "privato" | "azienda" | "societa_sportiva";
type RecordTypeFilter = "tutte" | RecordType;

type PrestazioneCatalogo = {
  id: string;
  nome: string;
  specialita: string;
  durata: number;
  attiva?: boolean;
};

type ConventionPricingMode = "fixed" | "discount";

type ConventionServiceForm = {
  id: string;
  prestazioneId: string;
  nome: string;
  specialita: string;
  durata: number;
  pricingMode: ConventionPricingMode;
  discountPercent: string;
  prezzo: string;
};

type ConventionTemplateService = {
  id: string;
  prestazioneId: string;
  nome: string;
  specialita: string;
  durata: number;
  pricingMode?: ConventionPricingMode;
  discountPercent?: number;
  prezzo: number;
};

type ConventionTemplate = {
  id: string;
  nome: string;
  descrizione: string;
  attiva: boolean;
  services: ConventionTemplateService[];
};

type PatientForm = {
  recordType: RecordType;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  codiceFiscale: string;
  gender: "M" | "F" | "";
  companyName: string;
  vatNumber: string;
  contactPerson: string;
  conventionActive: boolean;
  conventionExpiresAt: string;
  conventionText: string;
  conventionServices: ConventionServiceForm[];
  linkedConventionIds: number[];
  email: string;
  phone: string;
  notes: string;
  billingAddress: string;
  billingCap: string;
  billingCity: string;
  billingProvincia: string;
};

const emptyForm = (): PatientForm => ({
  recordType: "privato",
  firstName: "", lastName: "", dateOfBirth: "", codiceFiscale: "", gender: "", email: "", phone: "", notes: "",
  companyName: "", vatNumber: "", contactPerson: "",
  conventionActive: false, conventionExpiresAt: "", conventionText: "", conventionServices: [], linkedConventionIds: [],
  billingAddress: "", billingCap: "", billingCity: "", billingProvincia: "",
});

function isFormValid(f: PatientForm) {
  if (f.recordType === "privato") {
    return f.firstName.trim() && f.lastName.trim() && f.dateOfBirth && f.email.trim() && f.phone.trim();
  }
  return f.companyName.trim() && f.email.trim() && f.phone.trim();
}

const today = new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 50;
const CONVENTION_WARNING_DAYS = 30;

const byPatientName = (a: Patient, b: Patient) =>
  patientDisplayName(a).localeCompare(patientDisplayName(b), "it", { sensitivity: "base" });

const RECORD_TYPE_OPTIONS: Array<{ id: RecordType; label: string; Icon: typeof Users }> = [
  { id: "privato", label: "Privato", Icon: Users },
  { id: "azienda", label: "Azienda", Icon: Building2 },
  { id: "societa_sportiva", label: "Societa sportiva", Icon: Trophy },
];

const FILTER_OPTIONS: Array<{ id: RecordTypeFilter; label: string }> = [
  { id: "tutte", label: "Tutte" },
  { id: "privato", label: "Privati" },
  { id: "azienda", label: "Aziende" },
  { id: "societa_sportiva", label: "Societa sportive" },
];

const recordTypeLabel = (type: Patient["recordType"] | RecordType = "privato") =>
  RECORD_TYPE_OPTIONS.find((option) => option.id === (type ?? "privato"))?.label ?? "Privato";

const patientDisplayName = (patient: Patient) =>
  patient.recordType && patient.recordType !== "privato" && patient.companyName
    ? patient.companyName
    : `${patient.firstName} ${patient.lastName}`.trim();

const patientInitials = (patient: Patient) => {
  const name = patientDisplayName(patient);
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "A"}${parts[1]?.[0] ?? ""}`.toUpperCase();
};

const parseDateKey = (value: string) => new Date(`${value}T12:00:00`);

const daysUntil = (dateKey?: string | null) => {
  if (!dateKey) return null;
  const diff = parseDateKey(dateKey).getTime() - parseDateKey(today).getTime();
  return Math.ceil(diff / 86_400_000);
};

const isConventionHolder = (patient: Patient) =>
  patient.recordType === "azienda" || patient.recordType === "societa_sportiva";

const isConventionExpiring = (patient: Patient) => {
  const days = daysUntil(patient.conventionExpiresAt);
  return Boolean(patient.conventionActive && days !== null && days >= 0 && days <= CONVENTION_WARNING_DAYS);
};

const conventionLabel = (patient: Patient) => {
  const days = daysUntil(patient.conventionExpiresAt);
  if (!patient.conventionActive) return "Convenzione non attiva";
  if (days !== null && days < 0) return "Convenzione scaduta";
  if (days !== null && days <= CONVENTION_WARNING_DAYS) return `Scade tra ${days} giorni`;
  return patient.conventionExpiresAt ? `Attiva fino al ${patient.conventionExpiresAt}` : "Convenzione attiva";
};

const valuta = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const parseImporto = (value: string | number | null | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const prezzoToDraft = (value: string | number | null | undefined) => {
  const parsed = parseImporto(value);
  return parsed > 0 ? String(parsed).replace(".", ",") : "";
};

const normalizzaPricingMode = (value: unknown): ConventionPricingMode =>
  value === "discount" ? "discount" : "fixed";

const conventionPriceLabel = (servizio: {
  pricingMode?: string | null;
  discountPercent?: string | number | null;
  prezzo?: string | number | null;
}) => {
  if (servizio.pricingMode === "discount") {
    return `${parseImporto(servizio.discountPercent).toLocaleString("it-IT")}% sconto`;
  }

  return valuta.format(parseImporto(servizio.prezzo));
};

const normalizeConventionTemplate = (value: unknown, index = 0): ConventionTemplate | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ConventionTemplate>;
  if (typeof item.id !== "string" || typeof item.nome !== "string") return null;

  return {
    id: item.id,
    nome: item.nome,
    descrizione: item.descrizione ?? "",
    attiva: item.attiva !== false,
    services: Array.isArray(item.services)
      ? item.services.map((service, serviceIndex) => {
          const row = service as Partial<ConventionTemplateService>;
          return {
            id: row.id || row.prestazioneId || `convenzione-${index}-${serviceIndex}`,
            prestazioneId: row.prestazioneId ?? row.id ?? "",
            nome: row.nome ?? "Prestazione",
            specialita: row.specialita ?? "",
            durata: Math.max(5, Number(row.durata ?? 30) || 30),
            pricingMode: normalizzaPricingMode(row.pricingMode),
            discountPercent: Math.max(0, Math.min(100, Number(row.discountPercent ?? 0) || 0)),
            prezzo: Math.max(0, Number(row.prezzo ?? 0) || 0),
          };
        }).filter((service) => Boolean(service.prestazioneId))
      : [],
  };
};

const conventionServicesFromPatient = (patient: Patient): ConventionServiceForm[] =>
  (patient.conventionServices ?? []).map((servizio, index) => ({
    id: servizio.id || servizio.prestazioneId || `convenzione-${index}`,
    prestazioneId: servizio.prestazioneId,
    nome: servizio.nome,
    specialita: servizio.specialita ?? "",
    durata: Number(servizio.durata ?? 0),
    pricingMode: normalizzaPricingMode(servizio.pricingMode),
    discountPercent: prezzoToDraft(servizio.discountPercent ?? 0),
    prezzo: prezzoToDraft(servizio.prezzo),
  }));

const patientToForm = (p: Patient): PatientForm => ({
  firstName: p.firstName,
  lastName: p.lastName,
  dateOfBirth: String(p.dateOfBirth).slice(0, 10),
  codiceFiscale: p.codiceFiscale ?? "",
  gender: (p.gender as "M" | "F" | "") ?? "",
  recordType: p.recordType ?? "privato",
  companyName: p.companyName ?? "",
  vatNumber: p.vatNumber ?? "",
  contactPerson: p.contactPerson ?? "",
  conventionActive: Boolean(p.conventionActive),
  conventionExpiresAt: p.conventionExpiresAt ?? "",
  conventionText: p.conventionText ?? "",
  conventionServices: conventionServicesFromPatient(p),
  linkedConventionIds: p.linkedConventionIds ?? [],
  email: p.email,
  phone: p.phone,
  notes: p.notes ?? "",
  billingAddress: p.billingAddress ?? "",
  billingCap: p.billingCap ?? "",
  billingCity: p.billingCity ?? "",
  billingProvincia: p.billingProvincia ?? "",
});

const isAdminSettingsPrestazioni = (value: unknown): value is {
  prestazioni: PrestazioneCatalogo[];
  conventionTemplates?: ConventionTemplate[];
} =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Array.isArray((value as { prestazioni?: unknown }).prestazioni),
  );

const patientFormPayload = (form: PatientForm) => {
  const isOrganization = form.recordType !== "privato";
  const companyName = form.companyName.trim();
  return {
    recordType: form.recordType,
    firstName: isOrganization ? (form.firstName.trim() || "Referente") : form.firstName.trim(),
    lastName: isOrganization ? (form.lastName.trim() || companyName) : form.lastName.trim(),
    dateOfBirth: isOrganization ? (form.dateOfBirth || "1900-01-01") : form.dateOfBirth,
    codiceFiscale: form.codiceFiscale.trim() || null,
    gender: form.gender || null,
    companyName: isOrganization ? companyName || null : null,
    vatNumber: form.vatNumber.trim() || null,
    contactPerson: form.contactPerson.trim() || null,
    conventionActive: isOrganization ? form.conventionActive : false,
    conventionExpiresAt: isOrganization ? form.conventionExpiresAt || null : null,
    conventionText: isOrganization ? form.conventionText.trim() || null : null,
    conventionServices: isOrganization
      ? form.conventionServices.map((servizio) => ({
          ...servizio,
          pricingMode: servizio.pricingMode,
          discountPercent: servizio.pricingMode === "discount" ? parseImporto(servizio.discountPercent) : 0,
          prezzo: servizio.pricingMode === "fixed" ? parseImporto(servizio.prezzo) : 0,
        }))
      : [],
    linkedConventionIds: isOrganization ? [] : form.linkedConventionIds,
    email: form.email.trim(),
    phone: form.phone.trim(),
    notes: form.notes.trim() || null,
    billingAddress: form.billingAddress.trim() || null,
    billingCap: form.billingCap.trim() || null,
    billingCity: form.billingCity.trim() || null,
    billingProvincia: form.billingProvincia.trim() || null,
  };
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function AdminAnagrafiche() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [recordTypeFilter, setRecordTypeFilter] = React.useState<RecordTypeFilter>("tutte");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showBulkImport, setShowBulkImport] = React.useState(false);
  const [editPatient, setEditPatient] = React.useState<{ id: number; form: PatientForm } | null>(null);
  const [schedaPatient, setSchedaPatient] = React.useState<Patient | null>(null);
  const [prestazioniCatalogo, setPrestazioniCatalogo] = React.useState<PrestazioneCatalogo[]>([]);
  const [conventionTemplates, setConventionTemplates] = React.useState<ConventionTemplate[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const debouncedSearch = useDebounce(search.trim(), 300);

  React.useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, recordTypeFilter]);

  React.useEffect(() => {
    let active = true;

    const loadPrestazioni = async () => {
      try {
        const response = await fetch("/api/admin-settings");
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!active || !isAdminSettingsPrestazioni(data)) return;
        setPrestazioniCatalogo(
          data.prestazioni
            .filter((prestazione) => prestazione.attiva !== false)
            .sort((a, b) =>
              `${a.specialita} ${a.nome}`.localeCompare(`${b.specialita} ${b.nome}`, "it", { sensitivity: "base" }),
            ),
        );
        setConventionTemplates(
          (data.conventionTemplates ?? [])
            .map(normalizeConventionTemplate)
            .filter((template): template is ConventionTemplate => Boolean(template))
            .filter((template) => template.attiva),
        );
      } catch {
        // Il catalogo resta vuoto: la convenzione si puo comunque salvare come dati anagrafici.
      }
    };

    void loadPrestazioni();

    return () => {
      active = false;
    };
  }, []);

  const patientQueryParams = React.useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(recordTypeFilter !== "tutte" ? { recordType: recordTypeFilter } : {}),
      limit: PAGE_SIZE + 1,
      offset: pageIndex * PAGE_SIZE,
    }),
    [debouncedSearch, pageIndex, recordTypeFilter],
  );

  const { data: patients, isLoading, isFetching, error, refetch, queryKey } = useListPatients(patientQueryParams);
  const { data: aziendeConvenzionabili } = useListPatients({ recordType: "azienda", limit: 200 });
  const { data: societaConvenzionabili } = useListPatients({ recordType: "societa_sportiva", limit: 200 });

  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const deletePatient = useDeletePatient();

  const conventionOptions = React.useMemo(
    () => [...(aziendeConvenzionabili ?? []), ...(societaConvenzionabili ?? [])].filter(isConventionHolder),
    [aziendeConvenzionabili, societaConvenzionabili],
  );
  const activeConventionOptions = React.useMemo(
    () => conventionOptions.filter((patient) => patient.conventionActive),
    [conventionOptions],
  );
  const expiringConventions = React.useMemo(
    () => conventionOptions.filter(isConventionExpiring),
    [conventionOptions],
  );

  const hasNextPage = (patients?.length ?? 0) > PAGE_SIZE;
  const visiblePatients = (patients ?? []).slice(0, PAGE_SIZE);
  const firstVisibleIndex = pageIndex * PAGE_SIZE + 1;
  const lastVisibleIndex = pageIndex * PAGE_SIZE + visiblePatients.length;

  const handleCreate = async (form: PatientForm) => {
    setSaving(true);
    setFormError(null);
    try {
      const created = await createPatient.mutateAsync({
        data: patientFormPayload(form),
      });
      queryClient.setQueryData<Patient[]>(queryKey, (current) =>
        current ? [...current, created].sort(byPatientName) : current
      );
      await queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      setShowCreate(false);
    } catch {
      setFormError("Errore durante il salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: number, form: PatientForm) => {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updatePatient.mutateAsync({
        id,
        data: patientFormPayload(form),
      });
      queryClient.setQueryData<Patient[]>(queryKey, (current) =>
        current ? current.map((patient) => (patient.id === id ? updated : patient)).sort(byPatientName) : current
      );
      await queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      setEditPatient(null);
    } catch {
      setFormError("Errore durante il salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePatient.mutateAsync({ id });
      queryClient.setQueryData<Patient[]>(queryKey, (current) =>
        current ? current.filter((patient) => patient.id !== id) : current
      );
      await queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      setDeleteConfirmId(null);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Anagrafiche</h1>
          <p className="text-muted-foreground text-sm">
            Privati, aziende e societa sportive: {visiblePatients.length} anagrafiche visualizzate.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => setShowBulkImport(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importa CSV
          </Button>
          <Button onClick={() => { setShowCreate(true); setFormError(null); }} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Nuova Anagrafica
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Cerca per nome, ragione sociale, email, telefono, P.IVA o codice fiscale..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={recordTypeFilter === option.id ? "default" : "outline"}
            size="sm"
            onClick={() => setRecordTypeFilter(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {expiringConventions.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Convenzioni in scadenza entro 30 giorni</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {expiringConventions.map((convenzione) => (
                  <Badge key={convenzione.id} variant="outline" className="border-amber-300 bg-white text-amber-900">
                    {patientDisplayName(convenzione)} · {conventionLabel(convenzione)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {isFetching && !isLoading && (
        <p className="text-xs text-muted-foreground">Aggiornamento risultati...</p>
      )}

      {error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Impossibile caricare i pazienti.
          <button className="underline ml-1" onClick={() => refetch()}>Riprova</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : visiblePatients.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "Nessun risultato" : "Nessuna anagrafica registrata"}</p>
          <p className="text-sm">{search ? "Prova a cambiare i termini di ricerca." : "Aggiungi la prima anagrafica con il pulsante in alto."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cognome e nome</TableHead>
                  <TableHead>Indirizzo mail</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Convenzione</TableHead>
                  <TableHead className="w-[170px] text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePatients.map((p) => {
                  const linkedConventions = (p.linkedConventionIds ?? [])
                    .map((id) => conventionOptions.find((convenzione) => convenzione.id === id))
                    .filter(Boolean) as Patient[];
                  const isOrganization = Boolean(p.recordType && p.recordType !== "privato");

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="min-w-[280px]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {patientInitials(p)}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (isOrganization) {
                                  setSchedaPatient(p);
                                  return;
                                }
                                setEditPatient({ id: p.id, form: patientToForm(p) });
                                setFormError(null);
                              }}
                              className="block truncate text-left font-semibold text-foreground hover:text-primary"
                            >
                              {patientDisplayName(p)}
                            </button>
                            <p className="truncate text-xs text-muted-foreground">
                              {isOrganization
                                ? p.vatNumber ? `P.IVA/C.F. ${p.vatNumber}` : "P.IVA/C.F. non presente"
                                : `Nato il ${p.dateOfBirth}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[240px]">
                        {p.email ? (
                          <span className="text-foreground">{p.email}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Mail className="h-3.5 w-3.5" />
                            Aggiungi email
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[160px]">{p.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={isOrganization ? "secondary" : "outline"}>{recordTypeLabel(p.recordType)}</Badge>
                      </TableCell>
                      <TableCell className="min-w-[230px]">
                        {isOrganization ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Badge
                              variant={p.conventionActive ? "secondary" : "outline"}
                              className={isConventionExpiring(p) ? "border-amber-300 bg-amber-50 text-amber-900" : ""}
                            >
                              {conventionLabel(p)}
                            </Badge>
                            <Badge variant="outline">{(p.conventionServices ?? []).length} prestazioni</Badge>
                          </div>
                        ) : linkedConventions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {linkedConventions.slice(0, 2).map((convenzione) => (
                              <Badge key={convenzione.id} variant="secondary" className="gap-1">
                                <Link2 className="h-3 w-3" />
                                {patientDisplayName(convenzione)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          {isOrganization && (
                            <Button size="icon" variant="ghost" onClick={() => setSchedaPatient(p)} title="Scheda">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditPatient({ id: p.id, form: patientToForm(p) });
                              setFormError(null);
                            }}
                            title="Modifica"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteConfirmId(p.id)}
                            title="Elimina"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {firstVisibleIndex}-{lastVisibleIndex} visualizzati · Pagina {pageIndex + 1}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={pageIndex === 0 || isFetching}
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Indietro
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!hasNextPage || isFetching}
                onClick={() => setPageIndex((current) => current + 1)}
              >
                Avanti
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BULK IMPORT ─── */}
      {showBulkImport && (
        <BulkImportDialog
          onClose={() => setShowBulkImport(false)}
          onImported={() => { refetch(); }}
        />
      )}

      {/* ─── CREATE DIALOG ─── */}
      <PatientFormDialog
        open={showCreate}
        title="Nuova Anagrafica"
        form={emptyForm()}
        error={formError}
        saving={saving}
        conventionOptions={activeConventionOptions}
        conventionTemplates={conventionTemplates}
        prestazioniOptions={prestazioniCatalogo}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />

      {/* ─── EDIT DIALOG ─── */}
      {editPatient && (
        <PatientFormDialog
          open={true}
          title="Modifica Anagrafica"
          form={editPatient.form}
          error={formError}
          saving={saving}
          conventionOptions={activeConventionOptions}
          conventionTemplates={conventionTemplates}
          prestazioniOptions={prestazioniCatalogo}
          onClose={() => setEditPatient(null)}
          onSave={(form) => handleUpdate(editPatient.id, form)}
        />
      )}

      {schedaPatient && (
        <OrganizationProfileDialog
          patient={schedaPatient}
          onClose={() => setSchedaPatient(null)}
          onEdit={() => {
            setEditPatient({ id: schedaPatient.id, form: patientToForm(schedaPatient) });
            setSchedaPatient(null);
            setFormError(null);
          }}
        />
      )}

      {/* ─── DELETE CONFIRM ─── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Elimina anagrafica</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Sei sicuro di voler eliminare questa anagrafica? L'operazione non può essere annullata.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Annulla</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId !== null && handleDelete(deleteConfirmId)}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientFormDialog({
  open,
  title,
  form: initialForm,
  error,
  saving,
  conventionOptions,
  conventionTemplates,
  prestazioniOptions,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  form: PatientForm;
  error: string | null;
  saving: boolean;
  conventionOptions: Patient[];
  conventionTemplates: ConventionTemplate[];
  prestazioniOptions: PrestazioneCatalogo[];
  onClose: () => void;
  onSave: (form: PatientForm) => void;
}) {
  const [form, setForm] = React.useState<PatientForm>(initialForm);
  const [prestazioneSearch, setPrestazioneSearch] = React.useState("");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(conventionTemplates[0]?.id ?? "");

  React.useEffect(() => {
    if (open) setForm(initialForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!selectedTemplateId || !conventionTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(conventionTemplates[0]?.id ?? "");
    }
  }, [conventionTemplates, selectedTemplateId]);

  const set = (k: keyof PatientForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleLinkedConvention = (id: number) => {
    setForm((f) => ({
      ...f,
      linkedConventionIds: f.linkedConventionIds.includes(id)
        ? f.linkedConventionIds.filter((item) => item !== id)
        : [...f.linkedConventionIds, id],
    }));
  };

  const prestazioniDisponibiliConvenzione = React.useMemo(() => {
    const selectedIds = new Set(form.conventionServices.map((servizio) => servizio.prestazioneId));
    const query = prestazioneSearch.trim().toLocaleLowerCase("it-IT");

    return prestazioniOptions
      .filter((prestazione) => !selectedIds.has(prestazione.id))
      .filter((prestazione) => {
        if (!query) return true;
        return `${prestazione.nome} ${prestazione.specialita}`.toLocaleLowerCase("it-IT").includes(query);
      })
      .slice(0, 8);
  }, [form.conventionServices, prestazioneSearch, prestazioniOptions]);

  const aggiungiPrestazioneConvenzione = (prestazione: PrestazioneCatalogo) => {
    setForm((f) => ({
      ...f,
      conventionServices: [
        ...f.conventionServices,
        {
          id: prestazione.id,
          prestazioneId: prestazione.id,
          nome: prestazione.nome,
          specialita: prestazione.specialita,
          durata: prestazione.durata,
          pricingMode: "fixed",
          discountPercent: "",
          prezzo: "",
        },
      ],
    }));
    setPrestazioneSearch("");
  };

  const aggiornaPrestazioneConvenzione = <K extends keyof ConventionServiceForm>(
    id: string,
    key: K,
    value: ConventionServiceForm[K],
  ) => {
    setForm((f) => ({
      ...f,
      conventionServices: f.conventionServices.map((servizio) =>
        servizio.id === id ? { ...servizio, [key]: value } : servizio,
      ),
    }));
  };

  const rimuoviPrestazioneConvenzione = (id: string) => {
    setForm((f) => ({
      ...f,
      conventionServices: f.conventionServices.filter((servizio) => servizio.id !== id),
    }));
  };

  const templateSelezionato = conventionTemplates.find((template) => template.id === selectedTemplateId) ?? null;

  const servicesDaTemplate = (template: ConventionTemplate): ConventionServiceForm[] =>
    template.services.map((service) => ({
      id: service.id || service.prestazioneId,
      prestazioneId: service.prestazioneId,
      nome: service.nome,
      specialita: service.specialita,
      durata: service.durata,
      pricingMode: normalizzaPricingMode(service.pricingMode),
      discountPercent: prezzoToDraft(service.discountPercent ?? 0),
      prezzo: prezzoToDraft(service.prezzo),
    }));

  const preparaModificaConvenzione = () => {
    if (!templateSelezionato) return;
    const templateServices = servicesDaTemplate(templateSelezionato);
    setForm((f) => {
      const currentIds = new Set(f.conventionServices.map((service) => service.prestazioneId));
      const merged = [
        ...f.conventionServices,
        ...templateServices.filter((service) => !currentIds.has(service.prestazioneId)),
      ];

      return {
        ...f,
        conventionActive: true,
        conventionText: f.conventionText.trim() || templateSelezionato.descrizione,
        conventionServices: merged,
      };
    });
    setPrestazioneSearch("");
  };

  const cfInfo = React.useMemo(() => parseFiscalCode(form.codiceFiscale), [form.codiceFiscale]);

  React.useEffect(() => {
    if (cfInfo) {
      setForm((f) => ({
        ...f,
        ...(f.dateOfBirth ? {} : { dateOfBirth: cfInfo.dateOfBirth }),
        gender: cfInfo.gender,
      }));
    }
  }, [cfInfo]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo anagrafica</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {RECORD_TYPE_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, recordType: id }))}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    form.recordType === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-white hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Dati anagrafici */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {form.recordType === "privato" ? "Dati paziente" : "Dati organizzazione"}
            </p>
            {form.recordType !== "privato" && (
              <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
                <div className="space-y-1">
                  <Label className="text-xs">Ragione sociale *</Label>
                  <Input value={form.companyName} onChange={set("companyName")} placeholder="Medical Sport ASD" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">P.IVA / Codice fiscale</Label>
                  <Input
                    value={form.vatNumber}
                    onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value.toUpperCase() }))}
                    placeholder="01234567890"
                    className="uppercase"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{form.recordType === "privato" ? "Nome *" : "Nome referente"}</Label>
                <Input value={form.firstName} onChange={set("firstName")} placeholder={form.recordType === "privato" ? "Mario" : "Laura"} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{form.recordType === "privato" ? "Cognome *" : "Cognome referente"}</Label>
                <Input value={form.lastName} onChange={set("lastName")} placeholder={form.recordType === "privato" ? "Rossi" : "Bianchi"} />
              </div>
            </div>
            {form.recordType !== "privato" && (
              <div className="space-y-1">
                <Label className="text-xs">Referente / reparto</Label>
                <Input value={form.contactPerson} onChange={set("contactPerson")} placeholder="Segreteria, presidente, amministrazione..." />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{form.recordType === "privato" ? "Codice Fiscale" : "Codice fiscale referente"}</Label>
              <Input
                value={form.codiceFiscale}
                onChange={(e) => setForm((f) => ({ ...f, codiceFiscale: e.target.value.toUpperCase() }))}
                placeholder="RSSMRA85M01H501Z"
                className="uppercase"
                maxLength={16}
              />
              {cfInfo && (
                <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/8 rounded-md px-2.5 py-1.5">
                  <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {cfInfo.gender === "M" ? "Uomo" : "Donna"} · {cfInfo.age} anni · nato/a il{" "}
                    {cfInfo.dateOfBirth.split("-").reverse().join("/")}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{form.recordType === "privato" ? "Data di nascita *" : "Data di nascita referente"}</Label>
                <Input type="date" value={form.dateOfBirth} max={today} onChange={set("dateOfBirth")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sesso</Label>
                <div className="flex gap-1.5">
                  {(["M", "F"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, gender: f.gender === v ? "" : v }))}
                      className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                        form.gender === v
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {v === "M" ? "M — Maschio" : "F — Femmina"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{form.recordType === "privato" ? "Email *" : "Email azienda/societa *"}</Label>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="mario@email.it" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{form.recordType === "privato" ? "Telefono *" : "Telefono azienda/societa *"}</Label>
                <Input value={form.phone} onChange={set("phone")} placeholder="+39 333..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input value={form.notes} onChange={set("notes")} placeholder="Allergie, annotazioni, ecc." />
            </div>
          </div>

          <div className="border-t border-border" />

          {form.recordType === "privato" ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Convenzioni associate</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Abbina il paziente a una societa sportiva o azienda con convenzione attiva.
                </p>
              </div>
              {conventionOptions.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {conventionOptions.map((convenzione) => {
                    const selected = form.linkedConventionIds.includes(convenzione.id);
                    return (
                      <button
                        key={convenzione.id}
                        type="button"
                        onClick={() => toggleLinkedConvention(convenzione.id)}
                        className={`rounded-md border px-3 py-2 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-white hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{patientDisplayName(convenzione)}</p>
                            <p className="text-xs text-muted-foreground">{recordTypeLabel(convenzione.recordType)}</p>
                          </div>
                          <Badge variant={selected ? "default" : "outline"} className="shrink-0">
                            {selected ? "Associata" : "Associa"}
                          </Badge>
                        </div>
                        {convenzione.conventionText && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{convenzione.conventionText}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Nessuna convenzione attiva disponibile.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Convenzione</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alla scadenza la convenzione viene disattivata automaticamente. Da 30 giorni prima comparira tra le notifiche.
                </p>
              </div>
              {conventionTemplates.length > 0 ? (
                <div className="rounded-md border border-primary/15 bg-primary/5 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Modello base</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleziona convenzione base" />
                        </SelectTrigger>
                        <SelectContent>
                          {conventionTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.nome} · {template.services.length} prestazioni
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={preparaModificaConvenzione}
                      disabled={!templateSelezionato || templateSelezionato.services.length === 0}
                      className="gap-2 bg-white"
                    >
                      <Pencil className="h-4 w-4" />
                      Modifica convenzione
                    </Button>
                  </div>
                  {templateSelezionato?.descrizione && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{templateSelezionato.descrizione}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Le prestazioni del modello vengono portate qui sotto e diventano modificabili solo per questa azienda o societa.
                    Puoi togliere voci, aggiungerne altre e cambiare i prezzi senza modificare il modello base.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Nessun modello base configurato. Vai in Impostazioni &gt; Convenzioni per crearne uno.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={form.conventionActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, conventionActive: !f.conventionActive }))}
                >
                  {form.conventionActive ? "Convenzione attiva" : "Convenzione disattivata"}
                </Button>
                {form.conventionExpiresAt && (
                  <Badge
                    variant="outline"
                    className={
                      form.conventionActive && daysUntil(form.conventionExpiresAt) !== null &&
                      Number(daysUntil(form.conventionExpiresAt)) <= CONVENTION_WARNING_DAYS
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : ""
                    }
                  >
                    {form.conventionActive
                      ? `Scadenza ${form.conventionExpiresAt}`
                      : "Non attiva"}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Scadenza convenzione</Label>
                <Input type="date" value={form.conventionExpiresAt} onChange={set("conventionExpiresAt")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Testo generico convenzione</Label>
                <Textarea
                  value={form.conventionText}
                  onChange={(event) => setForm((f) => ({ ...f, conventionText: event.target.value }))}
                  placeholder="Es. Sconto prestazioni, condizioni, modalita di applicazione..."
                  className="min-h-24"
                />
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Prestazioni incluse nella convenzione
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cerca dal catalogo prestazioni e imposta il prezzo riservato.
                    </p>
                  </div>
                  <Badge variant="secondary">{form.conventionServices.length} voci</Badge>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={prestazioneSearch}
                      onChange={(event) => setPrestazioneSearch(event.target.value)}
                      placeholder="Cerca prestazione per nome o specialita..."
                      className="pl-9"
                    />
                  </div>
                  {prestazioneSearch.trim() && (
                    <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-white shadow-sm">
                      {prestazioniDisponibiliConvenzione.length > 0 ? (
                        prestazioniDisponibiliConvenzione.map((prestazione) => (
                          <button
                            key={prestazione.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-primary/5"
                            onClick={() => aggiungiPrestazioneConvenzione(prestazione)}
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
                {form.conventionServices.length > 0 ? (
                  <div className="mt-3 overflow-x-auto rounded-md border border-border bg-white">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Prestazione</th>
                          <th className="px-3 py-2 text-left">Specialita</th>
                          <th className="px-3 py-2 text-left">Durata</th>
                          <th className="px-3 py-2 text-left">Modalita</th>
                          <th className="px-3 py-2 text-left">Valore convenzione</th>
                          <th className="px-3 py-2 text-right">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {form.conventionServices.map((servizio) => (
                          <tr key={servizio.id}>
                            <td className="px-3 py-2 font-medium text-foreground">{servizio.nome}</td>
                            <td className="px-3 py-2 text-muted-foreground">{servizio.specialita || "-"}</td>
                            <td className="px-3 py-2">
                              <Input
                                inputMode="numeric"
                                value={String(servizio.durata || "")}
                                onChange={(event) =>
                                  aggiornaPrestazioneConvenzione(servizio.id, "durata", Number(event.target.value) || 0)
                                }
                                className="h-9 w-20"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Select
                                value={servizio.pricingMode}
                                onValueChange={(value) =>
                                  aggiornaPrestazioneConvenzione(
                                    servizio.id,
                                    "pricingMode",
                                    normalizzaPricingMode(value),
                                  )
                                }
                              >
                                <SelectTrigger className="h-9 w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Prezzo finale</SelectItem>
                                  <SelectItem value="discount">Sconto %</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="relative">
                                {servizio.pricingMode === "discount" ? (
                                  <Percent className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                ) : (
                                  <Euro className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                )}
                                <Input
                                  inputMode="decimal"
                                  value={servizio.pricingMode === "discount" ? servizio.discountPercent : servizio.prezzo}
                                  onChange={(event) =>
                                    aggiornaPrestazioneConvenzione(
                                      servizio.id,
                                      servizio.pricingMode === "discount" ? "discountPercent" : "prezzo",
                                      event.target.value,
                                    )
                                  }
                                  placeholder={servizio.pricingMode === "discount" ? "10" : "0,00"}
                                  className="h-9 w-32 pl-8"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => rimuoviPrestazioneConvenzione(servizio.id)}
                                title="Rimuovi prestazione"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-dashed border-border bg-white p-3 text-sm text-muted-foreground">
                    Nessuna prestazione in convenzione. Cerca una prestazione e aggiungila al listino.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Indirizzo di fatturazione */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indirizzo di fatturazione</p>
            <div className="space-y-1">
              <Label className="text-xs">Via / Indirizzo</Label>
              <Input value={form.billingAddress} onChange={set("billingAddress")} placeholder="Via Roma 12" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CAP</Label>
                <Input value={form.billingCap} onChange={set("billingCap")} placeholder="00100" maxLength={5} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Città</Label>
                <Input value={form.billingCity} onChange={set("billingCity")} placeholder="Roma" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prov.</Label>
                <Input
                  value={form.billingProvincia}
                  onChange={(e) => setForm((f) => ({ ...f, billingProvincia: e.target.value.toUpperCase() }))}
                  placeholder="RM"
                  maxLength={2}
                  className="uppercase"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={() => onSave(form)} disabled={!isFormValid(form) || saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationProfileDialog({
  patient,
  onClose,
  onEdit,
}: {
  patient: Patient;
  onClose: () => void;
  onEdit: () => void;
}) {
  const servizi = patient.conventionServices ?? [];

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {patient.recordType === "societa_sportiva" ? (
              <Trophy className="h-5 w-5 text-primary" />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
            Scheda {recordTypeLabel(patient.recordType).toLowerCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{patientDisplayName(patient)}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{recordTypeLabel(patient.recordType)}</Badge>
                  <Badge
                    variant={patient.conventionActive ? "default" : "outline"}
                    className={isConventionExpiring(patient) ? "border-amber-300 bg-amber-50 text-amber-900" : ""}
                  >
                    {conventionLabel(patient)}
                  </Badge>
                  <Badge variant="outline">{servizi.length} prestazioni convenzionate</Badge>
                </div>
              </div>
              <Button type="button" onClick={onEdit} className="gap-2">
                <Pencil className="h-4 w-4" />
                Modifica scheda
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Dati anagrafici</h3>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">P.IVA / C.F.</dt>
                  <dd className="text-right font-medium">{patient.vatNumber || "-"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Referente</dt>
                  <dd className="text-right font-medium">
                    {patient.contactPerson || `${patient.firstName} ${patient.lastName}`.trim() || "-"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="text-right font-medium">{patient.email || "-"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Telefono</dt>
                  <dd className="text-right font-medium">{patient.phone || "-"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-md border border-border bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Convenzione</h3>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Stato</dt>
                  <dd className="text-right font-medium">{conventionLabel(patient)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Scadenza</dt>
                  <dd className="text-right font-medium">{patient.conventionExpiresAt || "-"}</dd>
                </div>
              </dl>
              {patient.conventionText && (
                <p className="mt-3 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                  {patient.conventionText}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="font-semibold text-foreground">Prestazioni e prezzi convenzionati</h3>
                <p className="text-sm text-muted-foreground">Listino specifico della convenzione.</p>
              </div>
              <Badge variant="secondary">{servizi.length} voci</Badge>
            </div>
            {servizi.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Prestazione</th>
                      <th className="px-4 py-3 text-left">Specialita</th>
                      <th className="px-4 py-3 text-right">Durata</th>
                      <th className="px-4 py-3 text-right">Convenzione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {servizi.map((servizio) => (
                      <tr key={servizio.id}>
                        <td className="px-4 py-3 font-medium text-foreground">{servizio.nome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{servizio.specialita || "-"}</td>
                        <td className="px-4 py-3 text-right">{Number(servizio.durata ?? 0)} min</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {conventionPriceLabel(servizio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nessuna prestazione convenzionata. Premi Modifica scheda per aggiungerle.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
