import React from "react";
import { useFormContext } from "react-hook-form";
import { useListSlots } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { it } from "date-fns/locale";
import { format, addDays } from "date-fns";
import type { BookingFormValues } from "../../pages/Home";

export function DateTimeSelection({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();

  const selectedDate = watch("date");
  const selectedTime = watch("time");
  const examId = watch("examId");

  const [calendarDate, setCalendarDate] = React.useState<Date | undefined>(undefined);

  const { data: slots, isLoading: slotsLoading } = useListSlots(
    { date: selectedDate, examId },
    { query: { enabled: !!selectedDate && !!examId } }
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

  const availableSlots = slots?.filter((s) => s.available) ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Scegli Data e Ora</h2>
        <p className="text-muted-foreground text-sm">Seleziona il giorno e l'orario preferito per l'esame.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Data</p>
          <div className="border border-border rounded-lg p-3 bg-background">
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={handleDateSelect}
              locale={it}
              disabled={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                const day = d.getDay();
                return d < today || day === 0 || day === 6;
              }}
              fromDate={today}
              toDate={addDays(today, 90)}
              className="w-full"
            />
          </div>
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Orario disponibile</p>
          {!selectedDate ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm flex items-center justify-center min-h-[200px]">
              Seleziona prima una data
            </div>
          ) : slotsLoading ? (
            <div className="space-y-2 min-h-[200px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm flex items-center justify-center min-h-[200px]">
              Nessun orario disponibile per questa data.<br />Prova un altro giorno.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 min-h-[200px] content-start">
              {slots?.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => slot.available && handleTimeSelect(slot.time)}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium transition-all border
                    ${!slot.available ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground border-transparent" : ""}
                    ${slot.available && selectedTime === slot.time
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : slot.available
                      ? "bg-background border-border hover:border-primary hover:text-primary cursor-pointer"
                      : ""}
                  `}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
          {errors.time && (
            <p className="text-sm text-destructive">{errors.time.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev} size="lg">
          Indietro
        </Button>
        <Button onClick={onNext} disabled={!selectedDate || !selectedTime} size="lg">
          Continua
        </Button>
      </div>
    </div>
  );
}
