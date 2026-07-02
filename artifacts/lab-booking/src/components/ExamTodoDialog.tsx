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
  CheckCircle2,
  Printer,
  User2,
  FileDown,
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
  onClose: () => void;
  onCompleted: () => void;
  role?: string;
  onPrintReferto?: () => void;
}

export function ExamTodoDialog({ visit, onClose, onCompleted, role = "segreteria", onPrintReferto }: Props) {
  const { data: allExams } = useListExams();
  const { data: patients } = useListPatients({ search: visit.email });
  const updateStatus = useUpdateBookingStatus();
  const [completing, setCompleting] = React.useState(false);

  const patient = patients?.[0];

  const exams = React.useMemo(
    () => (allExams ?? []).filter((e) => visit.examIds.includes(e.id)),
    [allExams, visit.examIds]
  );

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
          </div>
        </DialogHeader>

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
            {onPrintReferto && (
              <Button variant="outline" size="sm" className="gap-2" onClick={onPrintReferto}>
                <FileDown className="h-3.5 w-3.5" />
                Referto PDF
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
                className="gap-2 bg-green-600 hover:bg-green-700"
                disabled={completing}
                onClick={handleComplete}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {completing ? "Completamento..." : "Segna come Completata"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
