import { useFormContext } from "react-hook-form";
import { useListSlots } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { BookingFormValues } from "../../pages/Home";

export function TimeSelection({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();

  const selectedDate = watch("date");
  const selectedTime = watch("time");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slots, isLoading: slotsLoading } = useListSlots(
    { date: selectedDate ?? "" },
    { query: { enabled: !!selectedDate } as any }
  );

  const handleTimeSelect = (time: string) => {
    setValue("time", time, { shouldValidate: true });
  };

  const allSlots = slots ?? [];
  const availableSlots = allSlots.filter((s) => s.available);
  const allUnavailable = allSlots.length > 0 && availableSlots.length === 0;

  const formattedDate = selectedDate
    ? format(parseISO(selectedDate), "EEEE d MMMM yyyy", { locale: it })
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Scegli l&apos;Orario</h2>
        {selectedDate && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="capitalize">{formattedDate}</span>
          </div>
        )}
      </div>

      {slotsLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      ) : allSlots.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Nessun orario per questa data.<br />Torna indietro e prova un altro giorno feriale.
        </div>
      ) : (
        <div className="space-y-3">
          {allUnavailable && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Gli orari di oggi sono esauriti. Torna indietro e seleziona un altro giorno.
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {allSlots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => slot.available && handleTimeSelect(slot.time)}
                title={!slot.available ? "Orario non disponibile" : undefined}
                className={[
                  "px-3 py-3 rounded-md text-sm font-medium transition-all border",
                  !slot.available
                    ? "opacity-35 cursor-not-allowed bg-muted text-muted-foreground border-transparent line-through"
                    : selectedTime === slot.time
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background border-border hover:border-primary hover:text-primary cursor-pointer",
                ].join(" ")}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {errors.time && (
        <p className="text-sm text-destructive">{errors.time.message}</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={onPrev} size="lg">
            Indietro
          </Button>
          <div className="flex items-center gap-3">
            {selectedTime && (
              <p className="text-sm text-muted-foreground hidden sm:block">
                Orario selezionato: <strong>{selectedTime}</strong>
              </p>
            )}
            <Button onClick={onNext} disabled={!selectedTime} size="lg" className="gap-2">
              Continua
              {selectedTime && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
