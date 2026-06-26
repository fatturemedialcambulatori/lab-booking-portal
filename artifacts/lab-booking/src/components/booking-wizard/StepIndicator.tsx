import React from "react";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { id: 1, label: "Esame" },
    { id: 2, label: "Data e Ora" },
    { id: 3, label: "Dati" },
    { id: 4, label: "Conferma" },
  ];

  return (
    <div className="flex items-center justify-between w-full relative">
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-border z-0 mx-8"></div>
      
      {steps.map((step) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        const isPending = currentStep < step.id;

        return (
          <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 bg-muted/30 sm:bg-transparent px-2">
            <div 
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors
                ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : ''}
                ${isCurrent ? 'bg-background border-primary text-primary' : ''}
                ${isPending ? 'bg-background border-muted text-muted-foreground' : ''}
              `}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : step.id}
            </div>
            <span 
              className={`text-xs font-medium hidden sm:block
                ${(isCurrent || isCompleted) ? 'text-foreground' : 'text-muted-foreground'}
              `}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
