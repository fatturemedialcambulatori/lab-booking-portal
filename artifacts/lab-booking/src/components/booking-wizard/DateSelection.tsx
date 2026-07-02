import React from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { format, startOfDay, addWeeks } from "date-fns";
import { ArrowRight } from "lucide-react";
import { CustomCalendar } from "./CustomCalendar";
import type { BookingFormValues } from "../../pages/Home";

function getNextWeekday(from: Date): Date {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function DateSelection({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();

  const selectedDate = watch("date");
  const today = startOfDay(new Date());
  const firstAvailableDay = getNextWeekday(today);

  const selectedDateObj = React.useMemo(() => {
    if (!selectedDate) return undefined;
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setValue("date", format(date, "yyyy-MM-dd"), { shouldValidate: true });
      setValue("time", "", { shouldValidate: false });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Scegli la Data</h2>
        <p className="text-muted-foreground text-sm">
          Seleziona il giorno per l&apos;esame. Il laboratorio è aperto dal lunedì al venerdì.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-sm">
          <CustomCalendar
            selected={selectedDateObj}
            onSelect={handleDateSelect}
            disabled={(date) => {
              const d = startOfDay(date);
              const day = d.getDay();
              return d < today || day === 0 || day === 6;
            }}
            defaultMonth={selectedDateObj ?? firstAvailableDay}
            fromDate={today}
            toDate={addWeeks(today, 12)}
          />
          {errors.date && (
            <p className="text-sm text-destructive mt-2">{errors.date.message}</p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={onPrev} size="lg">
            Indietro
          </Button>
          <Button onClick={onNext} disabled={!selectedDate} size="lg" className="gap-2">
            Continua
            {selectedDate && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
