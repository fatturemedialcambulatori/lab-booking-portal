import React from "react";
import {
  useListReferti,
  useUpsertReferto,
  useUpdateBookingStatus,
  useListPatients,
  useListExams,
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
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { printSchedaLaboratorio } from "@/lib/printDocs";
import { displayRefValue, isOutOfRange } from "@/lib/refValue";
import type { TodoVisit } from "./ExamTodoDialog";

interface Props {
  visit: TodoVisit;
  onClose: () => void;
  onCompleted: () => void;
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

export function RefertazioneDialog({ visit, onClose, onCompleted }: Props) {
  const queryClient = useQueryClient();

  const { data: allExams } = useListExams();
  const { data: refertiData, isLoading: refertiLoading, refetch: refetchReferti } = useListReferti(
    { bookingId: visit.id }
  );
  const { data: patients } = useListPatients({ search: visit.email });
  const upsertReferto = useUpsertReferto();
  const updateStatus = useUpdateBookingStatus();

  const [saving, setSaving] = React.useState<number | null>(null);
  const [completing, setCompleting] = React.useState(false);
  const [localValues, setLocalValues] = React.useState<Record<number, { valore: string; note: string }>>({});
  const [expandedNote, setExpandedNote] = React.useState<Set<number>>(new Set());
  const [savedIds, setSavedIds] = React.useState<Set<number>>(new Set());

  const patient = patients?.[0];

  const exams = React.useMemo(
    () => (allExams ?? []).filter((e) => visit.examIds.includes(e.id)),
    [allExams, visit.examIds]
  );

  React.useEffect(() => {
    if (!refertiData) return;
    const init: Record<number, { valore: string; note: string }> = {};
    const saved = new Set<number>();
    for (const r of refertiData) {
      init[r.examId] = { valore: r.valore, note: r.note ?? "" };
      saved.add(r.examId);
    }
    setLocalValues((prev) => {
      const merged = { ...init };
      for (const [k, v] of Object.entries(prev)) {
        if (!saved.has(Number(k))) merged[Number(k)] = v;
      }
      return merged;
    });
    setSavedIds(saved);
  }, [refertiData]);

  const getReferto = (examId: number) => refertiData?.find((r) => r.examId === examId);

  const handleSave = async (examId: number) => {
    const val = localValues[examId];
    if (!val?.valore?.trim()) return;
    setSaving(examId);
    try {
      await upsertReferto.mutateAsync({
        data: {
          bookingId: visit.id,
          examId,
          valore: val.valore.trim(),
          note: val.note?.trim() || null,
        },
      });
      await refetchReferti();
      setSavedIds((s) => new Set([...s, examId]));
      await queryClient.invalidateQueries({ queryKey: ["listBookings"] });
    } finally {
      setSaving(null);
    }
  };

  const allDone = exams.length > 0 && exams.every((e) => savedIds.has(e.id));
  const doneCount = exams.filter((e) => savedIds.has(e.id)).length;
  const pct = exams.length > 0 ? Math.round((doneCount / exams.length) * 100) : 0;

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
              {doneCount} / {exams.length}
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
            exams.map((exam) => {
              const isDone = savedIds.has(exam.id);
              const saved = getReferto(exam.id);
              const local = localValues[exam.id] ?? { valore: "", note: "" };
              const noteExpanded = expandedNote.has(exam.id);
              const outOfRange = isOutOfRange(exam.valoreRiferimento, saved?.valore ?? local.valore);

              return (
                <div
                  key={exam.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isDone
                      ? "border-green-200 bg-green-50/60"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className="mt-0.5 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Exam header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {exam.descrizione}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                          {exam.codiceAnalisi}
                        </Badge>
                        {provettaChip(exam.colorProvetta)}
                        {exam.metodo && (
                          <span className="text-[10px] text-muted-foreground uppercase">{exam.metodo}</span>
                        )}
                      </div>

                      {isDone && saved ? (
                        /* Saved state: show result + edit option */
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Risultato:</span>
                            <span className={`text-sm font-semibold ${outOfRange ? "text-red-600" : "text-green-700"}`}>
                              {saved.valore}{exam.um ? ` ${exam.um}` : ""}
                            </span>
                            {outOfRange && (
                              <span className="flex items-center gap-0.5 text-xs font-bold text-red-500 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                Fuori range
                              </span>
                            )}
                            {exam.valoreRiferimento && (
                              <span className="text-xs text-muted-foreground">
                                rif: {displayRefValue(exam.valoreRiferimento)}{exam.um ? ` ${exam.um}` : ""}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-xs text-muted-foreground"
                              onClick={() => {
                                setSavedIds((s) => { const n = new Set(s); n.delete(exam.id); return n; });
                              }}
                            >
                              Modifica
                            </Button>
                          </div>
                          {saved.note && (
                            <p className="text-xs text-muted-foreground italic">Note: {saved.note}</p>
                          )}
                        </div>
                      ) : (
                        /* Input state */
                        <div className="mt-2 space-y-2">
                          {exam.valoreRiferimento && (
                            <p className="text-xs text-muted-foreground">
                              Val. riferimento: <span className="font-medium">{displayRefValue(exam.valoreRiferimento)}{exam.um ? ` ${exam.um}` : ""}</span>
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Input
                              placeholder={`Inserisci risultato${exam.um ? ` (${exam.um})` : ""}…`}
                              value={local.valore}
                              onChange={(e) =>
                                setLocalValues((v) => ({
                                  ...v,
                                  [exam.id]: { ...v[exam.id] ?? { note: "" }, valore: e.target.value },
                                }))
                              }
                              onKeyDown={(e) => e.key === "Enter" && handleSave(exam.id)}
                              className="h-8 text-sm flex-1"
                            />
                            <Button
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
                              disabled={!local.valore?.trim() || saving === exam.id}
                              onClick={() => handleSave(exam.id)}
                            >
                              {saving === exam.id ? "…" : "Salva"}
                            </Button>
                          </div>
                          {/* Note toggle */}
                          <button
                            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                            onClick={() =>
                              setExpandedNote((s) => {
                                const n = new Set(s);
                                noteExpanded ? n.delete(exam.id) : n.add(exam.id);
                                return n;
                              })
                            }
                          >
                            {noteExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Note aggiuntive
                          </button>
                          {noteExpanded && (
                            <Textarea
                              placeholder="Note opzionali…"
                              value={local.note}
                              onChange={(e) =>
                                setLocalValues((v) => ({
                                  ...v,
                                  [exam.id]: { ...v[exam.id] ?? { valore: "" }, note: e.target.value },
                                }))
                              }
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
            })
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
                {completing ? "Salvo…" : `Completa (${doneCount}/${exams.length})`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
