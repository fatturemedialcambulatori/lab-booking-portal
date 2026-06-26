import React from "react";
import {
  useListPatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  CalendarDays,
  Users,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { parseFiscalCode } from "@/lib/fiscalCode";

type PatientForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  codiceFiscale: string;
  gender: "M" | "F" | "";
  email: string;
  phone: string;
  notes: string;
  billingAddress: string;
  billingCap: string;
  billingCity: string;
  billingProvincia: string;
};

const emptyForm = (): PatientForm => ({
  firstName: "", lastName: "", dateOfBirth: "", codiceFiscale: "", gender: "", email: "", phone: "", notes: "",
  billingAddress: "", billingCap: "", billingCity: "", billingProvincia: "",
});

function isFormValid(f: PatientForm) {
  return f.firstName.trim() && f.lastName.trim() && f.dateOfBirth && f.email.trim() && f.phone.trim();
}

const today = new Date().toISOString().slice(0, 10);

export function AdminAnagrafiche() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [editPatient, setEditPatient] = React.useState<{ id: number; form: PatientForm } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const { data: patients, isLoading, error, refetch } = useListPatients();

  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const deletePatient = useDeletePatient();

  const filtered = React.useMemo(() => {
    if (!patients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.includes(q)
    );
  }, [patients, search]);

  const handleCreate = async (form: PatientForm) => {
    setSaving(true);
    setFormError(null);
    try {
      await createPatient.mutateAsync({
        data: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          codiceFiscale: form.codiceFiscale.trim() || null,
          gender: form.gender || null,
          email: form.email.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || null,
          billingAddress: form.billingAddress.trim() || null,
          billingCap: form.billingCap.trim() || null,
          billingCity: form.billingCity.trim() || null,
          billingProvincia: form.billingProvincia.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["listPatients"] });
      setShowCreate(false);
    } catch {
      setFormError("Errore durante il salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: number, form: PatientForm) => {
    setSaving(true);
    setFormError(null);
    try {
      await updatePatient.mutateAsync({
        id,
        data: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          codiceFiscale: form.codiceFiscale.trim() || null,
          gender: form.gender || null,
          email: form.email.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || null,
          billingAddress: form.billingAddress.trim() || null,
          billingCap: form.billingCap.trim() || null,
          billingCity: form.billingCity.trim() || null,
          billingProvincia: form.billingProvincia.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["listPatients"] });
      setEditPatient(null);
    } catch {
      setFormError("Errore durante il salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePatient.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: ["listPatients"] });
      setDeleteConfirmId(null);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Anagrafiche Pazienti</h1>
          <p className="text-muted-foreground text-sm">
            Gestisci il registro pazienti: {patients?.length ?? 0} pazienti registrati.
          </p>
        </div>
        <Button onClick={() => { setShowCreate(true); setFormError(null); }} className="gap-2 shrink-0">
          <UserPlus className="h-4 w-4" />
          Nuovo Paziente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Cerca per nome, email o telefono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Impossibile caricare i pazienti.
          <button className="underline ml-1" onClick={() => refetch()}>Riprova</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "Nessun risultato" : "Nessun paziente registrato"}</p>
          <p className="text-sm">{search ? "Prova a cambiare i termini di ricerca." : "Aggiungi il primo paziente con il pulsante in alto."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border bg-card shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary flex-shrink-0">
                  {p.firstName[0]}{p.lastName[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {p.firstName} {p.lastName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Nato il {p.dateOfBirth}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {p.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {p.email}
                    </span>
                  </div>
                  {p.notes && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">"{p.notes}"</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-xs">#{p.id}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setEditPatient({
                      id: p.id,
                      form: {
                        firstName: p.firstName,
                        lastName: p.lastName,
                        dateOfBirth: p.dateOfBirth,
                        codiceFiscale: p.codiceFiscale ?? "",
                        gender: (p.gender as "M" | "F" | "") ?? "",
                        email: p.email,
                        phone: p.phone,
                        notes: p.notes ?? "",
                        billingAddress: p.billingAddress ?? "",
                        billingCap: p.billingCap ?? "",
                        billingCity: p.billingCity ?? "",
                        billingProvincia: p.billingProvincia ?? "",
                      },
                    });
                    setFormError(null);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setDeleteConfirmId(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── CREATE DIALOG ─── */}
      <PatientFormDialog
        open={showCreate}
        title="Nuovo Paziente"
        form={emptyForm()}
        error={formError}
        saving={saving}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />

      {/* ─── EDIT DIALOG ─── */}
      {editPatient && (
        <PatientFormDialog
          open={true}
          title="Modifica Paziente"
          form={editPatient.form}
          error={formError}
          saving={saving}
          onClose={() => setEditPatient(null)}
          onSave={(form) => handleUpdate(editPatient.id, form)}
        />
      )}

      {/* ─── DELETE CONFIRM ─── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Elimina paziente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Sei sicuro di voler eliminare questo paziente dall'anagrafica? L'operazione non può essere annullata.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Annulla</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId !== null && handleDelete(deleteConfirmId)}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientFormDialog({
  open,
  title,
  form: initialForm,
  error,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  form: PatientForm;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: PatientForm) => void;
}) {
  const [form, setForm] = React.useState<PatientForm>(initialForm);

  React.useEffect(() => {
    if (open) setForm(initialForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof PatientForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const cfInfo = React.useMemo(() => parseFiscalCode(form.codiceFiscale), [form.codiceFiscale]);

  React.useEffect(() => {
    if (cfInfo) {
      setForm((f) => ({
        ...f,
        ...(f.dateOfBirth ? {} : { dateOfBirth: cfInfo.dateOfBirth }),
        gender: cfInfo.gender,
      }));
    }
  }, [cfInfo]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Dati anagrafici */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dati anagrafici</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.firstName} onChange={set("firstName")} placeholder="Mario" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cognome *</Label>
                <Input value={form.lastName} onChange={set("lastName")} placeholder="Rossi" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Codice Fiscale</Label>
              <Input
                value={form.codiceFiscale}
                onChange={(e) => setForm((f) => ({ ...f, codiceFiscale: e.target.value.toUpperCase() }))}
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
                <Input type="date" value={form.dateOfBirth} max={today} onChange={set("dateOfBirth")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sesso</Label>
                <div className="flex gap-1.5">
                  {(["M", "F"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, gender: f.gender === v ? "" : v }))}
                      className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                        form.gender === v
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {v === "M" ? "M — Maschio" : "F — Femmina"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="mario@email.it" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefono *</Label>
                <Input value={form.phone} onChange={set("phone")} placeholder="+39 333..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input value={form.notes} onChange={set("notes")} placeholder="Allergie, annotazioni, ecc." />
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Indirizzo di fatturazione */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indirizzo di fatturazione</p>
            <div className="space-y-1">
              <Label className="text-xs">Via / Indirizzo</Label>
              <Input value={form.billingAddress} onChange={set("billingAddress")} placeholder="Via Roma 12" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CAP</Label>
                <Input value={form.billingCap} onChange={set("billingCap")} placeholder="00100" maxLength={5} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Città</Label>
                <Input value={form.billingCity} onChange={set("billingCity")} placeholder="Roma" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prov.</Label>
                <Input
                  value={form.billingProvincia}
                  onChange={(e) => setForm((f) => ({ ...f, billingProvincia: e.target.value.toUpperCase() }))}
                  placeholder="RM"
                  maxLength={2}
                  className="uppercase"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={() => onSave(form)} disabled={!isFormValid(form) || saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
