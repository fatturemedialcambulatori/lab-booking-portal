import React from "react";
import { useFormContext } from "react-hook-form";
import { useListExams } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BookingFormValues } from "../../pages/Home";

const TUBE_COLOR_STYLE: Record<string, string> = {
  "GIALLO": "bg-yellow-400",
  "ROSSO": "bg-red-500",
  "VIOLA": "bg-purple-500",
  "BLU": "bg-blue-500",
  "VERDE": "bg-green-500",
  "GRIGIO": "bg-gray-400",
  "ARANCIO": "bg-orange-400",
  "ARANCIONE": "bg-orange-400",
  "BIANCO": "bg-white border border-gray-300",
  "NERO": "bg-gray-900",
};

function TubeDot({ color }: { color: string | null | undefined }) {
  if (!color) return null;
  const key = color.toUpperCase().trim();
  const cls = TUBE_COLOR_STYLE[key] ?? "bg-gray-300";
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${cls}`}
      title={`Provetta ${color}`}
    />
  );
}

export function ExamSelection({ onNext }: { onNext: () => void }) {
  const { data: exams, isLoading, error } = useListExams();
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();
  const [search, setSearch] = React.useState("");

  const selectedExamId = watch("examId");

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
        <h2 className="text-xl font-semibold mb-1 text-foreground">Seleziona Esame</h2>
        <p className="text-muted-foreground text-sm">Scegli la prestazione da prenotare.</p>
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

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Nessun esame trovato.</p>
        ) : filtered.map((exam) => {
          const isSelected = selectedExamId === exam.id;
          return (
            <Card
              key={exam.id}
              className={`p-3 cursor-pointer transition-all border-2 ${
                isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-transparent hover:border-border"
              }`}
              onClick={() => setValue("examId", exam.id, { shouldValidate: true })}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <TubeDot color={exam.colorProvetta} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-snug truncate">{exam.descrizione}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {exam.codiceAnalisi}
                      {exam.um && <span className="ml-2 text-muted-foreground/70">· {exam.um}</span>}
                      {exam.synlab && (
                        <span className="ml-2 text-blue-600 font-medium">· Synlab</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {exam.importo && (
                    <span className="text-sm font-semibold text-primary whitespace-nowrap">
                      € {Number(exam.importo).toFixed(2)}
                    </span>
                  )}
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {errors.examId && (
        <p className="text-sm text-destructive">{errors.examId.message}</p>
      )}

      <div className="flex justify-end pt-2">
        <Button
          onClick={onNext}
          disabled={!selectedExamId}
          size="lg"
          className="w-full sm:w-auto"
        >
          Continua
        </Button>
      </div>
    </div>
  );
}
