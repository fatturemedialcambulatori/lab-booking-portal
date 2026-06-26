import React from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import type { BookingFormValues } from "../../pages/Home";

function FormField({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: keyof BookingFormValues;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const { register, formState: { errors } } = useFormContext<BookingFormValues>();
  const error = errors[name];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        {...register(name)}
        className={error ? "border-destructive focus-visible:ring-destructive" : ""}
      />
      {error && (
        <p className="text-xs text-destructive">{error.message as string}</p>
      )}
    </div>
  );
}

export function PersonalData({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const { register, formState: { errors } } = useFormContext<BookingFormValues>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Dati Personali</h2>
        <p className="text-muted-foreground text-sm">Inserisci i tuoi dati per completare la prenotazione.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Nome" name="firstName" placeholder="Mario" required />
        <FormField label="Cognome" name="lastName" placeholder="Rossi" required />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FormField
          label="Data di nascita"
          name="dateOfBirth"
          type="date"
          required
        />
        <FormField
          label="Codice Fiscale"
          name="codiceFiscale"
          placeholder="RSSMRA85M01H501Z"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Email" name="email" type="email" placeholder="mario.rossi@email.it" required />
        <FormField label="Telefono" name="phone" type="tel" placeholder="+39 333 1234567" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm font-medium text-foreground">
          Note aggiuntive
          <span className="text-muted-foreground ml-1 font-normal">(facoltativo)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Allergie, farmaci in uso, o altre informazioni utili per il laboratorio..."
          rows={3}
          {...register("notes")}
          className="resize-none"
        />
      </div>

      {/* Sticky bottom CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={onPrev} size="lg">
            Indietro
          </Button>
          <Button onClick={onNext} size="lg" className="gap-2">
            Continua
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
