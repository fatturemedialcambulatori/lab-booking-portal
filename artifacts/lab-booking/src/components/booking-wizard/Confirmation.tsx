import React from "react";
import { useFormContext } from "react-hook-form";
import { useListExams, useCreateBooking } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import type { BookingFormValues } from "../../pages/Home";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right ml-4 max-w-[60%]">{value}</span>
    </div>
  );
}

export function Confirmation({
  onPrev,
  onSuccess,
}: {
  onPrev: () => void;
  onSuccess: (id: number) => void;
}) {
  const { getValues } = useFormContext<BookingFormValues>();
  const values = getValues();
  const { data: exams } = useListExams();
  const mutation = useCreateBooking();

  const selectedExams = (exams ?? []).filter((e) => (values.examIds ?? []).includes(e.id));
  const totalPrice = selectedExams.reduce((sum, e) => sum + (e.importo ? Number(e.importo) : 0), 0);

  const formattedDate = values.date
    ? format(parseISO(values.date), "d MMMM yyyy", { locale: it })
    : "";

  const formattedDob = values.dateOfBirth
    ? format(parseISO(values.dateOfBirth), "d MMMM yyyy", { locale: it })
    : "";

  const handleConfirm = () => {
    mutation.mutate(
      {
        data: {
          examIds: values.examIds,
          date: values.date,
          time: values.time,
          firstName: values.firstName,
          lastName: values.lastName,
          dateOfBirth: values.dateOfBirth,
          email: values.email,
          phone: values.phone,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: (booking) => {
          onSuccess(booking.id);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Riepilogo Prenotazione</h2>
        <p className="text-muted-foreground text-sm">Verifica i dati prima di confermare.</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
        <div className="bg-primary/8 px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Esami selezionati ({selectedExams.length})
          </p>
          {totalPrice > 0 && (
            <p className="text-xs font-semibold text-primary">Totale: € {totalPrice.toFixed(2)}</p>
          )}
        </div>
        <div className="px-4 divide-y divide-border/60">
          {selectedExams.map((exam) => (
            <div key={exam.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{exam.descrizione}</p>
                <p className="text-xs text-muted-foreground">{exam.codiceAnalisi}</p>
              </div>
              {exam.importo && (
                <span className="text-sm font-semibold text-primary ml-4 flex-shrink-0">
                  € {Number(exam.importo).toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
        <div className="bg-primary/8 px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Data e ora</p>
        </div>
        <div className="px-4 divide-y divide-border/60">
          <Row label="Data" value={formattedDate} />
          <Row label="Orario" value={values.time} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
        <div className="bg-primary/8 px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Dati paziente</p>
        </div>
        <div className="px-4 divide-y divide-border/60">
          <Row label="Nome e cognome" value={`${values.firstName} ${values.lastName}`} />
          <Row label="Data di nascita" value={formattedDob} />
          <Row label="Email" value={values.email} />
          <Row label="Telefono" value={values.phone} />
          {values.notes && <Row label="Note" value={values.notes} />}
        </div>
      </div>

      {mutation.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          Si è verificato un errore. Riprova o contatta il laboratorio.
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev} disabled={mutation.isPending} size="lg">
          Indietro
        </Button>
        <Button onClick={handleConfirm} disabled={mutation.isPending} size="lg" className="min-w-[200px]">
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confermando...
            </>
          ) : (
            "Conferma Prenotazione"
          )}
        </Button>
      </div>
    </div>
  );
}
