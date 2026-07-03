import React from "react";
import { useFormContext } from "react-hook-form";
import { useListExams } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Search, X, ArrowRight, Camera, FileText, Loader2, AlertCircle, Sparkles, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BookingFormValues } from "../../pages/Home";

type Mode = "search" | "ocr";

type OcrState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; matchedIds: number[]; extractedTerms: string[] }
  | { status: "error"; message: string };

async function resizeImage(file: File, maxPx = 1200): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function ocrPrescription(file: File): Promise<{ matchedExamIds: number[]; extractedTerms: string[] }> {
  const { base64, mimeType } = await resizeImage(file);

  const res = await fetch("/api/ocr/prescription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Errore durante l'analisi della ricetta");
  }

  return res.json() as Promise<{ matchedExamIds: number[]; extractedTerms: string[] }>;
}

export function ExamSelection({ onNext }: { onNext: () => void }) {
  const { data: exams, isLoading, error } = useListExams();
  const { setValue, watch, formState: { errors } } = useFormContext<BookingFormValues>();
  const [search, setSearch] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("search");
  const [ocrState, setOcrState] = React.useState<OcrState>({ status: "idle" });
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedIds: number[] = watch("examIds") ?? [];

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      setValue("examIds", selectedIds.filter((x) => x !== id), { shouldValidate: true });
    } else {
      setValue("examIds", [...selectedIds, id], { shouldValidate: true });
    }
  };

  const filtered = React.useMemo(() => {
    if (!exams) return [];
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter(
      (e) =>
        e.descrizione.toLowerCase().includes(q) ||
        e.codiceAnalisi.toLowerCase().includes(q) ||
        (e.metodo ?? "").toLowerCase().includes(q)
    );
  }, [exams, search]);

  const selectedExams = React.useMemo(
    () => (exams ?? []).filter((e) => selectedIds.includes(e.id)),
    [exams, selectedIds]
  );

  const ocrMatchedIds = ocrState.status === "done" ? new Set(ocrState.matchedIds) : new Set<number>();

  const totalPrice = selectedExams.reduce((sum, e) => sum + (e.importo ? Number(e.importo) : 0), 0);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setOcrState({ status: "error", message: "Carica un'immagine (JPEG, PNG, WebP)." });
      return;
    }
    setOcrState({ status: "loading" });
    try {
      const result = await ocrPrescription(file);
      setOcrState({ status: "done", matchedIds: result.matchedExamIds, extractedTerms: result.extractedTerms });
      if (result.matchedExamIds.length > 0) {
        const merged = Array.from(new Set([...selectedIds, ...result.matchedExamIds]));
        setValue("examIds", merged, { shouldValidate: true });
      }
    } catch (err) {
      setOcrState({ status: "error", message: err instanceof Error ? err.message : "Errore sconosciuto" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const resetOcr = () => {
    setOcrState({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-full bg-muted rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (error || !exams) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Impossibile caricare il listino esami. Riprova.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold mb-1 text-foreground">Seleziona Esami</h2>
        <p className="text-muted-foreground text-sm">Cerca l'esame per nome oppure carica la foto della ricetta medica.</p>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            mode === "search"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-4 w-4" />
          Cerca per nome
        </button>
        <button
          type="button"
          onClick={() => setMode("ocr")}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            mode === "ocr"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4" />
          Carica ricetta
        </button>
      </div>

      {/* OCR mode */}
      {mode === "ocr" && (
        <div className="space-y-4">
          {ocrState.status === "idle" && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Scatta una foto o carica un'immagine</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fotografa la ricetta del medico — l'AI riconoscerà gli esami automaticamente
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-2 mt-1">
                  <Camera className="h-4 w-4" />
                  <span className="sm:hidden">Scatta foto</span>
                  <span className="hidden sm:inline">Scegli immagine</span>
                </Button>
                <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · Max 10 MB</p>
              </div>
            </div>
          )}

          {ocrState.status === "loading" && (
            <div className="border rounded-xl p-8 flex flex-col items-center gap-3 bg-muted/30">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div className="text-center">
                <p className="font-medium text-foreground">Analisi in corso…</p>
                <p className="text-sm text-muted-foreground mt-1">L'AI sta leggendo la ricetta e cercando gli esami nel listino</p>
              </div>
            </div>
          )}

          {ocrState.status === "error" && (
            <div className="border border-destructive/30 rounded-xl p-5 bg-destructive/5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-destructive text-sm">Analisi non riuscita</p>
                <p className="text-sm text-muted-foreground mt-0.5">{ocrState.message}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={resetOcr} className="flex-shrink-0">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}

          {ocrState.status === "done" && (
            <div className="space-y-3">
              {ocrState.matchedIds.length > 0 ? (
                <div className="border border-green-200 rounded-xl p-4 bg-green-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-green-600" />
                    <p className="font-semibold text-green-800 text-sm">
                      {ocrState.matchedIds.length} {ocrState.matchedIds.length === 1 ? "esame trovato" : "esami trovati"} nella ricetta
                    </p>
                    <Button type="button" variant="ghost" size="sm" onClick={resetOcr} className="ml-auto h-7 w-7 p-0 text-muted-foreground">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ocrState.extractedTerms.map((term, i) => (
                      <span key={i} className="inline-block text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
                        {term}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-green-700 mt-3">
                    Gli esami sono stati pre-selezionati. Puoi aggiungerne altri dalla lista qui sotto.
                  </p>
                </div>
              ) : (
                <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 text-sm">Nessun esame riconosciuto</p>
                    <p className="text-xs text-amber-700 mt-1">
                      {ocrState.extractedTerms.length > 0
                        ? `Estratto: ${ocrState.extractedTerms.join(", ")} — cerca manualmente nella lista.`
                        : "Non è stato possibile leggere gli esami. Prova con una foto più nitida o cerca manualmente."}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={resetOcr} className="flex-shrink-0 h-7 w-7 p-0 text-muted-foreground">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search mode */}
      {mode === "search" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cerca per nome o codice esame…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {selectedExams.map((e) => (
              <span
                key={e.id}
                className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 max-w-[220px] ${
                  ocrMatchedIds.has(e.id)
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {ocrMatchedIds.has(e.id) && <Sparkles className="h-2.5 w-2.5 flex-shrink-0" />}
                <span className="truncate">{e.descrizione}</span>
                <button
                  type="button"
                  onClick={() => toggle(e.id)}
                  className="flex-shrink-0 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Exam list — always shown so patient can add/remove after OCR too */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Nessun esame trovato.</p>
        ) : filtered.map((exam) => {
          const isSelected = selectedIds.includes(exam.id);
          const fromOcr = ocrMatchedIds.has(exam.id);
          return (
            <Card
              key={exam.id}
              className={`p-3 cursor-pointer transition-all border-2 ${
                isSelected
                  ? fromOcr
                    ? "border-green-400 bg-green-50/60 shadow-sm"
                    : "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent hover:border-border"
              }`}
              onClick={() => toggle(exam.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? fromOcr
                        ? "bg-green-500 border-green-500"
                        : "bg-primary border-primary"
                      : "border-muted-foreground/40"
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm leading-snug truncate">{exam.descrizione}</p>
                      {fromOcr && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5 flex-shrink-0">
                          <Sparkles className="h-2.5 w-2.5" />
                          Ricetta
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {exam.codiceAnalisi}
                      {exam.um && <span className="ml-2 text-muted-foreground/70">· {exam.um}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {exam.importo && (
                    <span className="text-sm font-semibold text-primary whitespace-nowrap">
                      € {Number(exam.importo).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {errors.examIds && (
        <p className="text-sm text-destructive">{errors.examIds.message}</p>
      )}

      {/* Sticky bottom CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {selectedIds.length > 0 ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">
                {selectedIds.length} {selectedIds.length === 1 ? "esame" : "esami"} selezionat{selectedIds.length === 1 ? "o" : "i"}
              </p>
              {totalPrice > 0 && (
                <p className="text-xs text-muted-foreground">Totale stimato: € {totalPrice.toFixed(2)}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Seleziona almeno un esame</p>
          )}
          <Button
            onClick={onNext}
            disabled={selectedIds.length === 0}
            size="lg"
            className="flex-shrink-0 gap-2"
          >
            Continua
            {selectedIds.length > 0 && (
              <>
                <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-bold leading-none">
                  {selectedIds.length}
                </span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
