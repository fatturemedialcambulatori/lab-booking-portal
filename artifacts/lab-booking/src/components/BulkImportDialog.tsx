import React from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  SkipForward,
  Download,
} from "lucide-react";

// ---- column alias map (Italian/English header names → internal field) --------
const ALIAS: Record<string, string> = {
  nome: "firstName", name: "firstName", "first name": "firstName", firstname: "firstName",
  cognome: "lastName", surname: "lastName", "last name": "lastName", lastname: "lastName",
  "data nascita": "dateOfBirth", "data di nascita": "dateOfBirth", datanascita: "dateOfBirth",
  "date of birth": "dateOfBirth", dob: "dateOfBirth", "data_nascita": "dateOfBirth",
  "codice fiscale": "codiceFiscale", "codice_fiscale": "codiceFiscale", cf: "codiceFiscale",
  "tax code": "codiceFiscale", "fiscal code": "codiceFiscale", codicefiscale: "codiceFiscale",
  document: "codiceFiscale",
  email: "email", "e-mail": "email", mail: "email",
  telefono: "phone", tel: "phone", phone: "phone", cellulare: "phone", mobile: "phone",
  sesso: "gender", genere: "gender", gender: "gender",
  note: "notes", notes: "notes",
  indirizzo: "billingAddress", "indirizzo fatturazione": "billingAddress", "address street": "billingAddress", address: "billingAddress", billingaddress: "billingAddress",
  cap: "billingCap", "codice postale": "billingCap", "address postal code": "billingCap", postalcode: "billingCap", billingcap: "billingCap",
  città: "billingCity", citta: "billingCity", city: "billingCity", comune: "billingCity", "address city": "billingCity", billingcity: "billingCity",
  provincia: "billingProvincia", prov: "billingProvincia", "address province": "billingProvincia", "address state": "billingProvincia", billingprovincia: "billingProvincia",
  "fiscal first name": "firstName", "fiscal last name": "lastName",
};

type PatientRow = Record<string, string>;

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function cleanCell(value: unknown): string {
  return String(value ?? "").trim().replace(/^'+/, "").trim();
}

function normalizeGender(value: string | undefined): string | undefined {
  const text = cleanCell(value).toLowerCase();
  if (["f", "female", "femmina", "donna"].includes(text)) return "F";
  if (["m", "male", "maschio", "uomo"].includes(text)) return "M";
  return value;
}

function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (ALIAS[norm]) mapping[h] = ALIAS[norm];
  }
  return mapping;
}

function parseRows(raw: Record<string, string>[], mapping: Record<string, string>): PatientRow[] {
  return raw.map((row) => {
    const out: PatientRow = {};
    for (const [col, field] of Object.entries(mapping)) {
      const value = cleanCell(row[col]);
      out[field] = field === "gender" ? normalizeGender(value) ?? value : value;
    }
    return out;
  }).filter((r) => r.firstName || r.lastName || r.email || r.phone || r.codiceFiscale);
}

async function parseFile(file: File): Promise<{ headers: string[]; raw: Record<string, string>[] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve({ headers: res.meta.fields ?? [], raw: res.data }),
        error: reject,
      });
    });
  }
  // xlsx / xls / ods
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  return { headers, raw: data };
}

interface Result { created: number; skipped: number; errors: string[] }

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function BulkImportDialog({ onClose, onImported }: Props) {
  const [step, setStep] = React.useState<"upload" | "preview" | "result">("upload");
  const [dragging, setDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [raw, setRaw] = React.useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [rows, setRows] = React.useState<PatientRow[]>([]);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      const { headers: h, raw: r } = await parseFile(file);
      const m = mapHeaders(h);
      setHeaders(h);
      setRaw(r);
      setMapping(m);
      setRows(parseRows(r, m));
      setStep("preview");
    } catch {
      setParseError("Impossibile leggere il file. Assicurati che sia un CSV o Excel valido.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleMappingChange = (col: string, field: string) => {
    const m = { ...mapping, [col]: field };
    if (!field) delete m[col];
    setMapping(m);
    setRows(parseRows(raw, m));
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const resp = await fetch("/api/patients/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const data: Result = await resp.json();
      setResult(data);
      setStep("result");
      if (data.created > 0) onImported();
    } catch {
      setResult({ created: 0, skipped: 0, errors: ["Errore di rete. Riprova."] });
      setStep("result");
    } finally {
      setImporting(false);
    }
  };

  const FIELDS = [
    { value: "firstName", label: "Nome *" },
    { value: "lastName", label: "Cognome *" },
    { value: "email", label: "Email *" },
    { value: "phone", label: "Telefono *" },
    { value: "dateOfBirth", label: "Data di nascita" },
    { value: "codiceFiscale", label: "Codice fiscale" },
    { value: "gender", label: "Sesso" },
    { value: "notes", label: "Note" },
    { value: "billingAddress", label: "Indirizzo fatt." },
    { value: "billingCap", label: "CAP" },
    { value: "billingCity", label: "Città" },
    { value: "billingProvincia", label: "Provincia" },
  ];

  const requiredMapped = ["firstName", "lastName"].every(
    (f) => Object.values(mapping).includes(f)
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importazione bulk pazienti
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Formati supportati: CSV, XLSX, XLS, ODS
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── STEP 1: Upload ── */}
          {step === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-14 cursor-pointer transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
              onClick={() => document.getElementById("bulk-file-input")?.click()}
            >
              <Upload className={`h-10 w-10 ${dragging ? "text-primary" : "text-muted-foreground/50"}`} />
              <div className="text-center">
                <p className="font-medium text-foreground">Trascina il file qui</p>
                <p className="text-sm text-muted-foreground">oppure clicca per scegliere</p>
              </div>
              <input
                id="bulk-file-input"
                type="file"
                accept=".csv,.xlsx,.xls,.ods"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* ── STEP 2: Preview & mapping ── */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{raw.length} righe trovate · {rows.length} valide</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setFileName(null); }}>
                  Cambia file
                </Button>
              </div>

              {/* Column mapping */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Associa le colonne del file ai campi del sistema
                </p>
                <div className="rounded-lg border divide-y overflow-hidden">
                  {headers.map((col) => (
                    <div key={col} className="flex items-center px-3 py-2 gap-3 bg-card text-sm">
                      <span className="flex-1 font-mono text-xs text-muted-foreground truncate" title={col}>{col}</span>
                      <span className="text-muted-foreground/50">→</span>
                      <select
                        className="flex-1 text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                        value={mapping[col] ?? ""}
                        onChange={(e) => handleMappingChange(col, e.target.value)}
                      >
                        <option value="">(ignora)</option>
                        {FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {!requiredMapped && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Associa almeno Nome e Cognome per poter importare. Email e telefono possono essere vuoti.
                </div>
              )}

              {/* Preview table */}
              {rows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Anteprima (prime 5 righe)
                  </p>
                  <div className="overflow-x-auto rounded-lg border text-xs">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted/50">
                        <tr>
                          {Object.values(mapping).filter(Boolean).map((f) => (
                            <th key={f} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                              {FIELDS.find((x) => x.value === f)?.label ?? f}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card">
                        {rows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {Object.values(mapping).filter(Boolean).map((f) => (
                              <td key={f} className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                {row[f] || <span className="italic opacity-40">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && (
                    <p className="text-xs text-muted-foreground mt-1">... e altri {rows.length - 5} pazienti</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Result ── */}
          {step === "result" && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600">Importati</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-center">
                  <SkipForward className="h-6 w-6 text-blue-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{result.skipped}</p>
                  <p className="text-xs text-blue-600">Già presenti (saltati)</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center">
                  <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-600">Errori</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          {step === "upload" && (
            <Button variant="outline" onClick={onClose}>Annulla</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={onClose}>Annulla</Button>
              <Button
                onClick={handleImport}
                disabled={!requiredMapped || rows.length === 0 || importing}
              >
                {importing ? "Importazione..." : `Importa ${rows.length} pazienti`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={onClose}>Chiudi</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
