import React from "react";
import { useListExams, useUpdateBookingStatus, useListPatients } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  FlaskConical,
  CheckCircle2,
  Circle,
  Printer,
  X,
  User2,
} from "lucide-react";
import { printSchedaLaboratorio, printPreventivo } from "@/lib/printDocs";

export type TodoVisit = {
  id: number;
  key: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  codiceFiscale?: string | null;
  time: string;
  date: string;
  email: string;
  phone: string;
  notes?: string | null;
  examIds: number[];
  examNames: string[];
  status: string;
};

interface Props {
  visit: TodoVisit;
  doneIds: Set<number>;
  onToggle: (examId: number) => void;
  onClose: () => void;
  onCompleted: () => void;
  role?: string;
}

export function ExamTodoDialog({ visit, doneIds, onToggle, onClose, onCompleted, role = "segreteria" }: Props) {
  const { data: allExams } = useListExams();
  const { data: patients } = useListPatients({ search: visit.email });
  const updateStatus = useUpdateBookingStatus();
  const [completing, setCompleting] = React.useState(false);

  const patient = patients?.[0];

  const exams = React.useMemo(
    () => (allExams ?? []).filter((e) => visit.examIds.includes(e.id)),
    [allExams, visit.examIds]
  );

  const doneCount = exams.filter((e) => doneIds.has(e.id)).length;
  const total = exams.length;
  const allDone = total > 0 && doneCount === total;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await updateStatus.mutateAsync({ id: visit.id, data: { status: "completed" } });
      onCompleted();
    } finally {
      setCompleting(false);
    }
  };

  const fullPatient = () => ({
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
  });

  const handlePrintScheda = () => {
    printSchedaLaboratorio(fullPatient(), exams);
  };

  const handlePrintPreventivo = () => {
    printPreventivo(fullPatient(), exams);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
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
                {visit.notes && (
                  <p className="text-xs text-muted-foreground italic mt-0.5">"{visit.notes}"</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Progress bar */}
        <div className="px-5 py-3 border-b border-border/60 shrink-0 bg-muted/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Avanzamento esami
            </span>
            <span className={`text-xs font-bold ${allDone ? "text-green-600" : "text-primary"}`}>
              {doneCount} / {total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${allDone ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Exam checklist */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Caricamento esami...</p>
          ) : (
            exams.map((exam) => {
              const done = doneIds.has(exam.id);
              return (
                <button
                  key={exam.id}
                  onClick={() => onToggle(exam.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${
                    done
                      ? "border-green-300 bg-green-50"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  {/* Checkbox icon */}
                  <div className="flex-shrink-0">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Exam info */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium leading-snug ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {exam.descrizione}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{exam.codiceAnalisi}</span>
                      {exam.colorProvetta && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FlaskConical className="h-2.5 w-2.5" />
                          {exam.colorProvetta}
                        </span>
                      )}
                      {exam.metodo && (
                        <span className="text-xs text-muted-foreground">{exam.metodo}</span>
                      )}
                    </div>
                    {exam.preparationInstructions && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 inline-block">
                        {exam.preparationInstructions}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrintScheda}>
              <Printer className="h-3.5 w-3.5" />
              Scheda Lab
            </Button>
            {role === "segreteria" && (
              <Button variant="outline" size="sm" className="gap-2" onClick={handlePrintPreventivo}>
                <Printer className="h-3.5 w-3.5" />
                Preventivo
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Chiudi
            </Button>
            {visit.status === "accepted" && (
              <Button
                size="sm"
                className={`gap-2 ${allDone ? "bg-green-600 hover:bg-green-700" : ""}`}
                disabled={!allDone || completing}
                onClick={handleComplete}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {completing ? "Completamento..." : allDone ? "Segna come Completata" : `Completa (${doneCount}/${total})`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
