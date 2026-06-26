import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { StepIndicator } from "@/components/booking-wizard/StepIndicator";
import { ExamSelection } from "@/components/booking-wizard/ExamSelection";
import { DateTimeSelection } from "@/components/booking-wizard/DateTimeSelection";
import { PersonalData } from "@/components/booking-wizard/PersonalData";
import { Confirmation } from "@/components/booking-wizard/Confirmation";
import { SuccessView } from "@/components/booking-wizard/SuccessView";

const bookingSchema = z.object({
  examIds: z.array(z.number()).min(1, "Seleziona almeno un esame"),
  date: z.string({ required_error: "Seleziona una data" }),
  time: z.string({ required_error: "Seleziona un orario" }),
  firstName: z.string().min(1, "Il nome è obbligatorio"),
  lastName: z.string().min(1, "Il cognome è obbligatorio"),
  dateOfBirth: z.string().min(1, "La data di nascita è obbligatoria"),
  codiceFiscale: z.string().optional(),
  email: z.string().email("Email non valida"),
  phone: z.string().min(5, "Il telefono è obbligatorio"),
  notes: z.string().optional(),
});

export type BookingFormValues = z.infer<typeof bookingSchema>;

export default function Home() {
  const [step, setStep] = React.useState(1);
  const [confirmedBookingId, setConfirmedBookingId] = React.useState<number | null>(null);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      examIds: [],
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      notes: "",
    },
    mode: "onTouched"
  });

  const nextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await form.trigger(["examIds"]);
    } else if (step === 2) {
      isValid = await form.trigger(["date", "time"]);
    } else if (step === 3) {
      isValid = await form.trigger(["firstName", "lastName", "dateOfBirth", "email", "phone"]);
    }

    if (isValid) {
      setStep((s) => Math.min(s + 1, 4));
    }
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  if (confirmedBookingId) {
    return <SuccessView bookingId={confirmedBookingId} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-white border-b border-border py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none">+</span>
            </div>
            <span className="font-semibold text-lg text-primary">LabMedica</span>
          </div>
          <a
            href="/admin"
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 border border-border rounded-md px-3 py-1.5 hover:border-primary"
          >
            Accesso Operatori
          </a>
        </div>
      </header>

      {/* pb-28 leaves space for the fixed bottom CTA bar */}
      <main className="flex-1 py-12 px-4 sm:px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Prenota un esame</h1>
            <p className="text-muted-foreground">Pochi semplici passi per prenotare la tua visita presso i nostri laboratori.</p>
          </div>

          <Card className="p-0 overflow-hidden border-border/60 shadow-lg">
            <div className="bg-muted/30 px-6 py-5 border-b border-border/40">
              <StepIndicator currentStep={step} />
            </div>

            <div className="p-6 sm:p-8">
              <Form {...form}>
                <div className={step === 1 ? "block" : "hidden"}>
                  <ExamSelection onNext={nextStep} />
                </div>
                <div className={step === 2 ? "block" : "hidden"}>
                  <DateTimeSelection onNext={nextStep} onPrev={prevStep} />
                </div>
                <div className={step === 3 ? "block" : "hidden"}>
                  <PersonalData onNext={nextStep} onPrev={prevStep} />
                </div>
                <div className={step === 4 ? "block" : "hidden"}>
                  <Confirmation
                    onPrev={prevStep}
                    onSuccess={(id) => setConfirmedBookingId(id)}
                  />
                </div>
              </Form>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
