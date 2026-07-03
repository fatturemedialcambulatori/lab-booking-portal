import React from "react";
import {
  useListExamReferenceRanges,
  useCreateExamReferenceRange,
  useUpdateExamReferenceRange,
  useDeleteExamReferenceRange,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { describeRangeConditions, displayStructuredRange, type StructuredRefRange, type Fascia } from "@/lib/refValue";

type RangeFormState = {
  gender: string;
  ageMin: string;
  ageMax: string;
  statoFisiologico: string;
  tipo: "range" | "qualitative" | "fasce";
  valoreMin: string;
  valoreMax: string;
  valoriAccettabili: string;
  fasce: Fascia[];
  unita: string;
  note: string;
  ordinamento: string;
};

const EMPTY_FORM: RangeFormState = {
  gender: "",
  ageMin: "",
  ageMax: "",
  statoFisiologico: "",
  tipo: "range",
  valoreMin: "",
  valoreMax: "",
  valoriAccettabili: "",
  fasce: [],
  unita: "",
  note: "",
  ordinamento: "0",
};

const COLORI_FASCIA: { value: string; label: string; cls: string }[] = [
  { value: "green", label: "Verde", cls: "bg-green-100 text-green-800 border-green-200" },
  { value: "yellow", label: "Giallo", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "orange", label: "Arancio", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "red", label: "Rosso", cls: "bg-red-100 text-red-800 border-red-200" },
];

function colorClass(color?: string | null) {
  return COLORI_FASCIA.find((c) => c.value === color)?.cls ?? "bg-gray-100 text-gray-800 border-gray-200";
}

function formToBody(f: RangeFormState) {
  return {
    gender: f.gender || null,
    ageMin: f.ageMin ? parseInt(f.ageMin) : null,
    ageMax: f.ageMax ? parseInt(f.ageMax) : null,
    statoFisiologico: f.statoFisiologico || null,
    tipo: f.tipo,
    valoreMin: f.tipo === "range" && f.valoreMin ? parseFloat(f.valoreMin) : null,
    valoreMax: f.tipo === "range" && f.valoreMax ? parseFloat(f.valoreMax) : null,
    valoriAccettabili: f.tipo === "qualitative" ? f.valoriAccettabili || null : null,
    fasce: f.tipo === "fasce" ? f.fasce : null,
    unita: f.unita || null,
    note: f.note || null,
    ordinamento: parseInt(f.ordinamento) || 0,
  };
}

function rangeToForm(r: StructuredRefRange): RangeFormState {
  return {
    gender: r.gender ?? "",
    ageMin: r.ageMin != null ? String(r.ageMin) : "",
    ageMax: r.ageMax != null ? String(r.ageMax) : "",
    statoFisiologico: r.statoFisiologico ?? "",
    tipo: (r.tipo as RangeFormState["tipo"]) ?? "range",
    valoreMin: r.valoreMin != null ? String(r.valoreMin) : "",
    valoreMax: r.valoreMax != null ? String(r.valoreMax) : "",
    valoriAccettabili: r.valoriAccettabili ?? "",
    fasce: (r.fasce as Fascia[]) ?? [],
    unita: r.unita ?? "",
    note: r.note ?? "",
    ordinamento: String(r.ordinamento ?? 0),
  };
}

function RangeForm({
  value,
  onChange,
}: {
  value: RangeFormState;
  onChange: (v: RangeFormState) => void;
}) {
  const set = <K extends keyof RangeFormState>(k: K, v: RangeFormState[K]) =>
    onChange({ ...value, [k]: v });

  const addFascia = () =>
    set("fasce", [...value.fasce, { label: "", color: "green" }]);

  const updateFascia = (i: number, patch: Partial<Fascia>) =>
    set("fasce", value.fasce.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const removeFascia = (i: number) =>
    set("fasce", value.fasce.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3 py-1">
      {/* Conditions */}
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condizioni di applicabilità</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Sesso</Label>
            <Select value={value.gender || "__all__"} onValueChange={(v) => set("gender", v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tutti</SelectItem>
                <SelectItem value="M">Maschio</SelectItem>
                <SelectItem value="F">Femmina</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stato fisiologico</Label>
            <Select value={value.statoFisiologico || "__none__"} onValueChange={(v) => set("statoFisiologico", v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuno</SelectItem>
                <SelectItem value="gravidanza">Gravidanza</SelectItem>
                <SelectItem value="pediatrico">Pediatrico</SelectItem>
                <SelectItem value="anziano">Anziano (≥ 65)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Età min (anni)</Label>
            <Input className="h-8 text-xs" type="number" min={0} value={value.ageMin} onChange={(e) => set("ageMin", e.target.value)} placeholder="es. 0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Età max (anni)</Label>
            <Input className="h-8 text-xs" type="number" min={0} value={value.ageMax} onChange={(e) => set("ageMax", e.target.value)} placeholder="es. 17" />
          </div>
        </div>
      </div>

      {/* Type */}
      <div className="space-y-1">
        <Label className="text-xs">Tipo di valore di riferimento</Label>
        <Select value={value.tipo} onValueChange={(v) => set("tipo", v as RangeFormState["tipo"])}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="range">Range numerico (min – max)</SelectItem>
            <SelectItem value="qualitative">Qualitativo (es. Negativo, Assente)</SelectItem>
            <SelectItem value="fasce">Fasce condizionali (es. Ottimale / Borderline / Alto rischio)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Type-specific fields */}
      {value.tipo === "range" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Valore minimo</Label>
            <Input className="h-8 text-xs" type="number" step="any" value={value.valoreMin} onChange={(e) => set("valoreMin", e.target.value)} placeholder="es. 70" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valore massimo</Label>
            <Input className="h-8 text-xs" type="number" step="any" value={value.valoreMax} onChange={(e) => set("valoreMax", e.target.value)} placeholder="es. 100" />
          </div>
        </div>
      )}

      {value.tipo === "qualitative" && (
        <div className="space-y-1">
          <Label className="text-xs">Valori accettabili (separati da virgola)</Label>
          <Input className="h-8 text-xs" value={value.valoriAccettabili} onChange={(e) => set("valoriAccettabili", e.target.value)} placeholder="es. Negativo, Assente, Non rilevato" />
        </div>
      )}

      {value.tipo === "fasce" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Fasce</Label>
            <Button type="button" variant="outline" size="sm" onClick={addFascia} className="h-6 text-xs gap-1">
              <Plus className="h-3 w-3" /> Aggiungi fascia
            </Button>
          </div>
          {value.fasce.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Nessuna fascia configurata.</p>
          )}
          {value.fasce.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px_90px_24px] gap-1.5 items-end">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Label</Label>
                <Input className="h-7 text-xs" value={f.label} onChange={(e) => updateFascia(i, { label: e.target.value })} placeholder="es. Ottimale" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Min</Label>
                <Input className="h-7 text-xs" type="number" step="any" value={f.min ?? ""} onChange={(e) => updateFascia(i, { min: e.target.value ? parseFloat(e.target.value) : null })} placeholder="—" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Max</Label>
                <Input className="h-7 text-xs" type="number" step="any" value={f.max ?? ""} onChange={(e) => updateFascia(i, { max: e.target.value ? parseFloat(e.target.value) : null })} placeholder="—" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Colore</Label>
                <Select value={f.color ?? "green"} onValueChange={(v) => updateFascia(i, { color: v as Fascia["color"] })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORI_FASCIA.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button type="button" onClick={() => removeFascia(i)} className="h-7 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* UM + Note */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">U.M. (sovrascrive esame)</Label>
          <Input className="h-8 text-xs" value={value.unita} onChange={(e) => set("unita", e.target.value)} placeholder="es. mg/dL" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ordinamento</Label>
          <Input className="h-8 text-xs" type="number" value={value.ordinamento} onChange={(e) => set("ordinamento", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Note / commento</Label>
        <Input className="h-8 text-xs" value={value.note} onChange={(e) => set("note", e.target.value)} placeholder="es. Digiuno di 12h" />
      </div>
    </div>
  );
}

export function AdminExamReferenceRanges({
  examId,
  examName,
  onClose,
}: {
  examId: number;
  examName: string;
  onClose: () => void;
}) {
  const { data: ranges, refetch } = useListExamReferenceRanges(examId);
  const createMut = useCreateExamReferenceRange();
  const updateMut = useUpdateExamReferenceRange();
  const deleteMut = useDeleteExamReferenceRange();

  const [editingId, setEditingId] = React.useState<number | "new" | null>(null);
  const [form, setForm] = React.useState<RangeFormState>(EMPTY_FORM);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, ordinamento: String((ranges?.length ?? 0) * 10) });
    setEditingId("new");
  };

  const openEdit = (r: StructuredRefRange) => {
    setForm(rangeToForm(r));
    setEditingId(r.id);
  };

  const cancel = () => setEditingId(null);

  const save = () => {
    const body = formToBody(form);
    if (editingId === "new") {
      createMut.mutate({ id: examId, data: body as any }, {
        onSuccess: () => { setEditingId(null); refetch(); },
      });
    } else if (editingId != null) {
      updateMut.mutate({ id: examId, rangeId: editingId, data: body as any }, {
        onSuccess: () => { setEditingId(null); refetch(); },
      });
    }
  };

  const del = (rangeId: number) => {
    deleteMut.mutate({ id: examId, rangeId }, { onSuccess: () => refetch() });
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">
            Valori di riferimento
            <span className="block text-xs font-normal text-muted-foreground mt-0.5">{examName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Range list */}
          {!ranges?.length && editingId !== "new" && (
            <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
              Nessun valore di riferimento configurato.<br />
              <span className="text-xs">Clicca "Aggiungi range" per iniziare.</span>
            </div>
          )}

          {ranges?.map((r) => {
            const rTyped = r as unknown as StructuredRefRange;
            const isEditing = editingId === r.id;
            const isExpanded = expandedId === r.id;

            return (
              <div key={r.id} className="border border-border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] font-mono flex-shrink-0">
                      {rTyped.tipo === "range" ? "Range" : rTyped.tipo === "qualitative" ? "Qualit." : "Fasce"}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">{describeRangeConditions(rTyped)}</span>
                    <span className="text-xs font-semibold text-foreground truncate">{displayStructuredRange(rTyped)}</span>
                    {rTyped.unita && <span className="text-[10px] text-muted-foreground">{rTyped.unita}</span>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isEditing && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(rTyped); }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); del(r.id); }}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>

                {(isExpanded || isEditing) && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/40">
                    {isEditing ? (
                      <>
                        <RangeForm value={form} onChange={setForm} />
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" onClick={save} disabled={isPending} className="gap-1.5">
                            <Check className="h-3.5 w-3.5" />
                            {isPending ? "Salvataggio..." : "Salva"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancel}>Annulla</Button>
                        </div>
                      </>
                    ) : (
                      <div className="pt-1 space-y-1">
                        {rTyped.tipo === "fasce" && rTyped.fasce?.map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${colorClass(f.color)}`}>{f.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {f.min != null && f.max != null ? `${f.min} – ${f.max}` : f.min != null ? `≥ ${f.min}` : f.max != null ? `< ${f.max}` : "—"}
                            </span>
                          </div>
                        ))}
                        {rTyped.note && <p className="text-xs text-muted-foreground italic">{rTyped.note}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Inline new form */}
          {editingId === "new" && (
            <div className="border border-primary/30 rounded-lg px-3 pb-3 pt-2 bg-primary/5">
              <p className="text-xs font-semibold text-primary mb-2">Nuovo range</p>
              <RangeForm value={form} onChange={setForm} />
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={save} disabled={isPending} className="gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  {isPending ? "Salvataggio..." : "Aggiungi"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancel}>Annulla</Button>
              </div>
            </div>
          )}

          {editingId === null && (
            <Button variant="outline" size="sm" onClick={openNew} className="w-full gap-2">
              <Plus className="h-3.5 w-3.5" />
              Aggiungi range
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
