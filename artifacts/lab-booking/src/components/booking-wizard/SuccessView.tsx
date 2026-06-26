import React from "react";
import { useGetBooking } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CheckCircle2, Calendar, Clock, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuccessView({ bookingId }: { bookingId: number }) {
  const { data: booking, isLoading } = useGetBooking(bookingId);

  const handleNewBooking = () => {
    window.location.reload();
  };

  const formattedDate = booking?.date
    ? format(parseISO(booking.date), "d MMMM yyyy", { locale: it })
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-white border-b border-border py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
            <span className="text-white font-bold text-lg leading-none">+</span>
          </div>
          <span className="font-semibold text-lg text-primary">LabMedica</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Prenotazione confermata</h1>
            <p className="text-muted-foreground">
              Riceverai una email di conferma all'indirizzo indicato.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : booking ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="bg-primary/8 px-5 py-4 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-primary">Prenotazione #{booking.id}</p>
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                  Confermata
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FlaskConical className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {booking.examNames.length === 1 ? "Esame" : `Esami (${booking.examNames.length})`}
                    </p>
                    <div className="space-y-0.5">
                      {booking.examNames.map((name, i) => (
                        <p key={i} className="font-medium text-foreground">{name}</p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-medium text-foreground capitalize">{formattedDate}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Orario</p>
                    <p className="font-medium text-foreground">{booking.time}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <p className="text-sm text-muted-foreground">
                    Paziente: <span className="text-foreground font-medium">{booking.firstName} {booking.lastName}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 text-center">
            <Button variant="outline" onClick={handleNewBooking} className="w-full sm:w-auto">
              Effettua un'altra prenotazione
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
