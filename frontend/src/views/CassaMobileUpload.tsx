import React from "react";
import { Camera, CheckCircle2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCassaDocument } from "@/lib/cassaFiles";

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (data: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));

const sedeLabel = (sedeId: string) => {
  if (sedeId === "modena") return "Modena";
  if (sedeId === "sassuolo") return "Sassuolo";
  return sedeId;
};

export function CassaMobileUpload() {
  const params = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const sedeId = params.get("sede") ?? "modena";
  const data = params.get("data") ?? todayKey();
  const tipo = params.get("tipo") ?? "pos";
  const documentId = params.get("doc") ?? `${sedeId}-${data}-${tipo}`;
  const [status, setStatus] = React.useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setStatus("uploading");
    setMessage("Caricamento in corso...");

    try {
      await uploadCassaDocument({
        id: documentId,
        sedeId,
        data,
        tipo,
        file,
      });
      setStatus("done");
      setMessage("Foto caricata. Puoi chiudere questa pagina.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload non riuscito.");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col justify-between rounded-md border border-border bg-white p-5 shadow-sm">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Camera className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Scatta chiusura POS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sedeLabel(sedeId)} - {formatDate(data)}
          </p>

          <div className="mt-6 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documento</p>
            <p className="mt-1 text-sm font-semibold">
              {tipo === "pos" ? "Chiusura giornaliera POS" : "Foglio fatturato giorno"}
            </p>
          </div>

          {status !== "idle" && (
            <div
              className={`mt-4 flex items-start gap-3 rounded-md border p-4 text-sm ${
                status === "done"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : status === "error"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-primary/20 bg-primary/10 text-primary"
              }`}
            >
              {status === "done" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : status === "error" ? (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <Upload className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <p>{message}</p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            className="h-14 w-full gap-2 text-base"
            disabled={status === "uploading"}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
            {status === "uploading" ? "Carico..." : "Scatta foto"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Dal telefono si aprira la fotocamera o la galleria, in base al browser.
          </p>
        </div>
      </div>
    </main>
  );
}
