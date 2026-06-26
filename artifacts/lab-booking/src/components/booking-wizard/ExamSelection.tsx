import React from "react";
import { useFormContext } from "react-hook-form";
import { useListExams } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Search, X, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BookingFormValues } from "../../pages/Home";


export function ExamSelection({ onNext }: { onNext: () => void }) {
  const { data: exams, isLoading, error } = useListExams();
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();
  const [search, setSearch] = React.useState("");

  const selectedIds: number[] = watch("examIds") ?? [];

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      setValue("examIds", selectedIds.filter((x) => x !== id), { shouldValidate: true });
    } else {
      setValue("examIds", [...selectedIds, id], { shouldValidate: true });
    }
  };

  const filtered = React.useMemo(() => {
    if (!exams) return [];
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter(
      (e) =>
        e.descrizione.toLowerCase().includes(q) ||
        e.codiceAnalisi.toLowerCase().includes(q) ||
        (e.metodo ?? "").toLowerCase().includes(q)
    );
  }, [exams, search]);

  const selectedExams = React.useMemo(
    () => (exams ?? []).filter((e) => selectedIds.includes(e.id)),
    [exams, selectedIds]
  );

  const totalPrice = selectedExams.reduce((sum, e) => sum + (e.importo ? Number(e.importo) : 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-full bg-muted rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (error || !exams) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Impossibile caricare il listino esami. Riprova.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Seleziona Esami</h2>
        <p className="text-muted-foreground text-sm">Puoi selezionare uno o più esami da prenotare.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Cerca per nome o codice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {selectedExams.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1 max-w-[220px]"
              >
                <span className="truncate">{e.descrizione}</span>
                <button
                  type="button"
                  onClick={() => toggle(e.id)}
                  className="flex-shrink-0 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Nessun esame trovato.</p>
        ) : filtered.map((exam) => {
          const isSelected = selectedIds.includes(exam.id);
          return (
            <Card
              key={exam.id}
              className={`p-3 cursor-pointer transition-all border-2 ${
                isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-transparent hover:border-border"
              }`}
              onClick={() => toggle(exam.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                    isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-snug truncate">{exam.descrizione}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {exam.codiceAnalisi}
                      {exam.um && <span className="ml-2 text-muted-foreground/70">· {exam.um}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {exam.importo && (
                    <span className="text-sm font-semibold text-primary whitespace-nowrap">
                      € {Number(exam.importo).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {errors.examIds && (
        <p className="text-sm text-destructive">{errors.examIds.message}</p>
      )}

      {/* Sticky bottom CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {selectedIds.length > 0 ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">
                {selectedIds.length} {selectedIds.length === 1 ? "esame" : "esami"} selezionat{selectedIds.length === 1 ? "o" : "i"}
              </p>
              {totalPrice > 0 && (
                <p className="text-xs text-muted-foreground">Totale stimato: € {totalPrice.toFixed(2)}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Seleziona almeno un esame</p>
          )}
          <Button
            onClick={onNext}
            disabled={selectedIds.length === 0}
            size="lg"
            className="flex-shrink-0 gap-2"
          >
            Continua
            {selectedIds.length > 0 && (
              <>
                <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-bold leading-none">
                  {selectedIds.length}
                </span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
