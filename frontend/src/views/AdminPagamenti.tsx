import React from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { AlertCircle, CheckCircle2, CreditCard, Euro, RefreshCw, Search } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type CassaScope = "tutte" | "modena" | "sassuolo";
type PaymentStatus = "unpaid" | "paid";
type PaymentFilter = PaymentStatus | "all";
type AreaFilter = "tutte" | "Laboratorio" | "Ambulatorio";

type PaymentItem = {
  id: string;
  source: "laboratorio" | "agenda";
  sourceId: number | string;
  area: "Laboratorio" | "Ambulatorio";
  sede: "modena" | "sassuolo" | null;
  date: string;
  time: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  description: string;
  doctorName?: string | null;
  amount: number;
  clinicalStatus: string;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
};

type PaymentsResponse = {
  items?: PaymentItem[];
  totals?: {
    count?: number;
    amount?: number;
    unpaid?: number;
    paid?: number;
  };
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

const sedeLabel = (sede: PaymentItem["sede"]) => {
  if (sede === "modena") return "Modena";
  if (sede === "sassuolo") return "Sassuolo";
  return "Sede non indicata";
};

const scopeLabel = (scope: CassaScope) => {
  if (scope === "modena") return "Modena";
  if (scope === "sassuolo") return "Sassuolo";
  return "Tutte le sedi";
};

const formatDate = (date: string) => {
  try {
    return format(parseISO(date), "dd MMM yyyy", { locale: it });
  } catch {
    return date;
  }
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "paid") {
    return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Pagato</Badge>;
  }
  return <Badge className="border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-100">Non pagato</Badge>;
}

export function AdminPagamenti({ scope = "tutte" }: { scope?: CassaScope }) {
  const [items, setItems] = React.useState<PaymentItem[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<PaymentFilter>("unpaid");
  const [areaFilter, setAreaFilter] = React.useState<AreaFilter>("tutte");
  const [sedeFilter, setSedeFilter] = React.useState<CassaScope>(scope);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSedeFilter(scope);
  }, [scope]);

  const loadPayments = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/payments?status=${statusFilter}`, { credentials: "include" });
      if (!response.ok) throw new Error("Pagamenti non disponibili");
      const data = (await response.json()) as PaymentsResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Errore durante il caricamento dei pagamenti");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase("it-IT");
    return items.filter((item) => {
      if (areaFilter !== "tutte" && item.area !== areaFilter) return false;
      if (sedeFilter !== "tutte" && item.sede !== sedeFilter) return false;
      if (!q) return true;
      return [
        item.patientName,
        item.patientEmail,
        item.patientPhone,
        item.description,
        item.doctorName,
        sedeLabel(item.sede),
      ]
        .join(" ")
        .toLocaleLowerCase("it-IT")
        .includes(q);
    });
  }, [areaFilter, items, search, sedeFilter]);

  const totals = React.useMemo(() => {
    const unpaidItems = filteredItems.filter((item) => item.paymentStatus === "unpaid");
    const paidItems = filteredItems.filter((item) => item.paymentStatus === "paid");
    return {
      count: filteredItems.length,
      amount: filteredItems.reduce((sum, item) => sum + item.amount, 0),
      unpaid: unpaidItems.length,
      unpaidAmount: unpaidItems.reduce((sum, item) => sum + item.amount, 0),
      paid: paidItems.length,
      paidAmount: paidItems.reduce((sum, item) => sum + item.amount, 0),
    };
  }, [filteredItems]);

  const updatePaymentStatus = async (item: PaymentItem, paymentStatus: PaymentStatus) => {
    setUpdatingId(item.id);
    try {
      const response = await fetch("/api/payments-status", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: item.source,
          id: item.sourceId,
          paymentStatus,
        }),
      });
      if (!response.ok) throw new Error("Salvataggio pagamento non riuscito");
      toast({
        title: "Pagamento aggiornato",
        description: paymentStatus === "paid" ? "La voce e stata segnata come pagata." : "La voce e tornata tra i non pagati.",
      });
      await loadPayments();
    } catch (err) {
      toast({
        title: "Attenzione",
        description: err instanceof Error ? err.message : "Non riesco ad aggiornare il pagamento.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pagamenti</h1>
          <p className="text-sm text-muted-foreground">
            Visite e accettazioni completate da saldare, filtrate per cassa e sede.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2 self-start lg:self-auto" onClick={() => void loadPayments()}>
          <RefreshCw className="h-4 w-4" />
          Aggiorna
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Da saldare</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{euro.format(totals.unpaidAmount)}</p>
          <p className="text-sm text-muted-foreground">{totals.unpaid} voci aperte</p>
        </div>
        <div className="rounded-md border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagati</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{euro.format(totals.paidAmount)}</p>
          <p className="text-sm text-muted-foreground">{totals.paid} voci saldate</p>
        </div>
        <div className="rounded-md border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista corrente</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{totals.count}</p>
          <p className="text-sm text-muted-foreground">{scopeLabel(sedeFilter)} · {euro.format(totals.amount)}</p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-white">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca paziente, telefono, medico o prestazione..."
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value: PaymentFilter) => setStatusFilter(value)}>
            <SelectTrigger className="w-full xl:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">Non pagati</SelectItem>
              <SelectItem value="paid">Pagati</SelectItem>
              <SelectItem value="all">Tutti</SelectItem>
            </SelectContent>
          </Select>

          <Select value={areaFilter} onValueChange={(value: AreaFilter) => setAreaFilter(value)}>
            <SelectTrigger className="w-full xl:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutte">Tutte le aree</SelectItem>
              <SelectItem value="Ambulatorio">Ambulatorio</SelectItem>
              <SelectItem value="Laboratorio">Laboratorio</SelectItem>
            </SelectContent>
          </Select>

          {scope === "tutte" && (
            <Select value={sedeFilter} onValueChange={(value: CassaScope) => setSedeFilter(value)}>
              <SelectTrigger className="w-full xl:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutte">Tutte le sedi</SelectItem>
                <SelectItem value="modena">Modena</SelectItem>
                <SelectItem value="sassuolo">Sassuolo</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {error ? (
          <div className="flex items-center gap-2 p-6 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <CreditCard className="mx-auto mb-3 h-9 w-9 opacity-30" />
            Nessuna voce trovata con i filtri correnti.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paziente</TableHead>
                <TableHead>Prestazione / esami</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="min-w-[180px]">
                      <p className="font-semibold text-foreground">{item.patientName}</p>
                      <p className="text-xs text-muted-foreground">{item.patientPhone || item.patientEmail || "-"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[420px]">
                      <p className="truncate font-medium text-foreground">{item.description}</p>
                      {item.doctorName && <p className="text-xs text-muted-foreground">{item.doctorName}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="whitespace-nowrap text-sm font-medium">{formatDate(item.date)}</p>
                    <p className="text-xs text-muted-foreground">{item.time || "-"}</p>
                  </TableCell>
                  <TableCell>{item.area}</TableCell>
                  <TableCell>{sedeLabel(item.sede)}</TableCell>
                  <TableCell className="text-right font-semibold">{euro.format(item.amount)}</TableCell>
                  <TableCell><PaymentStatusBadge status={item.paymentStatus} /></TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={item.paymentStatus === "paid" ? "outline" : "default"}
                      className={item.paymentStatus === "paid" ? "gap-2" : "gap-2 bg-emerald-600 hover:bg-emerald-700"}
                      disabled={updatingId === item.id}
                      onClick={() => updatePaymentStatus(item, item.paymentStatus === "paid" ? "unpaid" : "paid")}
                    >
                      {item.paymentStatus === "paid" ? (
                        <Euro className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {updatingId === item.id
                        ? "Salvo..."
                        : item.paymentStatus === "paid"
                          ? "Non pagato"
                          : "Segna pagato"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
