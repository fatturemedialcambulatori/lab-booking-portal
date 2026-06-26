import React from "react";
import { useFormContext } from "react-hook-form";
import { useListExams } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Info, CheckCircle2 } from "lucide-react";
import type { BookingFormValues } from "../../pages/Home";

export function ExamSelection({ onNext }: { onNext: () => void }) {
  const { data: exams, isLoading, error } = useListExams();
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();
  
  const selectedExamId = watch("examId");

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-muted rounded"></div>
        <div className="h-24 w-full bg-muted rounded"></div>
        <div className="h-24 w-full bg-muted rounded"></div>
      </div>
    );
  }

  if (error || !exams) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Impossibile caricare gli esami. Riprova più tardi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Seleziona Esame</h2>
        <p className="text-muted-foreground text-sm">Scegli la prestazione di cui hai bisogno.</p>
      </div>

      <div className="space-y-3">
        {exams.map((exam) => {
          const isSelected = selectedExamId === exam.id;
          return (
            <Card 
              key={exam.id}
              className={`p-4 cursor-pointer transition-all border-2 ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent hover:border-border'}`}
              onClick={() => setValue("examId", exam.id, { shouldValidate: true })}
              data-testid={`card-exam-${exam.id}`}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {exam.category}
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <h3 className="font-medium text-base">{exam.name}</h3>
                  {exam.description && (
                    <p className="text-sm text-muted-foreground">{exam.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{exam.durationMinutes} min</span>
                    </div>
                    {exam.preparationInstructions && (
                      <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        <Info className="w-3.5 h-3.5" />
                        <span>Preparazione: {exam.preparationInstructions}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {errors.examId && (
        <p className="text-sm text-destructive">{errors.examId.message}</p>
      )}

      <div className="flex justify-end pt-4">
        <Button 
          onClick={onNext} 
          disabled={!selectedExamId}
          size="lg"
          className="w-full sm:w-auto"
          data-testid="button-next-step1"
        >
          Continua
        </Button>
      </div>
    </div>
  );
}
