import React from "react";
import { useListBookings, useUpdateBookingStatus, useListPatients, useUpdatePatient, useListExams } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { it } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  FlaskConical,
  Phone,
  Mail,
  CalendarDays,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
  MapPin,
  FileDown,
  Pencil,
} from "lucide-react";
import { format as formatDate, addDays, subDays } from "date-fns";
import { NuovaPrenotazioneDialog } from "@/components/NuovaPrenotazioneDialog";
import { ExamTodoDialog, TodoVisit } from "@/components/ExamTodoDialog";
import { RefertazioneDialog } from "@/components/RefertazioneDialog";
import { printReferto, PrintPatient, PrintExamWithResult } from "@/lib/printDocs";

type BookingStatus = "confirmed" | "pending" | "accepted" | "completed" | "cancelled";

type Visit = {
  key: string;
  id: number;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  codiceFiscale?: string | null;
  email: string;
  phone: string;
  notes?: string | null;
  examIds: number[];
  examNames: string[];
  status: BookingStatus;
  refertiCount: number;
  expectedRefertiCount: number;
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "accepted":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 gap-1"><UserCheck className="h-3 w-3" />Accettato</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1"><CheckCircle2 className="h-3 w-3" />Completato</Badge>;
    case "cancelled":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Annullato</Badge>;
    case "confirmed":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1"><Clock className="h-3 w-3" />Da accettare</Badge>;
    default:
      return <Badge variant="secondary">In attesa</Badge>;
  }
}

function DateLabel({ date }: { date: string }) {
  try {
    const d = parseISO(date);
    if (isToday(d)) return <span className="text-primary font-semibold">Oggi</span>;
    if (isTomorrow(d)) return <span className="text-blue-600">Domani</span>;
    return <span>{format(d, "d MMMM yyyy", { locale: it })}</span>;
  } catch {
    return <span>{date}</span>;
  }
}

type FilterId = "all" | "confirmed" | "accepted" | "completed" | "cancelled";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "confirmed", label: "Da accettare" },
  { id: "accepted", label: "Accettati" },
  { id: "completed", label: "Completati" },
  { id: "cancelled", label: "Annullati" },
];

export function AccettazionePaziente({ role = "segreteria" }: { role?: string }) {
  const queryClient = useQueryClient();
  const { data: allBookings, isLoading, error, refetch } = useListBookings();
  const statusMutation = useUpdateBookingStatus();
  const { data: allExams } = useListExams();
  const bookings = React.useMemo(() => (Array.isArray(allBookings) ? allBookings : []), [allBookings]);
  const exams = React.useMemo(() => (Array.isArray(allExams) ? allExams : []), [allExams]);
  const invalidBookingsResponse = Boolean(allBookings && !Array.isArray(allBookings));

  const [selectedDate, setSelectedDate] = React.useState<string>(
    formatDate(new Date(), "yyyy-MM-dd")
  );
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<FilterId>("all");
  const [loadingVisitKey, setLoadingVisitKey] = React.useState<string | null>(null);
  const [showNuovaPrenotazione, setShowNuovaPrenotazione] = React.useState(false);
  const [billingVisit, setBillingVisit] = React.useState<Visit | null>(null);
  const [todoVisit, setTodoVisit] = React.useState<Visit | null>(null);
  const [refertaVisit, setRefertaVisit] = React.useState<Visit | null>(null);

  const handlePrintReferto = async (visit: Visit) => {
    try {
      const [refertiRes, patientRes] = await Promise.all([
        fetch(`/api/referti?bookingId=${visit.id}`),
        fetch(`/api/patients?search=${encodeURIComponent(visit.email)}`),
      ]);
      const referti: Array<{ examId: number; parentExamId?: number | null; valore: string; note?: string | null }> = await refertiRes.json();
      const patientList = await patientRes.json();
      const patientData = patientList?.[0];

      const examsWithResults: PrintExamWithResult[] = visit.examIds.map((id) => {
        const exam = exams.find((e) => e.id === id);
        const examAny = exam as any;
        if (examAny?.tipo === "pacchetto") {
          const subResults = (examAny.components ?? []).map((c: any) => {
            const sub = c.componentExam;
            const subReferto = referti.find((r) => r.examId === c.componentExamId && r.parentExamId === id);
            return {
              codiceAnalisi: sub?.codiceAnalisi ?? String(c.componentExamId),
              descrizione: sub?.descrizione ?? "—",
              um: sub?.um ?? null,
              metodo: sub?.metodo ?? null,
              valoreRiferimento: sub?.valoreRiferimento ?? null,
              referenceRanges: sub?.referenceRanges ?? null,
              valore: subReferto?.valore ?? null,
              refertaNote: subReferto?.note ?? null,
            };
          });
          return {
            codiceAnalisi: exam?.codiceAnalisi ?? String(id),
            descrizione: exam?.descrizione ?? "—",
            colorProvetta: exam?.colorProvetta,
            um: exam?.um,
            metodo: exam?.metodo,
            regola: exam?.regola,
            valoreRiferimento: exam?.valoreRiferimento,
            referenceRanges: (exam as any)?.referenceRanges ?? null,
            preparationInstructions: exam?.preparationInstructions,
            tipo: "pacchetto",
            valore: null,
            refertaNote: null,
            subResults,
          };
        }
        const referto = referti.find((r) => r.examId === id && !r.parentExamId);
        return {
          codiceAnalisi: exam?.codiceAnalisi ?? String(id),
          descrizione: exam?.descrizione ?? "—",
          colorProvetta: exam?.colorProvetta,
          um: exam?.um,
          metodo: exam?.metodo,
          regola: exam?.regola,
          valoreRiferimento: exam?.valoreRiferimento,
          referenceRanges: (exam as any)?.referenceRanges ?? null,
          preparationInstructions: exam?.preparationInstructions,
          valore: referto?.valore ?? null,
          refertaNote: referto?.note ?? null,
        };
      });

      const patient: PrintPatient = {
        firstName: visit.firstName,
        lastName: visit.lastName,
        dateOfBirth: visit.dateOfBirth,
        codiceFiscale: visit.codiceFiscale ?? undefined,
        gender: patientData?.gender ?? undefined,
        email: visit.email,
        phone: visit.phone,
        notes: visit.notes,
        billingAddress: patientData?.billingAddress,
        billingCap: patientData?.billingCap,
        billingCity: patientData?.billingCity,
        billingProvincia: patientData?.billingProvincia,
      };

      printReferto(patient, examsWithResults);
    } catch (err) {
      console.error("Errore nella stampa del referto", err);
    }
  };


  const todayStr = formatDate(new Date(), "yyyy-MM-dd");

  const dayBookings = React.useMemo(
    () => bookings.filter((b) => b.date === selectedDate),
    [bookings, selectedDate],
  );

  const visits = React.useMemo((): Visit[] => {
    return [...(dayBookings as Array<{
      id: number; date: string; time: string; firstName: string; lastName: string;
      dateOfBirth: string; codiceFiscale?: string | null; email: string; phone: string; notes?: string | null;
      examIds: number[]; examNames: string[]; status: string; refertiCount?: number;
    }>)]
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((b) => ({
        key: String(b.id),
        id: b.id,
        date: b.date,
        time: b.time,
        firstName: b.firstName,
        lastName: b.lastName,
        dateOfBirth: b.dateOfBirth,
        codiceFiscale: b.codiceFiscale,
        email: b.email,
        phone: b.phone,
        notes: b.notes,
        examIds: b.examIds,
        examNames: b.examNames,
        status: b.status as BookingStatus,
        refertiCount: b.refertiCount ?? 0,
        expectedRefertiCount: (b as any).expectedRefertiCount ?? b.examIds.length,
      }));
  }, [dayBookings]);

  const filtered = React.useMemo(() => {
    let result = visits;
    if (role === "laboratorio") {
      result = result.filter((v) => v.status === "accepted" || v.status === "completed");
    } else if (filter !== "all") {
      result = result.filter((v) => v.status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (v) =>
          `${v.firstName} ${v.lastName}`.toLowerCase().includes(q) ||
          v.phone.includes(q) ||
          v.examNames.some((n) => n.toLowerCase().includes(q))
      );
    }
    return result;
  }, [visits, filter, search, role]);

  const counts = React.useMemo(() => ({
    confirmed: visits.filter((v) => v.status === "confirmed").length,
    accepted: visits.filter((v) => v.status === "accepted").length,
    completed: visits.filter((v) => v.status === "completed").length,
    cancelled: visits.filter((v) => v.status === "cancelled").length,
  }), [visits]);

  const updateVisitStatus = async (visit: Visit, newStatus: BookingStatus) => {
    setLoadingVisitKey(visit.key);
    try {
      await statusMutation.mutateAsync({ id: visit.id, data: { status: newStatus } });
      await refetch();
    } finally {
      setLoadingVisitKey(null);
    }
  };

  const prevDay = () => setSelectedDate(formatDate(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"));
  const nextDay = () => setSelectedDate(formatDate(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Accettazione Pazienti</h1>
          <p className="text-muted-foreground text-sm">
            {role === "laboratorio"
              ? "Pazienti accettati dalla segreteria — pronti per gli esami."
              : "Gestisci l'arrivo e l'accettazione dei pazienti."}
          </p>
        </div>

        {role === "segreteria" && (
          <Button onClick={() => setShowNuovaPrenotazione(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Nuova Prenotazione
          </Button>
        )}

        {/* Date navigator */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1 border border-border">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center px-2 min-w-[140px]">
            <p className="text-sm font-semibold capitalize">
              <DateLabel date={selectedDate} />
            </p>
            <p className="text-xs text-muted-foreground">{format(parseISO(selectedDate), "EEEE d MMM", { locale: it })}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {selectedDate !== todayStr && (
            <Button variant="ghost" size="sm" className="text-xs h-8 ml-1" onClick={() => setSelectedDate(todayStr)}>
              Oggi
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar — segreteria only */}
      {role === "segreteria" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Da accettare", value: counts.confirmed, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Accettati", value: counts.accepted, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { label: "Completati", value: counts.completed, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "Annullati", value: counts.cancelled, color: "text-red-500", bg: "bg-red-50 border-red-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border px-4 py-3 ${s.bg}`}>
              <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>
                {isLoading ? <Skeleton className="h-7 w-8" /> : s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cerca paziente, telefono o esame..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {role === "segreteria" && (
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1 border border-border flex-shrink-0">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filter === f.id
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                {f.id !== "all" && counts[f.id as keyof typeof counts] > 0 && (
                  <span className="ml-1 text-muted-foreground">({counts[f.id as keyof typeof counts]})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {error || invalidBookingsResponse ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Impossibile caricare le prenotazioni. Verifica che le API Vercel rispondano correttamente.
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nessun paziente trovato</p>
          <p className="text-sm">
            {visits.length === 0
              ? "Non ci sono prenotazioni per questa giornata."
              : "Nessun risultato per la ricerca o il filtro selezionato."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((visit) => (
            <VisitCard
              key={visit.key}
              visit={visit}
              role={role}
              isLoading={loadingVisitKey === visit.key}
              onUpdateStatus={updateVisitStatus}
              onEditBilling={() => setBillingVisit(visit)}
              showBilling={role === "segreteria"}
              onOpenTodo={() =>
                role === "laboratorio" && visit.status === "accepted" ? setRefertaVisit(visit) : setTodoVisit(visit)
              }
              onPrintReferto={visit.status === "completed" ? () => handlePrintReferto(visit) : undefined}
              onEditReferto={role === "laboratorio" && visit.status === "completed" ? () => setRefertaVisit(visit) : undefined}
              canComplete={visit.refertiCount >= visit.expectedRefertiCount && visit.examIds.length > 0}
            />
          ))}
        </div>
      )}

      <NuovaPrenotazioneDialog
        open={showNuovaPrenotazione}
        defaultDate={selectedDate}
        onClose={() => {
          setShowNuovaPrenotazione(false);
          refetch();
        }}
      />

      {billingVisit && (
        <BillingDialog
          visit={billingVisit}
          onClose={() => setBillingVisit(null)}
        />
      )}

      {todoVisit && (
        <ExamTodoDialog
          visit={todoVisit as TodoVisit}
          onClose={() => setTodoVisit(null)}
          onCompleted={() => {
            setTodoVisit(null);
            refetch();
          }}
          role={role}
          onPrintReferto={todoVisit.status === "completed" ? () => handlePrintReferto(todoVisit as Visit) : undefined}
        />
      )}

      {refertaVisit && (
        <RefertazioneDialog
          visit={refertaVisit as TodoVisit}
          onClose={() => setRefertaVisit(null)}
          onCompleted={() => {
            setRefertaVisit(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function BillingDialog({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const { data: patients } = useListPatients({ search: visit.email });
  const updatePatient = useUpdatePatient();
  const queryClient = useQueryClient();

  const patient = patients?.[0];

  const [form, setForm] = React.useState({ billingAddress: "", billingCap: "", billingCity: "", billingProvincia: "" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (patient) {
      setForm({
        billingAddress: patient.billingAddress ?? "",
        billingCap: patient.billingCap ?? "",
        billingCity: patient.billingCity ?? "",
        billingProvincia: patient.billingProvincia ?? "",
      });
    }
  }, [patient]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!patient) return;
    setSaving(true);
    try {
      await updatePatient.mutateAsync({
        id: patient.id,
        data: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          email: patient.email,
          phone: patient.phone,
          billingAddress: form.billingAddress.trim() || null,
          billingCap: form.billingCap.trim() || null,
          billingCity: form.billingCity.trim() || null,
          billingProvincia: form.billingProvincia.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["listPatients"] });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Indirizzo fatturazione — {visit.firstName} {visit.lastName}
          </DialogTitle>
        </DialogHeader>
        {!patient ? (
          <p className="text-sm text-muted-foreground py-2">Ricerca anagrafica in corso...</p>
        ) : (
          <div className="space-y-3 py-1">
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
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={handleSave} disabled={!patient || saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisitCard({
  visit,
  role,
  isLoading,
  onUpdateStatus,
  onEditBilling,
  showBilling = true,
  onOpenTodo,
  canComplete = true,
  onPrintReferto,
  onEditReferto,
}: {
  visit: Visit;
  role?: string;
  isLoading: boolean;
  onUpdateStatus: (visit: Visit, status: BookingStatus) => void;
  onEditBilling: () => void;
  showBilling?: boolean;
  onOpenTodo?: () => void;
  canComplete?: boolean;
  onPrintReferto?: () => void;
  onEditReferto?: () => void;
}) {
  const totalPrice = 0; // could sum from exam data if available

  const statusColors: Record<string, string> = {
    confirmed: "border-l-amber-400",
    accepted: "border-l-blue-400",
    completed: "border-l-green-400",
    cancelled: "border-l-red-300",
  };

  const borderColor = statusColors[visit.status] ?? "border-l-border";

  return (
    <div className={`rounded-xl border bg-card border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
      <div className="px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Patient info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              onClick={onOpenTodo}
              disabled={!onOpenTodo}
              className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm transition-opacity ${
                visit.status === "completed" ? "bg-green-500" :
                visit.status === "accepted" ? "bg-blue-500" :
                visit.status === "cancelled" ? "bg-red-400" : "bg-amber-500"
              } ${onOpenTodo ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
            >
              {visit.firstName[0]}{visit.lastName[0]}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={onOpenTodo}
                  disabled={!onOpenTodo}
                  className={`font-semibold text-foreground text-base leading-tight ${onOpenTodo ? "hover:text-primary hover:underline underline-offset-2 cursor-pointer" : "cursor-default"}`}
                >
                  {visit.firstName} {visit.lastName}
                </button>
                <StatusBadge status={visit.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Nato il {format(parseISO(visit.dateOfBirth), "d MMM yyyy", { locale: it })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <strong className="text-foreground">{visit.time}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {visit.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {visit.email}
                </span>
              </div>
              {visit.notes && (
                <p className="mt-1 text-xs text-muted-foreground italic">
                  Note: "{visit.notes}"
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 self-start flex-wrap justify-end">
            {showBilling && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-muted-foreground"
                onClick={onEditBilling}
              >
                <MapPin className="h-3.5 w-3.5" />
                Fatturazione
              </Button>
            )}
            {visit.status === "confirmed" && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                disabled={isLoading}
                onClick={() => onUpdateStatus(visit, "accepted")}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Accetta
              </Button>
            )}
            {visit.status === "accepted" && (
              <>
                {role === "segreteria" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-muted-foreground"
                    disabled={isLoading}
                    onClick={() => onUpdateStatus(visit, "confirmed")}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    In attesa
                  </Button>
                )}
                <Button
                  size="sm"
                  className={`gap-1.5 transition-all ${
                    canComplete
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                  disabled={isLoading || !canComplete}
                  title={
                    !canComplete
                      ? `Referta tutti gli esami prima di completare (${visit.refertiCount}/${visit.expectedRefertiCount})`
                      : undefined
                  }
                  onClick={() => canComplete && onUpdateStatus(visit, "completed")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {!canComplete
                    ? `Referti (${visit.refertiCount}/${visit.expectedRefertiCount})`
                    : "Completa"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                  disabled={isLoading}
                  onClick={() => onUpdateStatus(visit, "cancelled")}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Annulla
                </Button>
              </>
            )}
            {visit.status === "completed" && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Esami eseguiti
                </span>
                {role === "laboratorio" && onEditReferto && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    onClick={onEditReferto}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifica Referto
                  </Button>
                )}
                {onPrintReferto && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    onClick={onPrintReferto}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Referto PDF
                  </Button>
                )}
              </div>
            )}
            {visit.status === "confirmed" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive gap-1"
                disabled={isLoading}
                onClick={() => onUpdateStatus(visit, "cancelled")}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {visit.status === "cancelled" && role === "segreteria" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-muted-foreground"
                disabled={isLoading}
                onClick={() => onUpdateStatus(visit, "confirmed")}
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Ripristina
              </Button>
            )}
          </div>
        </div>

        {/* Exams list */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Esami prenotati ({visit.examNames.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {visit.examNames.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-md px-2.5 py-1.5 border border-border"
              >
                <FlaskConical className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="font-medium">{name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
