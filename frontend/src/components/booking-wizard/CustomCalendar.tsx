import React from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  format,
} from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CustomCalendarProps {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  fromDate?: Date;
  toDate?: Date;
  defaultMonth?: Date;
}

const DAYS_SHORT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

export function CustomCalendar({
  selected,
  onSelect,
  disabled,
  fromDate,
  toDate,
  defaultMonth,
}: CustomCalendarProps) {
  const [viewDate, setViewDate] = React.useState<Date>(
    defaultMonth ?? selected ?? new Date()
  );

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const prevMonthStart = startOfMonth(subMonths(viewDate, 1));
  const nextMonthStart = startOfMonth(addMonths(viewDate, 1));
  const canGoPrev = !fromDate || prevMonthStart >= startOfMonth(fromDate);
  const canGoNext = !toDate || nextMonthStart <= startOfMonth(toDate);

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const monthLabel = format(viewDate, "MMMM yyyy", { locale: it });

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          onClick={() => canGoPrev && setViewDate((d) => subMonths(d, 1))}
          disabled={!canGoPrev}
          className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Mese precedente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-sm font-medium capitalize">{monthLabel}</span>

        <button
          type="button"
          onClick={() => canGoNext && setViewDate((d) => addMonths(d, 1))}
          disabled={!canGoNext}
          className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Mese successivo"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            {DAYS_SHORT.map((d) => (
              <th
                key={d}
                style={{ textAlign: "center", padding: "0 0 8px 0", fontSize: "12px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day) => {
                const inMonth = isSameMonth(day, viewDate);
                const isSelected = !!selected && isSameDay(day, selected);
                const isOff = disabled?.(day) ?? false;
                const isToday = isSameDay(day, new Date());

                let bg = "transparent";
                let color = "inherit";
                let opacity = inMonth ? 1 : 0.3;
                if (isOff) opacity = 0.3;
                if (isToday && !isSelected) bg = "hsl(var(--accent))";
                if (isSelected) { bg = "hsl(var(--primary))"; color = "hsl(var(--primary-foreground))"; opacity = 1; }

                return (
                  <td key={day.toISOString()} style={{ padding: "2px", textAlign: "center" }}>
                    <button
                      type="button"
                      disabled={isOff}
                      onClick={() => !isOff && onSelect(isSameDay(day, selected ?? new Date(-1)) ? undefined : day)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: isSelected ? 600 : 400,
                        cursor: isOff ? "not-allowed" : "pointer",
                        opacity,
                        backgroundColor: bg,
                        color,
                        transition: "background-color 0.15s",
                      }}
                    >
                      {format(day, "d")}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
