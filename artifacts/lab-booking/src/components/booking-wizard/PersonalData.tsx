import React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, UserCheck } from "lucide-react";
import type { BookingFormValues } from "../../pages/Home";
import { parseFiscalCode } from "@/lib/fiscalCode";

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
  const { register, watch, setValue, control, formState: { errors } } = useFormContext<BookingFormValues>();

  const cfValue = watch("codiceFiscale") ?? "";
  const cfInfo = React.useMemo(() => parseFiscalCode(cfValue), [cfValue]);

  React.useEffect(() => {
    if (cfInfo) {
      const current = watch("dateOfBirth");
      if (!current) setValue("dateOfBirth", cfInfo.dateOfBirth, { shouldValidate: true });
      setValue("gender", cfInfo.gender, { shouldValidate: true });
    }
  }, [cfInfo, setValue, watch]);

  const genderValue = watch("gender");

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

      {/* Codice Fiscale */}
      <div className="space-y-1.5">
        <Label htmlFor="codiceFiscale" className="text-sm font-medium text-foreground">
          Codice Fiscale
        </Label>
        <Input
          id="codiceFiscale"
          placeholder="RSSMRA85M01H501Z"
          {...register("codiceFiscale")}
          className="uppercase"
          maxLength={16}
        />
        {cfInfo && (
          <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/8 rounded-md px-3 py-1.5">
            <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {cfInfo.gender === "M" ? "Uomo" : "Donna"} · {cfInfo.age} anni · nato/a il {cfInfo.dateOfBirth.split("-").reverse().join("/")}
            </span>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Data di nascita */}
        <div className="space-y-1.5">
          <Label htmlFor="dateOfBirth" className="text-sm font-medium text-foreground">
            Data di nascita <span className="text-destructive">*</span>
          </Label>
          <Input
            id="dateOfBirth"
            type="date"
            {...register("dateOfBirth")}
            className={errors.dateOfBirth ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.dateOfBirth && (
            <p className="text-xs text-destructive">{errors.dateOfBirth.message}</p>
          )}
        </div>

        {/* Sesso */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Sesso</Label>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <div className="flex gap-2">
                {(["M", "F"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => field.onChange(field.value === v ? undefined : v)}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                      field.value === v
                        ? "border-primary bg-primary text-white"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {v === "M" ? "M — Maschio" : "F — Femmina"}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
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

      {/* Sticky bottom CTA */}
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
