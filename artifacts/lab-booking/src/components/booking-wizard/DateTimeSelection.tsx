import React from "react";
import { useFormContext } from "react-hook-form";
import { useListSlots } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { it } from "date-fns/locale";
import { format, addDays, startOfDay, addWeeks } from "date-fns";
import { ArrowRight } from "lucide-react";
import type { BookingFormValues } from "../../pages/Home";

function getNextWeekday(from: Date): Date {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function DateTimeSelection({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();

  const selectedDate = watch("date");
  const selectedTime = watch("time");

  const today = startOfDay(new Date());
  const firstAvailableDay = getNextWeekday(today);

  const [calendarDate, setCalendarDate] = React.useState<Date | undefined>(undefined);

  const { data: slots, isLoading: slotsLoading } = useListSlots(
    { date: selectedDate ?? "" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!selectedDate } as any }
  );

  const handleDateSelect = (date: Date | undefined) => {
    setCalendarDate(date);
    if (date) {
      setValue("date", format(date, "yyyy-MM-dd"), { shouldValidate: true });
      setValue("time", "", { shouldValidate: false });
    }
  };

  const handleTimeSelect = (time: string) => {
    setValue("time", time, { shouldValidate: true });
  };

  const allSlots = slots ?? [];
  const availableSlots = allSlots.filter((s) => s.available);
  const allUnavailable = allSlots.length > 0 && availableSlots.length === 0;

  const canContinue = !!selectedDate && !!selectedTime;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Scegli Data e Ora</h2>
        <p className="text-muted-foreground text-sm">Seleziona il giorno e l'orario preferito per l'esame. Il laboratorio è aperto dal lunedì al venerdì.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 min-w-0">
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-medium text-foreground">Data</p>
          <div className="border border-border rounded-lg p-3 bg-background w-full">
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={handleDateSelect}
              locale={it}
              disabled={(date) => {
                const d = startOfDay(date);
                const day = d.getDay();
                return d < today || day === 0 || day === 6;
              }}
              defaultMonth={firstAvailableDay}
              fromDate={today}
              toDate={addWeeks(today, 12)}
              className="w-full"
              classNames={{ root: "w-full min-w-0" }}
            />
          </div>
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-2 min-w-0">
          <p className="text-sm font-medium text-foreground">Orario disponibile</p>

          {!selectedDate ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm flex items-center justify-center min-h-[200px]">
              Seleziona prima una data dal calendario
            </div>
          ) : slotsLoading ? (
            <div className="grid grid-cols-3 gap-2 min-h-[200px] content-start">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : allSlots.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm flex items-center justify-center min-h-[200px]">
              Nessun orario per questa data.<br />Prova un altro giorno feriale.
            </div>
          ) : (
            <div className="space-y-3">
              {allUnavailable && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Gli orari di oggi sono esauriti. Seleziona un altro giorno.
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 content-start">
                {allSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => slot.available && handleTimeSelect(slot.time)}
                    title={!slot.available ? "Orario non disponibile" : undefined}
                    className={[
                      "px-3 py-2 rounded-md text-sm font-medium transition-all border",
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
        </div>
      </div>

      {/* Sticky bottom CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={onPrev} size="lg">
            Indietro
          </Button>
          <div className="flex items-center gap-3">
            {canContinue && selectedDate && selectedTime && (
              <p className="text-sm text-muted-foreground hidden sm:block">
                {selectedDate} · {selectedTime}
              </p>
            )}
            <Button onClick={onNext} disabled={!canContinue} size="lg" className="gap-2">
              Continua
              {canContinue && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
