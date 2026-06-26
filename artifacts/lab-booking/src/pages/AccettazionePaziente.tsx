import React from "react";
import { useListBookings, useUpdateBookingStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { it } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  FlaskConical,
  Phone,
  Mail,
  CalendarDays,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
} from "lucide-react";
import { format as formatDate, addDays, subDays } from "date-fns";
import { NuovaPrenotazioneDialog } from "@/components/NuovaPrenotazioneDialog";

type BookingStatus = "confirmed" | "pending" | "accepted" | "completed" | "cancelled";

type Booking = {
  id: number;
  examId: number;
  examName: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  notes?: string | null;
  status: string;
};

type Visit = {
  key: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  notes?: string | null;
  bookings: Booking[];
  status: BookingStatus;
};

function groupIntoVisits(bookings: Booking[]): Visit[] {
  const map = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = `${b.firstName}|${b.lastName}|${b.date}|${b.time}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  const visits: Visit[] = [];
  map.forEach((bks, key) => {
    const first = bks[0];
    visits.push({
      key,
      date: first.date,
      time: first.time,
      firstName: first.firstName,
      lastName: first.lastName,
      dateOfBirth: first.dateOfBirth,
      email: first.email,
      phone: first.phone,
      notes: first.notes,
      bookings: bks.sort((a, b) => a.examName.localeCompare(b.examName)),
      status: first.status as BookingStatus,
    });
  });
  return visits.sort((a, b) => a.time.localeCompare(b.time));
}

function visitStatus(visit: Visit): BookingStatus {
  const statuses = visit.bookings.map((b) => b.status);
  if (statuses.every((s) => s === "completed")) return "completed";
  if (statuses.every((s) => s === "cancelled")) return "cancelled";
  if (statuses.some((s) => s === "accepted")) return "accepted";
  return (statuses[0] ?? "confirmed") as BookingStatus;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "accepted":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 gap-1"><UserCheck className="h-3 w-3" />Accettato</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1"><CheckCircle2 className="h-3 w-3" />Completato</Badge>;
    case "cancelled":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Annullato</Badge>;
    case "confirmed":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1"><Clock className="h-3 w-3" />Da accettare</Badge>;
    default:
      return <Badge variant="secondary">In attesa</Badge>;
  }
}

function DateLabel({ date }: { date: string }) {
  try {
    const d = parseISO(date);
    if (isToday(d)) return <span className="text-primary font-semibold">Oggi</span>;
    if (isTomorrow(d)) return <span className="text-blue-600">Domani</span>;
    return <span>{format(d, "d MMMM yyyy", { locale: it })}</span>;
  } catch {
    return <span>{date}</span>;
  }
}

type FilterId = "all" | "confirmed" | "accepted" | "completed" | "cancelled";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "confirmed", label: "Da accettare" },
  { id: "accepted", label: "Accettati" },
  { id: "completed", label: "Completati" },
  { id: "cancelled", label: "Annullati" },
];

export function AccettazionePaziente() {
  const queryClient = useQueryClient();
  const { data: allBookings, isLoading, error, refetch } = useListBookings();
  const statusMutation = useUpdateBookingStatus();

  const [selectedDate, setSelectedDate] = React.useState<string>(
    formatDate(new Date(), "yyyy-MM-dd")
  );
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<FilterId>("all");
  const [loadingVisitKey, setLoadingVisitKey] = React.useState<string | null>(null);
  const [showNuovaPrenotazione, setShowNuovaPrenotazione] = React.useState(false);

  const todayStr = formatDate(new Date(), "yyyy-MM-dd");

  const dayBookings = React.useMemo(() => {
    if (!allBookings) return [];
    return allBookings.filter((b) => b.date === selectedDate);
  }, [allBookings, selectedDate]);

  const visits = React.useMemo(() => {
    const grouped = groupIntoVisits(dayBookings);
    return grouped.map((v) => ({ ...v, status: visitStatus(v) }));
  }, [dayBookings]);

  const filtered = React.useMemo(() => {
    let result = visits;
    if (filter !== "all") {
      result = result.filter((v) => v.status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (v) =>
          `${v.firstName} ${v.lastName}`.toLowerCase().includes(q) ||
          v.phone.includes(q) ||
          v.bookings.some((b) => b.examName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [visits, filter, search]);

  const counts = React.useMemo(() => ({
    confirmed: visits.filter((v) => v.status === "confirmed").length,
    accepted: visits.filter((v) => v.status === "accepted").length,
    completed: visits.filter((v) => v.status === "completed").length,
    cancelled: visits.filter((v) => v.status === "cancelled").length,
  }), [visits]);

  const updateVisitStatus = async (visit: Visit, newStatus: BookingStatus) => {
    setLoadingVisitKey(visit.key);
    try {
      await Promise.all(
        visit.bookings.map((b) =>
          statusMutation.mutateAsync({ id: b.id, data: { status: newStatus } })
        )
      );
      await refetch();
    } finally {
      setLoadingVisitKey(null);
    }
  };

  const prevDay = () => setSelectedDate(formatDate(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"));
  const nextDay = () => setSelectedDate(formatDate(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Accettazione Pazienti</h1>
          <p className="text-muted-foreground text-sm">Gestisci l'arrivo e l'accettazione dei pazienti.</p>
        </div>

        <Button onClick={() => setShowNuovaPrenotazione(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nuova Prenotazione
        </Button>

        {/* Date navigator */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1 border border-border">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center px-2 min-w-[140px]">
            <p className="text-sm font-semibold capitalize">
              <DateLabel date={selectedDate} />
            </p>
            <p className="text-xs text-muted-foreground">{format(parseISO(selectedDate), "EEEE d MMM", { locale: it })}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {selectedDate !== todayStr && (
            <Button variant="ghost" size="sm" className="text-xs h-8 ml-1" onClick={() => setSelectedDate(todayStr)}>
              Oggi
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Da accettare", value: counts.confirmed, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
          { label: "Accettati", value: counts.accepted, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Completati", value: counts.completed, color: "text-green-600", bg: "bg-green-50 border-green-200" },
          { label: "Annullati", value: counts.cancelled, color: "text-red-500", bg: "bg-red-50 border-red-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border px-4 py-3 ${s.bg}`}>
            <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>
              {isLoading ? <Skeleton className="h-7 w-8" /> : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cerca paziente, telefono o esame..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1 border border-border flex-shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f.id
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {f.id !== "all" && counts[f.id as keyof typeof counts] > 0 && (
                <span className="ml-1 text-muted-foreground">({counts[f.id as keyof typeof counts]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Impossibile caricare le prenotazioni. Riprova.
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nessun paziente trovato</p>
          <p className="text-sm">
            {visits.length === 0
              ? "Non ci sono prenotazioni per questa giornata."
              : "Nessun risultato per la ricerca o il filtro selezionato."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((visit) => (
            <VisitCard
              key={visit.key}
              visit={visit}
              isLoading={loadingVisitKey === visit.key}
              onUpdateStatus={updateVisitStatus}
            />
          ))}
        </div>
      )}

      <NuovaPrenotazioneDialog
        open={showNuovaPrenotazione}
        defaultDate={selectedDate}
        onClose={() => {
          setShowNuovaPrenotazione(false);
          refetch();
        }}
      />
    </div>
  );
}

function VisitCard({
  visit,
  isLoading,
  onUpdateStatus,
}: {
  visit: Visit;
  isLoading: boolean;
  onUpdateStatus: (visit: Visit, status: BookingStatus) => void;
}) {
  const totalPrice = 0; // could sum from exam data if available

  const statusColors: Record<string, string> = {
    confirmed: "border-l-amber-400",
    accepted: "border-l-blue-400",
    completed: "border-l-green-400",
    cancelled: "border-l-red-300",
  };

  const borderColor = statusColors[visit.status] ?? "border-l-border";

  return (
    <div className={`rounded-xl border bg-card border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
      <div className="px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Patient info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm ${
              visit.status === "completed" ? "bg-green-500" :
              visit.status === "accepted" ? "bg-blue-500" :
              visit.status === "cancelled" ? "bg-red-400" : "bg-amber-500"
            }`}>
              {visit.firstName[0]}{visit.lastName[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground text-base">
                  {visit.firstName} {visit.lastName}
                </h3>
                <StatusBadge status={visit.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Nato il {format(parseISO(visit.dateOfBirth), "d MMM yyyy", { locale: it })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <strong className="text-foreground">{visit.time}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {visit.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {visit.email}
                </span>
              </div>
              {visit.notes && (
                <p className="mt-1 text-xs text-muted-foreground italic">
                  Note: "{visit.notes}"
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 self-start">
            {visit.status === "confirmed" && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                disabled={isLoading}
                onClick={() => onUpdateStatus(visit, "accepted")}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Accetta
              </Button>
            )}
            {visit.status === "accepted" && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  disabled={isLoading}
                  onClick={() => onUpdateStatus(visit, "completed")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                  disabled={isLoading}
                  onClick={() => onUpdateStatus(visit, "cancelled")}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Annulla
                </Button>
              </>
            )}
            {visit.status === "completed" && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Esami eseguiti
              </span>
            )}
            {visit.status === "confirmed" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive gap-1"
                disabled={isLoading}
                onClick={() => onUpdateStatus(visit, "cancelled")}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Exams list */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Esami prenotati ({visit.bookings.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {visit.bookings.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-md px-2.5 py-1.5 border border-border"
              >
                <FlaskConical className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="font-medium">{b.examName}</span>
                <span className="text-muted-foreground">#{b.id}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
