import React from "react";
import {
  useListPatients,
  useCreatePatient,
  useCreateBooking,
  useListExams,
  useListSlots,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  User,
  Plus,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  X,
  FlaskConical,
  CalendarDays,
  Clock,
  UserPlus,
} from "lucide-react";

type PatientData = {
  id?: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  notes?: string;
};

type Step = 1 | 2 | 3;

const STEP_LABELS = ["Paziente", "Esami", "Data e Ora"];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export function NuovaPrenotazioneDialog({ open, onClose, defaultDate }: Props) {
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState<Step>(1);
  const [patientSearch, setPatientSearch] = React.useState("");
  const [creatingNew, setCreatingNew] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState<PatientData | null>(null);
  const [newPatient, setNewPatient] = React.useState<PatientData>({
    firstName: "", lastName: "", dateOfBirth: "", email: "", phone: "", notes: "",
  });
  const [examSearch, setExamSearch] = React.useState("");
  const [selectedExamIds, setSelectedExamIds] = React.useState<number[]>([]);
  const [selectedDate, setSelectedDate] = React.useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const debouncedSearch = useDebounce(patientSearch, 300);

  const { data: patients } = useListPatients(
    { search: debouncedSearch },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: debouncedSearch.length >= 2 } as any }
  );

  const { data: exams } = useListExams();

  const { data: slots } = useListSlots(
    { date: selectedDate ?? "" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!selectedDate } as any }
  );

  const createPatient = useCreatePatient();
  const createBooking = useCreateBooking();

  const filteredExams = React.useMemo(() => {
    if (!exams) return [];
    const q = examSearch.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter(
      (e) =>
        e.descrizione.toLowerCase().includes(q) ||
        e.codiceAnalisi.toLowerCase().includes(q)
    );
  }, [exams, examSearch]);

  const selectedExams = React.useMemo(
    () => (exams ?? []).filter((e) => selectedExamIds.includes(e.id)),
    [exams, selectedExamIds]
  );

  const totalPrice = selectedExams.reduce(
    (sum, e) => sum + (e.importo ? Number(e.importo) : 0),
    0
  );

  const activePatient: PatientData | null = creatingNew
    ? newPatient
    : selectedPatient;

  const step1Valid = activePatient &&
    activePatient.firstName.trim() &&
    activePatient.lastName.trim() &&
    activePatient.dateOfBirth &&
    activePatient.email.trim() &&
    activePatient.phone.trim();

  const step2Valid = selectedExamIds.length > 0;
  const step3Valid = selectedDate && selectedTime;

  const handleReset = () => {
    setStep(1);
    setPatientSearch("");
    setCreatingNew(false);
    setSelectedPatient(null);
    setNewPatient({ firstName: "", lastName: "", dateOfBirth: "", email: "", phone: "", notes: "" });
    setExamSearch("");
    setSelectedExamIds([]);
    setSelectedDate(defaultDate ?? new Date().toISOString().slice(0, 10));
    setSelectedTime("");
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!activePatient || !step2Valid || !step3Valid) return;
    setSubmitting(true);
    setError(null);
    try {
      let patientData = activePatient;

      if (creatingNew) {
        const created = await createPatient.mutateAsync({
          data: {
            firstName: newPatient.firstName,
            lastName: newPatient.lastName,
            dateOfBirth: newPatient.dateOfBirth,
            email: newPatient.email,
            phone: newPatient.phone,
            notes: newPatient.notes || null,
          },
        });
        patientData = { ...created, dateOfBirth: created.dateOfBirth, notes: created.notes ?? "" };
        await queryClient.invalidateQueries({ queryKey: ["listPatients"] });
      }

      await createBooking.mutateAsync({
        data: {
          examIds: selectedExamIds,
          date: selectedDate,
          time: selectedTime,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          dateOfBirth: patientData.dateOfBirth,
          email: patientData.email,
          phone: patientData.phone,
          notes: notes || null,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["listBookings"] });
      handleClose();
    } catch {
      setError("Errore durante la creazione. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Nuova Prenotazione
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-2">
            {STEP_LABELS.map((label, i) => {
              const n = (i + 1) as Step;
              const active = step === n;
              const done = step > n;
              return (
                <React.Fragment key={n}>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done ? "bg-green-500 text-white" :
                      active ? "bg-primary text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 ${done ? "bg-green-500" : "bg-border"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {/* ─── STEP 1: PAZIENTE ─── */}
            {step === 1 && (
              <div className="space-y-4">
                {!creatingNew ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Cerca paziente per nome, email o telefono..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                    </div>

                    {selectedPatient && !patientSearch && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm text-primary">
                            {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                            <p className="text-xs text-muted-foreground">{selectedPatient.email} · {selectedPatient.phone}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedPatient(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    {debouncedSearch.length >= 2 && (
                      <div className="space-y-1">
                        {(patients ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-3">
                            Nessun paziente trovato per "{debouncedSearch}"
                          </p>
                        ) : (
                          patients?.map((p) => (
                            <button
                              key={p.id}
                              className={`w-full text-left rounded-lg border px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-muted ${
                                selectedPatient?.id === p.id ? "border-primary bg-primary/5" : "border-border"
                              }`}
                              onClick={() => {
                                setSelectedPatient({ id: p.id, firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, email: p.email, phone: p.phone, notes: p.notes ?? "" });
                                setPatientSearch("");
                              }}
                            >
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground flex-shrink-0">
                                {p.firstName[0]}{p.lastName[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{p.firstName} {p.lastName}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.dateOfBirth} · {p.phone}</p>
                              </div>
                              {selectedPatient?.id === p.id && <CheckCircle2 className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">oppure</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    <Button variant="outline" className="w-full gap-2" onClick={() => setCreatingNew(true)}>
                      <Plus className="h-4 w-4" />
                      Crea nuovo paziente
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">Nuovo paziente</p>
                      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setCreatingNew(false)}>
                        <Search className="h-3 w-3" />
                        Cerca esistente
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome *</Label>
                        <Input value={newPatient.firstName} onChange={(e) => setNewPatient((p) => ({ ...p, firstName: e.target.value }))} placeholder="Mario" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cognome *</Label>
                        <Input value={newPatient.lastName} onChange={(e) => setNewPatient((p) => ({ ...p, lastName: e.target.value }))} placeholder="Rossi" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data di nascita *</Label>
                      <Input type="date" value={newPatient.dateOfBirth} max={today} onChange={(e) => setNewPatient((p) => ({ ...p, dateOfBirth: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Email *</Label>
                        <Input type="email" value={newPatient.email} onChange={(e) => setNewPatient((p) => ({ ...p, email: e.target.value }))} placeholder="mario@email.it" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Telefono *</Label>
                        <Input value={newPatient.phone} onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))} placeholder="+39 333..." />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 2: ESAMI ─── */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Cerca esame per nome o codice..."
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>

                {selectedExamIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    {selectedExams.map((e) => (
                      <Badge key={e.id} variant="secondary" className="gap-1 pr-1 text-xs">
                        <span className="max-w-[160px] truncate">{e.descrizione}</span>
                        <button onClick={() => setSelectedExamIds((ids) => ids.filter((id) => id !== e.id))} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground self-center ml-auto">€ {totalPrice.toFixed(2)}</span>
                  </div>
                )}

                <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
                  {filteredExams.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nessun esame trovato.</p>
                  ) : filteredExams.map((exam) => {
                    const sel = selectedExamIds.includes(exam.id);
                    return (
                      <button
                        key={exam.id}
                        className={`w-full text-left rounded-lg border px-3 py-2 flex items-center gap-3 transition-colors ${
                          sel ? "border-primary bg-primary/5" : "border-border hover:border-border hover:bg-muted/40"
                        }`}
                        onClick={() => setSelectedExamIds((ids) => sel ? ids.filter((id) => id !== exam.id) : [...ids, exam.id])}
                      >
                        <div className={`h-4 w-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${sel ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {sel && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{exam.descrizione}</p>
                          <p className="text-xs text-muted-foreground">{exam.codiceAnalisi}</p>
                        </div>
                        {exam.importo && (
                          <span className="text-sm font-semibold text-primary flex-shrink-0">€ {Number(exam.importo).toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── STEP 3: DATA E ORA ─── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Data *</Label>
                  <Input
                    type="date"
                    min={today}
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(""); }}
                  />
                </div>

                {selectedDate && (
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Orario *</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {(slots ?? []).filter((s) => s.available).map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`rounded-md border py-1.5 text-sm font-medium transition-colors ${
                            selectedTime === slot.time
                              ? "border-primary bg-primary text-white"
                              : "border-border hover:border-primary/50 hover:bg-primary/5"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                      {selectedDate && (slots ?? []).filter((s) => s.available).length === 0 && (
                        <p className="col-span-4 text-xs text-muted-foreground text-center py-2">Nessuno slot disponibile per questa data.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Note aggiuntive</Label>
                  <Input
                    placeholder="A digiuno, allergie, ecc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Summary */}
                <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{activePatient?.firstName} {activePatient?.lastName}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">{selectedExams.map((e) => e.descrizione).join(", ")}</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border gap-2 shrink-0">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={submitting}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Indietro
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose} disabled={submitting} className="mr-auto">
            Annulla
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={
                (step === 1 && !step1Valid) ||
                (step === 2 && !step2Valid)
              }
            >
              Avanti
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!step3Valid || submitting}>
              {submitting ? "Salvataggio..." : "Conferma prenotazione"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
