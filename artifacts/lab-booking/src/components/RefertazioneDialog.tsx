import React from "react";
import {
  useListReferti,
  useUpsertReferto,
  useUpdateBookingStatus,
  useListPatients,
  useListExams,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Circle,
  CalendarDays,
  Clock,
  User2,
  FlaskConical,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Pencil,
  Package,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { printSchedaLaboratorio } from "@/lib/printDocs";
import {
  displayRefValueAny,
  isOutOfRangeAny,
  matchFascia,
  getApplicableRange,
  type StructuredRefRange,
} from "@/lib/refValue";
import type { TodoVisit } from "./ExamTodoDialog";

interface Props {
  visit: TodoVisit;
  onClose: () => void;
  onCompleted: () => void;
}

type ExamRow = {
  id: number;
  codiceAnalisi: string;
  descrizione: string;
  colorProvetta?: string | null;
  synlab?: boolean;
  um?: string | null;
  metodo?: string | null;
  valoreRiferimento?: string | null;
  tipo?: string;
  referenceRanges?: StructuredRefRange[] | null;
  components?: Array<{
    id: number;
    componentExamId: number;
    ordinamento: number;
    componentExam: {
      id: number;
      codiceAnalisi: string;
      descrizione: string;
      um?: string | null;
      metodo?: string | null;
      valoreRiferimento?: string | null;
      referenceRanges?: StructuredRefRange[] | null;
    };
  }>;
};

const FASCIA_COLOR_CLS: Record<string, string> = {
  green:  "bg-green-100 text-green-800 border-green-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  red:    "bg-red-100 text-red-800 border-red-200",
};

function fasciaChip(ranges: StructuredRefRange[] | null | undefined, valueStr: string, gender?: string | null, ageYears?: number | null) {
  if (!ranges?.length) return null;
  const applicable = getApplicableRange(ranges, gender, ageYears);
  if (!applicable || applicable.tipo !== "fasce") return null;
  const f = matchFascia(applicable, valueStr);
  if (!f) return null;
  const cls = FASCIA_COLOR_CLS[f.color ?? ""] ?? "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {f.label}
    </span>
  );
}

function provettaChip(color: string | null | undefined) {
  if (!color) return null;
  const map: Record<string, string> = {
    ROSSA: "bg-red-100 text-red-700",
    VIOLA: "bg-purple-100 text-purple-700",
    VERDE: "bg-green-100 text-green-700",
    GIALLA: "bg-yellow-100 text-yellow-700",
    AZZURRA: "bg-sky-100 text-sky-700",
    BLU: "bg-blue-100 text-blue-700",
    GRIGIA: "bg-gray-100 text-gray-700",
    ARANCIO: "bg-orange-100 text-orange-700",
    BIANCA: "bg-white text-gray-600 border",
  };
  const key = color.toUpperCase();
  const cls = map[key] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
      {color}
    </span>
  );
}

const singleKey = (examId: number) => String(examId);
const subKey = (subExamId: number, parentExamId: number) => `${subExamId}_${parentExamId}`;

export function RefertazioneDialog({ visit, onClose, onCompleted }: Props) {
  const queryClient = useQueryClient();

  const { data: allExams } = useListExams();
  const { data: refertiData, isLoading: refertiLoading, refetch: refetchReferti } = useListReferti(
    { bookingId: visit.id }
  );
  const { data: patients } = useListPatients({ search: visit.email });
  const upsertReferto = useUpsertReferto();
  const updateStatus = useUpdateBookingStatus();

  const [saving, setSaving] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState(false);
  const [localValues, setLocalValues] = React.useState<Record<string, { valore: string; note: string }>>({});
  const [expandedNote, setExpandedNote] = React.useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());

  const patient = patients?.[0];
  const patientGender = patient?.gender ?? null;
  const patientAgeYears = React.useMemo(() => {
    if (!patient?.dateOfBirth) return null;
    const birth = new Date(patient.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  }, [patient?.dateOfBirth]);

  const exams = React.useMemo(
    () => (allExams ?? []).filter((e) => visit.examIds.includes(e.id)) as ExamRow[],
    [allExams, visit.examIds]
  );

  React.useEffect(() => {
    if (!refertiData) return;
    const init: Record<string, { valore: string; note: string }> = {};
    const saved = new Set<string>();
    for (const r of refertiData) {
      const key = (r as any).parentExamId ? subKey(r.examId, (r as any).parentExamId) : singleKey(r.examId);
      init[key] = { valore: r.valore, note: r.note ?? "" };
      saved.add(key);
    }
    setLocalValues((prev) => {
      const merged = { ...init };
      for (const [k, v] of Object.entries(prev)) {
        if (!saved.has(k)) merged[k] = v;
      }
      return merged;
    });
    setSavedIds(saved);
  }, [refertiData]);

  const getReferto = (examId: number, parentExamId?: number) => {
    if (parentExamId) return refertiData?.find((r) => r.examId === examId && (r as any).parentExamId === parentExamId);
    return refertiData?.find((r) => r.examId === examId && !(r as any).parentExamId);
  };

  const handleSave = async (key: string, examId: number, parentExamId?: number) => {
    const val = localValues[key];
    if (!val?.valore?.trim()) return;
    setSaving(key);
    try {
      await upsertReferto.mutateAsync({
        data: {
          bookingId: visit.id,
          examId,
          parentExamId: parentExamId ?? null,
          valore: val.valore.trim(),
          note: val.note?.trim() || null,
        } as any,
      });
      await refetchReferti();
      setSavedIds((s) => new Set([...s, key]));
      await queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    } finally {
      setSaving(null);
    }
  };

  const totalSlots = React.useMemo(() => exams.reduce((s, e) => {
    if (e.tipo === "pacchetto") return s + ((e.components ?? []).length || 1);
    return s + 1;
  }, 0), [exams]);

  const doneSlots = React.useMemo(() => exams.reduce((s, e) => {
    if (e.tipo === "pacchetto") {
      return s + (e.components ?? []).filter((c) => savedIds.has(subKey(c.componentExamId, e.id))).length;
    }
    return s + (savedIds.has(singleKey(e.id)) ? 1 : 0);
  }, 0), [exams, savedIds]);

  const allDone = totalSlots > 0 && doneSlots === totalSlots;
  const pct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;

  const handleComplete = async () => {
    if (!allDone) return;
    setCompleting(true);
    try {
      await updateStatus.mutateAsync({ id: visit.id, data: { status: "completed" } });
      onCompleted();
    } finally {
      setCompleting(false);
    }
  };

  const handlePrintScheda = () => {
    printSchedaLaboratorio(
      {
        firstName: visit.firstName,
        lastName: visit.lastName,
        dateOfBirth: visit.dateOfBirth,
        codiceFiscale: visit.codiceFiscale ?? patient?.codiceFiscale ?? undefined,
        gender: patient?.gender ?? undefined,
        email: visit.email,
        phone: visit.phone,
        notes: patient?.notes ?? undefined,
        billingAddress: patient?.billingAddress ?? undefined,
        billingCap: patient?.billingCap ?? undefined,
        billingCity: patient?.billingCity ?? undefined,
        billingProvincia: patient?.billingProvincia ?? undefined,
      },
      exams
    );
  };

  const renderSubExamRow = (
    exam: ExamRow,
    comp: NonNullable<ExamRow["components"]>[0]
  ) => {
    const sub = comp.componentExam;
    const key = subKey(sub.id, exam.id);
    const isDone = savedIds.has(key);
    const saved = getReferto(sub.id, exam.id);
    const local = localValues[key] ?? { valore: "", note: "" };
    const noteExp = expandedNote.has(key);
    const oor = isOutOfRangeAny(sub.referenceRanges, sub.valoreRiferimento, saved?.valore ?? local.valore, patientGender, patientAgeYears);

    return (
      <div
        key={key}
        className={`ml-6 rounded-lg border p-3 transition-all ${
          isDone ? "border-green-200 bg-green-50/40" : "border-border/60 bg-muted/10"
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5 shrink-0">
            {isDone ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{sub.descrizione}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{sub.codiceAnalisi}</Badge>
              {sub.metodo && <span className="text-[10px] text-muted-foreground uppercase">{sub.metodo}</span>}
            </div>

            {isDone && saved ? (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Risultato:</span>
                  <span className={`text-sm font-semibold ${oor ? "text-red-600" : "text-green-700"}`}>
                    {saved.valore}{sub.um ? ` ${sub.um}` : ""}
                  </span>
                  {oor && (
                    <span className="flex items-center gap-0.5 text-xs font-bold text-red-500 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                      <AlertTriangle className="h-3 w-3" />Fuori range
                    </span>
                  )}
                  {fasciaChip(sub.referenceRanges, saved.valore, patientGender, patientAgeYears)}
                  {(sub.referenceRanges?.length || sub.valoreRiferimento) && (
                    <span className="text-xs text-muted-foreground">rif: {displayRefValueAny(sub.referenceRanges as StructuredRefRange[] | null, sub.valoreRiferimento, patientGender, patientAgeYears)}{sub.um ? ` ${sub.um}` : ""}</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => setSavedIds((s) => { const n = new Set(s); n.delete(key); return n; })}
                  >
                    <Pencil className="h-3 w-3" />Modifica
                  </Button>
                </div>
                {saved.note && <p className="text-xs text-muted-foreground italic">Note: {saved.note}</p>}
              </div>
            ) : (
              <div className="mt-1.5 space-y-2">
                {(sub.referenceRanges?.length || sub.valoreRiferimento) && (
                  <p className="text-xs text-muted-foreground">Val. riferimento: <span className="font-medium">{displayRefValueAny(sub.referenceRanges as StructuredRefRange[] | null, sub.valoreRiferimento, patientGender, patientAgeYears)}{sub.um ? ` ${sub.um}` : ""}</span></p>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder={`Risultato${sub.um ? ` (${sub.um})` : ""}…`}
                    value={local.valore}
                    onChange={(e) => setLocalValues((v) => ({ ...v, [key]: { ...v[key] ?? { note: "" }, valore: e.target.value } }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(key, sub.id, exam.id)}
                    className="h-7 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
                    disabled={!local.valore?.trim() || saving === key}
                    onClick={() => handleSave(key, sub.id, exam.id)}
                  >
                    {saving === key ? "…" : "Salva"}
                  </Button>
                </div>
                <button
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                  onClick={() => setExpandedNote((s) => { const n = new Set(s); noteExp ? n.delete(key) : n.add(key); return n; })}
                >
                  {noteExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Note aggiuntive
                </button>
                {noteExp && (
                  <Textarea
                    placeholder="Note opzionali…"
                    value={local.note}
                    onChange={(e) => setLocalValues((v) => ({ ...v, [key]: { ...v[key] ?? { valore: "" }, note: e.target.value } }))}
                    rows={2}
                    className="text-xs resize-none"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderExamCard = (exam: ExamRow) => {
    const isPacchetto = exam.tipo === "pacchetto";
    const components = exam.components ?? [];

    if (isPacchetto) {
      const packageDone = components.length > 0 && components.every((c) => savedIds.has(subKey(c.componentExamId, exam.id)));
      const packageDoneCount = components.filter((c) => savedIds.has(subKey(c.componentExamId, exam.id))).length;

      return (
        <div key={exam.id} className="space-y-2">
          {/* Package header */}
          <div className={`rounded-xl border p-3 transition-all ${packageDone ? "border-green-200 bg-green-50/60" : "border-blue-200/60 bg-blue-50/30"}`}>
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                {packageDone ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Package className="h-5 w-5 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{exam.descrizione}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{exam.codiceAnalisi}</Badge>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px] px-1.5 py-0 gap-1">
                    <Package className="h-2.5 w-2.5" />Pacchetto
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {packageDoneCount} / {components.length} esami completati
                </p>
              </div>
            </div>
          </div>
          {/* Sub-exam rows */}
          {components
            .slice()
            .sort((a, b) => a.ordinamento - b.ordinamento)
            .map((comp) => renderSubExamRow(exam, comp))}
        </div>
      );
    }

    const key = singleKey(exam.id);
    const isDone = savedIds.has(key);
    const saved = getReferto(exam.id);
    const local = localValues[key] ?? { valore: "", note: "" };
    const noteExpanded = expandedNote.has(key);
    const outOfRange = isOutOfRangeAny(exam.referenceRanges, exam.valoreRiferimento, saved?.valore ?? local.valore, patientGender, patientAgeYears);

    return (
      <div
        key={exam.id}
        className={`rounded-xl border p-4 transition-all ${isDone ? "border-green-200 bg-green-50/60" : "border-border bg-card"}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {isDone ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground/40" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{exam.descrizione}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{exam.codiceAnalisi}</Badge>
              {provettaChip(exam.colorProvetta)}
              {exam.metodo && <span className="text-[10px] text-muted-foreground uppercase">{exam.metodo}</span>}
            </div>

            {isDone && saved ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Risultato:</span>
                  <span className={`text-sm font-semibold ${outOfRange ? "text-red-600" : "text-green-700"}`}>
                    {saved.valore}{exam.um ? ` ${exam.um}` : ""}
                  </span>
                  {outOfRange && (
                    <span className="flex items-center gap-0.5 text-xs font-bold text-red-500 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                      <AlertTriangle className="h-3 w-3" />Fuori range
                    </span>
                  )}
                  {fasciaChip(exam.referenceRanges, saved.valore, patientGender, patientAgeYears)}
                  {(exam.referenceRanges?.length || exam.valoreRiferimento) && (
                    <span className="text-xs text-muted-foreground">rif: {displayRefValueAny(exam.referenceRanges as StructuredRefRange[] | null, exam.valoreRiferimento, patientGender, patientAgeYears)}{exam.um ? ` ${exam.um}` : ""}</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => setSavedIds((s) => { const n = new Set(s); n.delete(key); return n; })}
                  >
                    <Pencil className="h-3 w-3" />Modifica
                  </Button>
                </div>
                {saved.note && <p className="text-xs text-muted-foreground italic">Note: {saved.note}</p>}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {(exam.referenceRanges?.length || exam.valoreRiferimento) && (
                  <p className="text-xs text-muted-foreground">
                    Val. riferimento: <span className="font-medium">{displayRefValueAny(exam.referenceRanges as StructuredRefRange[] | null, exam.valoreRiferimento, patientGender, patientAgeYears)}{exam.um ? ` ${exam.um}` : ""}</span>
                  </p>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder={`Inserisci risultato${exam.um ? ` (${exam.um})` : ""}…`}
                    value={local.valore}
                    onChange={(e) => setLocalValues((v) => ({ ...v, [key]: { ...v[key] ?? { note: "" }, valore: e.target.value } }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(key, exam.id)}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
                    disabled={!local.valore?.trim() || saving === key}
                    onClick={() => handleSave(key, exam.id)}
                  >
                    {saving === key ? "…" : "Salva"}
                  </Button>
                </div>
                <button
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                  onClick={() => setExpandedNote((s) => { const n = new Set(s); noteExpanded ? n.delete(key) : n.add(key); return n; })}
                >
                  {noteExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Note aggiuntive
                </button>
                {noteExpanded && (
                  <Textarea
                    placeholder="Note opzionali…"
                    value={local.note}
                    onChange={(e) => setLocalValues((v) => ({ ...v, [key]: { ...v[key] ?? { valore: "" }, note: e.target.value } }))}
                    rows={2}
                    className="text-xs resize-none"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
              {visit.firstName[0]}{visit.lastName[0]}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold leading-tight">
                {visit.firstName} {visit.lastName}
              </DialogTitle>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                {visit.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    <User2 className="h-3 w-3" />
                    {format(parseISO(visit.dateOfBirth), "d MMM yyyy", { locale: it })}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(parseISO(visit.date), "d MMMM yyyy", { locale: it })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <strong className="text-foreground">{visit.time}</strong>
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Progress */}
        <div className="px-5 py-3 border-b border-border/60 shrink-0 bg-muted/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Refertazione esami
            </span>
            <span className={`text-xs font-bold tabular-nums ${allDone ? "text-green-600" : "text-foreground"}`}>
              {doneSlots} / {totalSlots}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Exam list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {refertiLoading ? (
            Array.from({ length: visit.examIds.length }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : (
            exams.map((exam) => renderExamCard(exam))
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-4 border-t border-border shrink-0 flex flex-row items-center justify-between gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrintScheda}>
            <Printer className="h-3.5 w-3.5" />
            Scheda Lab
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={completing}>
              Chiudi
            </Button>
            {visit.status !== "completed" && (
              <Button
                className={`gap-1.5 transition-all ${
                  allDone
                    ? "bg-green-600 hover:bg-green-700 text-white shadow-md"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
                disabled={!allDone || completing}
                onClick={handleComplete}
              >
                <CheckCircle2 className="h-4 w-4" />
                {completing ? "Salvo…" : `Completa (${doneSlots}/${totalSlots})`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
