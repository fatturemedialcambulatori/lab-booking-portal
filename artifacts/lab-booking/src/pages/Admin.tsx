import React from "react";
import { useListBookings } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  RefreshCw,
  CalendarDays,
  FlaskConical,
  User,
  Phone,
  LogOut,
  UserCheck,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Login } from "./Login";
import { AdminExams } from "./AdminExams";
import { AccettazionePaziente } from "./AccettazionePaziente";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "confirmed":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Confermata</Badge>;
    case "accepted":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 gap-1"><UserCheck className="h-3 w-3" />Accettata</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1"><CheckCircle2 className="h-3 w-3" />Completata</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Annullata</Badge>;
    default:
      return <Badge variant="secondary">In attesa</Badge>;
  }
}

export default function Admin() {
  const [, navigate] = useLocation();
  const [role, setRole] = React.useState<string | null>(
    () => sessionStorage.getItem("operator_role")
  );

  const handleLogout = () => {
    sessionStorage.removeItem("operator_role");
    setRole(null);
  };

  if (!role) {
    return <Login onSuccess={(r) => setRole(r)} />;
  }

  const roleLabel = role === "segreteria" ? "Segreteria" : "Laboratorio";

  return <AdminDashboard roleLabel={roleLabel} onLogout={handleLogout} navigate={navigate} />;
}

type TabId = "prenotazioni" | "accettazione" | "listino";

function AdminDashboard({
  roleLabel,
  onLogout,
  navigate,
}: {
  roleLabel: string;
  onLogout: () => void;
  navigate: (path: string) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<TabId>("accettazione");
  const { data: bookings, isLoading, error, refetch, isFetching } = useListBookings();

  const today = format(new Date(), "yyyy-MM-dd");
  const todayBookings = bookings?.filter((b) => b.date === today) ?? [];
  const upcomingBookings = bookings?.filter((b) => b.date > today) ?? [];
  const pastBookings = bookings?.filter((b) => b.date < today) ?? [];

  const TABS: { id: TabId; label: string; icon?: React.ReactNode }[] = [
    { id: "accettazione", label: "Accettazione", icon: <UserCheck className="h-3.5 w-3.5" /> },
    { id: "prenotazioni", label: "Prenotazioni", icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "listino", label: "Listino Esami", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none">+</span>
            </div>
            <div>
              <span className="font-semibold text-lg text-primary leading-none">LabMedica</span>
              <span className="text-xs text-muted-foreground block leading-none mt-0.5">Pannello {roleLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "prenotazioni" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Aggiorna
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 hidden sm:flex">
              <ArrowLeft className="h-3.5 w-3.5" />
              Portale pazienti
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2 text-muted-foreground hover:text-destructive">
              <LogOut className="h-3.5 w-3.5" />
              Esci
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-0.5 border-t border-border/50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">

          {activeTab === "accettazione" && <AccettazionePaziente />}

          {activeTab === "prenotazioni" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Gestione Prenotazioni</h1>
                <p className="text-muted-foreground text-sm">Visualizza tutte le prenotazioni del laboratorio.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Totale", value: bookings?.length ?? 0, color: "text-foreground" },
                  { label: "Oggi", value: todayBookings.length, color: "text-primary" },
                  { label: "Prossime", value: upcomingBookings.length, color: "text-blue-600" },
                  { label: "Passate", value: pastBookings.length, color: "text-muted-foreground" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                    <div className={`text-2xl font-bold ${stat.color}`}>
                      {isLoading ? <Skeleton className="h-8 w-10" /> : stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {error ? (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  Impossibile caricare le prenotazioni. Riprova.
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : bookings?.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nessuna prenotazione</p>
                  <p className="text-sm">Le prenotazioni effettuate dai pazienti appariranno qui.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {todayBookings.length > 0 && <Section title="Oggi" bookings={todayBookings} highlight />}
                  {upcomingBookings.length > 0 && <Section title="Prossime" bookings={upcomingBookings} />}
                  {pastBookings.length > 0 && <Section title="Passate" bookings={pastBookings} muted />}
                </div>
              )}
            </div>
          )}

          {activeTab === "listino" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Listino Esami</h1>
                <p className="text-muted-foreground text-sm">Gestisci il catalogo degli esami disponibili e i relativi prezzi.</p>
              </div>
              <AdminExams />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

type Booking = {
  id: number;
  examName: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string | null;
  status: string;
};

function Section({
  title,
  bookings,
  highlight,
  muted,
}: {
  title: string;
  bookings: Booking[];
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className={`text-sm font-semibold uppercase tracking-wider ${muted ? "text-muted-foreground" : highlight ? "text-primary" : "text-foreground"}`}>
          {title}
        </h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{bookings.length}</span>
      </div>
      <div className="space-y-2">
        {bookings.map((booking) => (
          <BookingRow key={booking.id} booking={booking} muted={muted} />
        ))}
      </div>
    </div>
  );
}

function BookingRow({ booking, muted }: { booking: Booking; muted?: boolean }) {
  const formattedDate = format(parseISO(booking.date), "d MMM yyyy", { locale: it });

  return (
    <div className={`rounded-lg border bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm truncate">
            {booking.firstName} {booking.lastName}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <FlaskConical className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{booking.examName}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="capitalize">{formattedDate}</span>
          <span className="font-medium text-foreground ml-1">{booking.time}</span>
        </div>
        <div className="flex items-center gap-1">
          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{booking.phone}</span>
        </div>
        {booking.notes && (
          <span className="italic truncate max-w-[180px]" title={booking.notes}>"{booking.notes}"</span>
        )}
        <StatusBadge status={booking.status} />
        <span className="text-muted-foreground/50 text-xs">#{booking.id}</span>
      </div>
    </div>
  );
}
