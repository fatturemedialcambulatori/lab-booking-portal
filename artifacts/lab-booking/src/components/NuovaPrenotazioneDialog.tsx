import React from "react";
import {
  useListPatients,
  useCreatePatient,
  useCreateBooking,
  useListExams,
  useListSlots,
  getListPatientsQueryKey,
  getListBookingsQueryKey,
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
  UserCheck,
  Printer,
  FileText,
  Stethoscope,
} from "lucide-react";
import { parseFiscalCode } from "@/lib/fiscalCode";
import { printPreventivo, printSchedaLaboratorio } from "@/lib/printDocs";

type PatientData = {
  id?: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  codiceFiscale?: string;
  gender?: "M" | "F";
  email: string;
  phone: string;
  notes?: string;
  billingAddress?: string;
  billingCap?: string;
  billingCity?: string;
  billingProvincia?: string;
};

type PrestazioneSettings = {
  id: string;
  nome: string;
  specialita: string;
  durata?: number;
  attiva?: boolean;
};

type MedicoSettings = {
  id: string;
  nome: string;
  specialita: string;
};

type ListinoSettings = {
  id?: string;
  medicoId: string;
  prestazioneId?: string;
  durata?: number;
  prezzo?: number | string;
};

type AdminSettingsData = {
  prestazioni?: PrestazioneSettings[];
  medici?: MedicoSettings[];
  listini?: ListinoSettings[];
};

type Step = 1 | 2 | 3;

const STEP_LABELS = ["Paziente", "Esami e prestazioni", "Data e Ora"];
const SEDI_AMBULATORIO = [
  { id: "modena", label: "Modena" },
  { id: "sassuolo", label: "Sassuolo" },
] as const;

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
    firstName: "", lastName: "", dateOfBirth: "", codiceFiscale: "", gender: undefined, email: "", phone: "", notes: "",
    billingAddress: "", billingCap: "", billingCity: "", billingProvincia: "",
  });
  const [examSearch, setExamSearch] = React.useState("");
  const [selectedExamIds, setSelectedExamIds] = React.useState<number[]>([]);
  const [selectedDate, setSelectedDate] = React.useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [prestazioneSearch, setPrestazioneSearch] = React.useState("");
  const [selectedPrestazioneId, setSelectedPrestazioneId] = React.useState("");
  const [selectedMedicoId, setSelectedMedicoId] = React.useState("");
  const [selectedSede, setSelectedSede] = React.useState<(typeof SEDI_AMBULATORIO)[number]["id"]>("modena");
  const [durataPrestazione, setDurataPrestazione] = React.useState("30");
  const [settingsData, setSettingsData] = React.useState<AdminSettingsData | null>(null);
  const [settingsLoading, setSettingsLoading] = React.useState(false);
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

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    const loadSettings = async () => {
      setSettingsLoading(true);
      try {
        const response = await fetch("/api/admin-settings");
        if (!response.ok) throw new Error("Impostazioni non disponibili");
        const data: unknown = await response.json();
        if (!active) return;
        setSettingsData(data && typeof data === "object" ? (data as AdminSettingsData) : null);
      } catch {
        if (active) setSettingsData(null);
      } finally {
        if (active) setSettingsLoading(false);
      }
    };

    void loadSettings();
    return () => {
      active = false;
    };
  }, [open]);

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

  const prestazioni = React.useMemo(
    () => (settingsData?.prestazioni ?? []).filter((prestazione) => prestazione.attiva !== false),
    [settingsData?.prestazioni],
  );

  const medici = React.useMemo(
    () => settingsData?.medici ?? [],
    [settingsData?.medici],
  );

  const listini = React.useMemo(
    () => settingsData?.listini ?? [],
    [settingsData?.listini],
  );

  const selectedPrestazione = React.useMemo(
    () => prestazioni.find((prestazione) => prestazione.id === selectedPrestazioneId) ?? null,
    [prestazioni, selectedPrestazioneId],
  );

  const listiniPrestazione = React.useMemo(
    () => listini.filter((listino) => listino.prestazioneId === selectedPrestazioneId),
    [listini, selectedPrestazioneId],
  );

  const mediciPrestazione = React.useMemo(() => {
    if (!selectedPrestazione) return [];
    const mediciDaListino = listiniPrestazione
      .map((listino) => medici.find((medico) => medico.id === listino.medicoId))
      .filter((medico): medico is MedicoSettings => Boolean(medico));
    const base = mediciDaListino.length > 0
      ? mediciDaListino
      : medici.filter((medico) => medico.specialita === selectedPrestazione.specialita);
    return Array.from(new Map(base.map((medico) => [medico.id, medico])).values());
  }, [listiniPrestazione, medici, selectedPrestazione]);

  const selectedMedico = React.useMemo(
    () => medici.find((medico) => medico.id === selectedMedicoId) ?? null,
    [medici, selectedMedicoId],
  );

  const selectedListino = React.useMemo(
    () => listiniPrestazione.find((listino) => listino.medicoId === selectedMedicoId) ?? null,
    [listiniPrestazione, selectedMedicoId],
  );

  const filteredPrestazioni = React.useMemo(() => {
    const q = prestazioneSearch.trim().toLowerCase();
    if (!q) return prestazioni.slice(0, 18);
    return prestazioni
      .filter((prestazione) =>
        [prestazione.nome, prestazione.specialita].some((campo) => campo.toLowerCase().includes(q)),
      )
      .slice(0, 18);
  }, [prestazioneSearch, prestazioni]);

  React.useEffect(() => {
    if (!selectedPrestazione) {
      setSelectedMedicoId("");
      setDurataPrestazione("30");
      return;
    }

    const medicoAncoraValido = mediciPrestazione.some((medico) => medico.id === selectedMedicoId);
    const prossimoMedico = medicoAncoraValido ? selectedMedicoId : mediciPrestazione[0]?.id ?? "";
    const prossimoListino = listiniPrestazione.find((listino) => listino.medicoId === prossimoMedico);
    setSelectedMedicoId(prossimoMedico);
    setDurataPrestazione(String(prossimoListino?.durata ?? selectedPrestazione.durata ?? 30));
  }, [listiniPrestazione, mediciPrestazione, selectedMedicoId, selectedPrestazione]);

  const examTotal = selectedExams.reduce(
    (sum, e) => sum + (e.importo ? Number(e.importo) : 0),
    0
  );
  const prestazioneTotal = selectedListino?.prezzo ? Number(selectedListino.prezzo) : 0;
  const totalPrice = examTotal + prestazioneTotal;

  const activePatient: PatientData | null = creatingNew
    ? newPatient
    : selectedPatient;

  const step1Valid = activePatient &&
    activePatient.firstName.trim() &&
    activePatient.lastName.trim() &&
    activePatient.dateOfBirth &&
    activePatient.email.trim() &&
    activePatient.phone.trim();

  const step2Valid = selectedExamIds.length > 0 || Boolean(selectedPrestazione && selectedMedicoId);
  const step3Valid = selectedDate && selectedTime && step2Valid;

  const handleReset = () => {
    setStep(1);
    setPatientSearch("");
    setCreatingNew(false);
    setSelectedPatient(null);
    setNewPatient({ firstName: "", lastName: "", dateOfBirth: "", codiceFiscale: "", gender: undefined, email: "", phone: "", notes: "", billingAddress: "", billingCap: "", billingCity: "", billingProvincia: "" });
    setExamSearch("");
    setSelectedExamIds([]);
    setPrestazioneSearch("");
    setSelectedPrestazioneId("");
    setSelectedMedicoId("");
    setSelectedSede("modena");
    setDurataPrestazione("30");
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
            codiceFiscale: newPatient.codiceFiscale || null,
            gender: newPatient.gender || null,
            email: newPatient.email,
            phone: newPatient.phone,
            notes: newPatient.notes || null,
            billingAddress: newPatient.billingAddress || null,
            billingCap: newPatient.billingCap || null,
            billingCity: newPatient.billingCity || null,
            billingProvincia: newPatient.billingProvincia || null,
          },
        });
        patientData = {
          ...created,
          dateOfBirth: created.dateOfBirth,
          codiceFiscale: created.codiceFiscale ?? "",
          gender: (created.gender as "M" | "F" | undefined) ?? undefined,
          notes: created.notes ?? "",
          billingAddress: created.billingAddress ?? undefined,
          billingCap: created.billingCap ?? undefined,
          billingCity: created.billingCity ?? undefined,
          billingProvincia: created.billingProvincia ?? undefined,
        };
        await queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      }

      let labBookingId: number | null = null;

      if (selectedExamIds.length > 0) {
        const labBooking = await createBooking.mutateAsync({
          data: {
            examIds: selectedExamIds,
            date: selectedDate,
            time: selectedTime,
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            dateOfBirth: patientData.dateOfBirth,
            codiceFiscale: patientData.codiceFiscale || null,
            gender: patientData.gender || null,
            email: patientData.email,
            phone: patientData.phone,
            notes: [
              selectedPrestazione && selectedMedico
                ? `Agenda ambulatorio: ${selectedMedico.nome} - ${selectedPrestazione.nome}`
                : "Accettazione laboratorio da segreteria",
              notes,
            ].filter(Boolean).join(" | ") || null,
          },
        });
        labBookingId = labBooking.id;

        const acceptResponse = await fetch(`/api/bookings/${labBooking.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "accepted" }),
        });
        if (!acceptResponse.ok) {
          throw new Error("Accettazione laboratorio creata ma non marcata come accettata.");
        }
      }

      if (selectedPrestazione && selectedMedico) {
        const appointment = {
          id: `frontoffice-${Date.now()}`,
          area: "ambulatorio",
          sede: selectedSede,
          medicoId: selectedMedico.id,
          pazienteId: patientData.id,
          paziente: `${patientData.firstName} ${patientData.lastName}`.trim(),
          pazienteEmail: patientData.email,
          pazienteTelefono: patientData.phone,
          prestazione: selectedPrestazione.nome,
          labExamIds: selectedExamIds,
          labBookingId,
          note: [
            notes,
            labBookingId ? `Accettazione laboratorio #${labBookingId}` : "",
          ].filter(Boolean).join(" | ") || undefined,
          data: selectedDate,
          ora: selectedTime,
          durata: Math.max(5, Number(durataPrestazione) || selectedPrestazione.durata || 30),
          stato: "accettata",
          overbooking: false,
        };

        const response = await fetch("/api/agenda-appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appointment),
        });

        if (!response.ok) {
          throw new Error("Accettazione ambulatorio non salvata. Verifica la route agenda.");
        }
      }

      await queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la creazione. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="!w-[calc(100vw-2rem)] !max-w-5xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0 [&>*]:max-w-3xl [&>*]:mx-auto">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Nuova accettazione
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
          <div className="px-6 py-6 space-y-4 max-w-3xl mx-auto">
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
                                setSelectedPatient({ id: p.id, firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, codiceFiscale: p.codiceFiscale ?? "", gender: (p.gender as "M" | "F" | undefined) ?? undefined, email: p.email, phone: p.phone, notes: p.notes ?? "" });
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
                    <NewPatientCFAndDob newPatient={newPatient} setNewPatient={setNewPatient} today={today} />
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

                    {/* Fatturazione */}
                    <div className="border-t border-border pt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indirizzo di fatturazione</p>
                      <div className="space-y-1">
                        <Label className="text-xs">Via / Indirizzo</Label>
                        <Input value={newPatient.billingAddress ?? ""} onChange={(e) => setNewPatient((p) => ({ ...p, billingAddress: e.target.value }))} placeholder="Via Roma 12" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">CAP</Label>
                          <Input value={newPatient.billingCap ?? ""} onChange={(e) => setNewPatient((p) => ({ ...p, billingCap: e.target.value }))} placeholder="00100" maxLength={5} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Città</Label>
                          <Input value={newPatient.billingCity ?? ""} onChange={(e) => setNewPatient((p) => ({ ...p, billingCity: e.target.value }))} placeholder="Roma" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prov.</Label>
                          <Input value={newPatient.billingProvincia ?? ""} onChange={(e) => setNewPatient((p) => ({ ...p, billingProvincia: e.target.value.toUpperCase() }))} placeholder="RM" maxLength={2} className="uppercase" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 2: ESAMI + PRESTAZIONI ─── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        Esami laboratorio
                      </p>
                      <p className="text-xs text-muted-foreground">Seleziona uno o più esami da inviare al laboratorio.</p>
                    </div>
                    {selectedExamIds.length > 0 && <Badge variant="secondary">{selectedExamIds.length} esami</Badge>}
                  </div>

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
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
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

                  {selectedExamIds.length > 0 && activePatient && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Printer className="h-3.5 w-3.5" />
                        Stampa / Esporta PDF
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs"
                          onClick={() => printPreventivo(activePatient, selectedExams)}
                        >
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          Preventivo Paziente
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs"
                          onClick={() => printSchedaLaboratorio(activePatient, selectedExams)}
                        >
                          <FlaskConical className="h-3.5 w-3.5 text-primary" />
                          Scheda Laboratorio
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        Prestazione ambulatorio
                      </p>
                      <p className="text-xs text-muted-foreground">Seleziona una prestazione da inviare all'agenda ambulatorio.</p>
                    </div>
                    {selectedPrestazione && <Badge variant="secondary">Ambulatorio</Badge>}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Cerca prestazione per nome o specialità..."
                      value={prestazioneSearch}
                      onChange={(e) => setPrestazioneSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {settingsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Caricamento prestazioni...</p>
                  ) : filteredPrestazioni.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nessuna prestazione trovata nelle impostazioni.
                    </p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                      {filteredPrestazioni.map((prestazione) => {
                        const sel = selectedPrestazioneId === prestazione.id;
                        return (
                          <button
                            key={prestazione.id}
                            className={`w-full text-left rounded-lg border px-3 py-2 flex items-center gap-3 transition-colors ${
                              sel ? "border-primary bg-primary/5" : "border-border hover:border-border hover:bg-muted/40"
                            }`}
                            onClick={() => setSelectedPrestazioneId(sel ? "" : prestazione.id)}
                          >
                            <div className={`h-4 w-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${sel ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                              {sel && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{prestazione.nome}</p>
                              <p className="text-xs text-muted-foreground">{prestazione.specialita} · {prestazione.durata ?? 30} min</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedPrestazione && (
                    <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                      <div className="space-y-1 sm:col-span-1">
                        <Label className="text-xs">Medico *</Label>
                        <select
                          value={selectedMedicoId}
                          onChange={(e) => setSelectedMedicoId(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          {mediciPrestazione.length === 0 ? (
                            <option value="">Nessun medico collegato</option>
                          ) : (
                            mediciPrestazione.map((medico) => (
                              <option key={medico.id} value={medico.id}>
                                {medico.nome}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Sede *</Label>
                        <select
                          value={selectedSede}
                          onChange={(e) => setSelectedSede(e.target.value as typeof selectedSede)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          {SEDI_AMBULATORIO.map((sede) => (
                            <option key={sede.id} value={sede.id}>{sede.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Durata *</Label>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={durataPrestazione}
                          onChange={(e) => setDurataPrestazione(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Totale selezionato: {selectedExamIds.length} esami
                    {selectedPrestazione ? ` + ${selectedPrestazione.nome}` : ""}
                  </span>
                  <span className="font-semibold text-primary">€ {totalPrice.toFixed(2)}</span>
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
                    <span className="text-muted-foreground">
                      {selectedExams.length > 0 ? selectedExams.map((e) => e.descrizione).join(", ") : "Nessun esame laboratorio"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Stethoscope className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">
                      {selectedPrestazione
                        ? `${selectedPrestazione.nome}${selectedMedico ? ` · ${selectedMedico.nome}` : ""} · ${selectedSede === "modena" ? "Modena" : "Sassuolo"}`
                        : "Nessuna prestazione ambulatorio"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border gap-2 shrink-0 max-w-3xl mx-auto w-full">
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
              {submitting ? "Salvataggio..." : "Conferma accettazione"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PatientDataSetter = React.Dispatch<React.SetStateAction<PatientData>>;

function NewPatientCFAndDob({
  newPatient,
  setNewPatient,
  today,
}: {
  newPatient: PatientData;
  setNewPatient: PatientDataSetter;
  today: string;
}) {
  const cfInfo = React.useMemo(
    () => parseFiscalCode(newPatient.codiceFiscale ?? ""),
    [newPatient.codiceFiscale]
  );

  React.useEffect(() => {
    if (cfInfo) {
      setNewPatient((p) => ({
        ...p,
        ...(p.dateOfBirth ? {} : { dateOfBirth: cfInfo.dateOfBirth }),
        gender: cfInfo.gender,
      }));
    }
  }, [cfInfo, setNewPatient]);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Codice Fiscale</Label>
        <Input
          value={newPatient.codiceFiscale ?? ""}
          onChange={(e) =>
            setNewPatient((p) => ({ ...p, codiceFiscale: e.target.value.toUpperCase() }))
          }
          placeholder="RSSMRA85M01H501Z"
          className="uppercase"
          maxLength={16}
        />
        {cfInfo && (
          <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/8 rounded-md px-2.5 py-1.5">
            <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {cfInfo.gender === "M" ? "Uomo" : "Donna"} · {cfInfo.age} anni · nato/a il{" "}
              {cfInfo.dateOfBirth.split("-").reverse().join("/")}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Data di nascita *</Label>
          <Input
            type="date"
            value={newPatient.dateOfBirth}
            max={today}
            onChange={(e) => setNewPatient((p) => ({ ...p, dateOfBirth: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sesso</Label>
          <div className="flex gap-1.5">
            {(["M", "F"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setNewPatient((p) => ({ ...p, gender: p.gender === v ? undefined : v }))}
                className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                  newPatient.gender === v
                    ? "border-primary bg-primary text-white"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {v === "M" ? "M" : "F"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
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
