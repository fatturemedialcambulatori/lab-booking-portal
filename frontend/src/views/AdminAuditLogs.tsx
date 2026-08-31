import React from "react";
import { Activity, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditOutcome = "success" | "blocked" | "error";

type AuditLogEntry = {
  id: number;
  createdAt: string;
  actorUsername: string | null;
  actorRoleId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: AuditOutcome;
  reason: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  metadata: Record<string, unknown>;
};

type AuditLogsResponse = {
  items: AuditLogEntry[];
  page: number;
  pageSize: number;
  total: number;
};

const outcomeLabels: Record<AuditOutcome, string> = {
  success: "Riuscita",
  blocked: "Bloccata",
  error: "Errore",
};

const outcomeClass: Record<AuditOutcome, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blocked: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

const actionLabels: Record<string, string> = {
  "auth.login": "Login",
  "auth.password_change": "Cambio password",
  "http.post": "Creazione / azione",
  "http.put": "Modifica",
  "http.patch": "Aggiornamento",
  "http.delete": "Eliminazione",
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
};

const metadataLabel = (metadata: Record<string, unknown>) => {
  const statusCode = metadata["statusCode"];
  if (typeof statusCode === "number") return `HTTP ${statusCode}`;
  return "";
};

export function AdminAuditLogs() {
  const [items, setItems] = React.useState<AuditLogEntry[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [total, setTotal] = React.useState(0);
  const [actorFilter, setActorFilter] = React.useState("");
  const [actorFilterDraft, setActorFilterDraft] = React.useState("");
  const [outcomeFilter, setOutcomeFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const loadLogs = React.useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (actorFilter) params.set("actor", actorFilter);
    if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/audit-logs?${params.toString()}`, { credentials: "include" });
      const data = await response.json().catch(() => null) as AuditLogsResponse | { error?: string } | null;
      if (!response.ok || !data || !("items" in data)) {
        throw new Error((data as { error?: string } | null)?.error ?? "Log non disponibili");
      }
      setItems(data.items);
      setPage(data.page);
      setPageSize(data.pageSize);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log non disponibili");
    } finally {
      setLoading(false);
    }
  }, [actorFilter, outcomeFilter, page, pageSize]);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="space-y-4 rounded-md border border-border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Log operatore</h3>
            <p className="text-sm text-muted-foreground">
              Audit persistente delle azioni backend e degli eventi di sicurezza.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadLogs()} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={actorFilterDraft}
            onChange={(event) => setActorFilterDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPage(1);
                setActorFilter(actorFilterDraft.trim());
              }
            }}
            placeholder="Filtra operatore"
            className="pl-9"
          />
        </div>
        <Select
          value={outcomeFilter}
          onValueChange={(value) => {
            setPage(1);
            setOutcomeFilter(value);
          }}
        >
          <SelectTrigger className="md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli esiti</SelectItem>
            <SelectItem value="success">Riuscite</SelectItem>
            <SelectItem value="blocked">Bloccate</SelectItem>
            <SelectItem value="error">Errori</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPage(1);
            setActorFilter(actorFilterDraft.trim());
          }}
        >
          Applica filtro
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Operatore</TableHead>
              <TableHead>Azione</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Esito</TableHead>
              <TableHead>Dettaglio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {loading ? "Caricamento log..." : "Nessun log trovato."}
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(item.createdAt)}</TableCell>
                <TableCell>
                  <p className="text-sm font-medium text-foreground">{item.actorUsername ?? "Sistema"}</p>
                  <p className="text-xs text-muted-foreground">{item.actorRoleId ?? "-"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium text-foreground">{actionLabels[item.action] ?? item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.requestMethod ?? ""}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-foreground">{item.entityType}</p>
                  <p className="text-xs text-muted-foreground">{item.entityId ?? item.requestPath ?? "-"}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={outcomeClass[item.outcome]}>
                    {outcomeLabels[item.outcome] ?? item.outcome}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.reason ?? metadataLabel(item.metadata) ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Pagina {page} di {totalPages} - {total} eventi
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Precedente
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Successiva
          </Button>
        </div>
      </div>
    </section>
  );
}
