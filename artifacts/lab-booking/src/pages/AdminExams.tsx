import React from "react";
import {
  useListExams,
  useCreateExam,
  useUpdateExam,
  useDeleteExam,
} from "@workspace/api-client-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, FlaskConical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type RefType, buildRefString, parseRefValue, REF_TYPE_LABELS } from "@/lib/refValue";

type Exam = {
  id: number;
  codiceAnalisi: string;
  descrizione: string;
  colorProvetta?: string | null;
  synlab: boolean;
  um?: string | null;
  metodo?: string | null;
  regola?: string | null;
  importo?: string | null;
  valoreRiferimento?: string | null;
  preparationInstructions: string;
};

const EMPTY_FORM = {
  codiceAnalisi: "",
  descrizione: "",
  colorProvetta: "",
  synlab: false,
  um: "",
  metodo: "",
  regola: "",
  importo: "",
  refType: "" as RefType,
  refMin: "",
  refMax: "",
  refSingle: "",
  preparationInstructions: "",
};

function ExamForm({
  value,
  onChange,
}: {
  value: typeof EMPTY_FORM;
  onChange: (v: typeof EMPTY_FORM) => void;
}) {
  const set = (k: keyof typeof EMPTY_FORM, v: string | boolean) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="grid gap-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Codice Analisi *</Label>
          <Input value={value.codiceAnalisi} onChange={(e) => set("codiceAnalisi", e.target.value)} placeholder="ES-001" />
        </div>
        <div className="space-y-1">
          <Label>Importo (€)</Label>
          <Input value={value.importo} onChange={(e) => set("importo", e.target.value)} placeholder="0.00" type="number" step="0.01" min="0" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Descrizione *</Label>
        <Input value={value.descrizione} onChange={(e) => set("descrizione", e.target.value)} placeholder="Nome dell'esame" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Colore Provetta</Label>
          <Input value={value.colorProvetta} onChange={(e) => set("colorProvetta", e.target.value)} placeholder="es. GIALLO" />
        </div>
        <div className="space-y-1">
          <Label>U.M.</Label>
          <Input value={value.um} onChange={(e) => set("um", e.target.value)} placeholder="es. mg/dL" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Metodo</Label>
          <Input value={value.metodo} onChange={(e) => set("metodo", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Regola</Label>
          <Input value={value.regola} onChange={(e) => set("regola", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Valore di riferimento</Label>
        <Select
          value={value.refType || "__none__"}
          onValueChange={(v) => set("refType", (v === "__none__" ? "" : v) as RefType)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Nessuno" />
          </SelectTrigger>
          <SelectContent>
            {REF_TYPE_LABELS.map((r) => (
              <SelectItem key={r.value || "__none__"} value={r.value || "__none__"}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.refType === "range" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Minimo</Label>
              <Input
                value={value.refMin}
                onChange={(e) => set("refMin", e.target.value)}
                placeholder="es. 70"
                type="number"
                step="any"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Massimo</Label>
              <Input
                value={value.refMax}
                onChange={(e) => set("refMax", e.target.value)}
                placeholder="es. 100"
                type="number"
                step="any"
              />
            </div>
          </div>
        )}
        {value.refType && value.refType !== "range" && (
          <Input
            value={value.refSingle}
            onChange={(e) => set("refSingle", e.target.value)}
            placeholder="Valore numerico"
            type="number"
            step="any"
          />
        )}
      </div>

      <div className="space-y-1">
        <Label>Istruzioni preparazione</Label>
        <Input value={value.preparationInstructions} onChange={(e) => set("preparationInstructions", e.target.value)} placeholder="es. Digiuno di 8 ore" />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="synlab"
          type="checkbox"
          checked={value.synlab}
          onChange={(e) => set("synlab", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 accent-primary"
        />
        <Label htmlFor="synlab" className="cursor-pointer">Synlab</Label>
      </div>
    </div>
  );
}

export function AdminExams() {
  const { data: exams, isLoading, refetch } = useListExams();
  const createMutation = useCreateExam();
  const updateMutation = useUpdateExam();
  const deleteMutation = useDeleteExam();

  const [search, setSearch] = React.useState("");
  const [editExam, setEditExam] = React.useState<Exam | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Exam | null>(null);
  const [formValues, setFormValues] = React.useState(EMPTY_FORM);
  const [formError, setFormError] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!exams) return [];
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter(
      (e) =>
        e.descrizione.toLowerCase().includes(q) ||
        e.codiceAnalisi.toLowerCase().includes(q)
    );
  }, [exams, search]);

  const openCreate = () => {
    setFormValues(EMPTY_FORM);
    setFormError("");
    setIsCreating(true);
  };

  const openEdit = (exam: Exam) => {
    const ref = parseRefValue(exam.valoreRiferimento);
    setFormValues({
      codiceAnalisi: exam.codiceAnalisi,
      descrizione: exam.descrizione,
      colorProvetta: exam.colorProvetta ?? "",
      synlab: exam.synlab,
      um: exam.um ?? "",
      metodo: exam.metodo ?? "",
      regola: exam.regola ?? "",
      importo: exam.importo ?? "",
      refType: ref.type,
      refMin: ref.min != null ? String(ref.min) : "",
      refMax: ref.max != null ? String(ref.max) : "",
      refSingle: ref.value != null ? String(ref.value) : "",
      preparationInstructions: exam.preparationInstructions,
    });
    setFormError("");
    setEditExam(exam);
  };

  const toNull = (s: string) => s.trim() || null;

  const handleCreate = () => {
    if (!formValues.codiceAnalisi.trim() || !formValues.descrizione.trim()) {
      setFormError("Codice Analisi e Descrizione sono obbligatori.");
      return;
    }
    createMutation.mutate(
      {
        data: {
          codiceAnalisi: formValues.codiceAnalisi.trim(),
          descrizione: formValues.descrizione.trim(),
          colorProvetta: toNull(formValues.colorProvetta),
          synlab: formValues.synlab,
          um: toNull(formValues.um),
          metodo: toNull(formValues.metodo),
          regola: toNull(formValues.regola),
          importo: toNull(formValues.importo),
          valoreRiferimento: buildRefString(formValues.refType, formValues.refMin, formValues.refMax, formValues.refSingle),
          preparationInstructions: formValues.preparationInstructions.trim(),
        },
      },
      {
        onSuccess: () => {
          setIsCreating(false);
          refetch();
        },
        onError: () => setFormError("Errore durante la creazione. Riprova."),
      }
    );
  };

  const handleUpdate = () => {
    if (!editExam) return;
    if (!formValues.codiceAnalisi.trim() || !formValues.descrizione.trim()) {
      setFormError("Codice Analisi e Descrizione sono obbligatori.");
      return;
    }
    updateMutation.mutate(
      {
        id: editExam.id,
        data: {
          codiceAnalisi: formValues.codiceAnalisi.trim(),
          descrizione: formValues.descrizione.trim(),
          colorProvetta: toNull(formValues.colorProvetta),
          synlab: formValues.synlab,
          um: toNull(formValues.um),
          metodo: toNull(formValues.metodo),
          regola: toNull(formValues.regola),
          importo: toNull(formValues.importo),
          valoreRiferimento: buildRefString(formValues.refType, formValues.refMin, formValues.refMax, formValues.refSingle),
          preparationInstructions: formValues.preparationInstructions.trim(),
        },
      },
      {
        onSuccess: () => {
          setEditExam(null);
          refetch();
        },
        onError: () => setFormError("Errore durante l'aggiornamento. Riprova."),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          refetch();
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cerca esame..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} className="gap-2 flex-shrink-0">
          <Plus className="h-4 w-4" />
          Nuovo esame
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nessun esame trovato</p>
          {search && <p className="text-sm">Prova con un altro termine di ricerca.</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Codice</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Descrizione</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Provetta</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Metodo</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Synlab</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Importo</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((exam) => (
                <tr key={exam.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{exam.codiceAnalisi}</td>
                  <td className="px-3 py-2.5 font-medium max-w-[200px] truncate" title={exam.descrizione}>{exam.descrizione}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{exam.colorProvetta ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground truncate max-w-[120px] block">{exam.metodo ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {exam.synlab
                      ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs">Sì</Badge>
                      : <span className="text-xs text-muted-foreground">No</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-primary">
                    {exam.importo ? `€ ${Number(exam.importo).toFixed(2)}` : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(exam as Exam)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Modifica"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(exam as Exam)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground">
            {filtered.length} esam{filtered.length === 1 ? "e" : "i"}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreating} onOpenChange={(o) => !o && setIsCreating(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo esame</DialogTitle>
          </DialogHeader>
          <ExamForm value={formValues} onChange={setFormValues} />
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvataggio..." : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editExam} onOpenChange={(o) => !o && setEditExam(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica esame</DialogTitle>
          </DialogHeader>
          <ExamForm value={formValues} onChange={setFormValues} />
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExam(null)}>Annulla</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina esame</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare <strong>{deleteTarget?.descrizione}</strong>? L'operazione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
