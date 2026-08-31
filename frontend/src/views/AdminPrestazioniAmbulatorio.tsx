import React from "react";
import {
  AlertTriangle,
  Clock,
  Euro,
  Search,
  Stethoscope,
  Tags,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Specialita = {
  id: string;
  nome: string;
  attiva: boolean;
};

type PrestazioneAmbulatorio = {
  id: string;
  nome: string;
  specialita: string;
  durata: number;
  attiva: boolean;
};

type MedicoAmbulatorio = {
  id: string;
  nome: string;
  specialita: string;
  agendaAperta: boolean;
};

type ListinoAmbulatorio = {
  id: string;
  prestazioneId: string;
  medicoId: string;
  durata: number;
  prezzo: number;
};

type CatalogoAmbulatorio = {
  specialita: Specialita[];
  prestazioni: PrestazioneAmbulatorio[];
  medici: MedicoAmbulatorio[];
  listini: ListinoAmbulatorio[];
};

const FILTRO_TUTTE = "__tutte__";

const valuta = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const normalizzaTesto = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isCatalogoAmbulatorio = (value: unknown): value is CatalogoAmbulatorio => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<CatalogoAmbulatorio>;
  return (
    Array.isArray(data.specialita) &&
    Array.isArray(data.prestazioni) &&
    Array.isArray(data.medici) &&
    Array.isArray(data.listini)
  );
};

export function AdminPrestazioniAmbulatorio() {
  const [catalogo, setCatalogo] = React.useState<CatalogoAmbulatorio | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errore, setErrore] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [specialitaSelezionata, setSpecialitaSelezionata] = React.useState(FILTRO_TUTTE);

  const caricaPrestazioni = React.useCallback(async () => {
    setLoading(true);
    setErrore("");

    try {
      const response = await fetch("/api/ambulatorio/prestazioni", { credentials: "include" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = data && typeof data === "object" ? (data as { error?: string }).error : null;
        throw new Error(error ?? "Prestazioni ambulatorio non disponibili.");
      }
      if (!isCatalogoAmbulatorio(data)) {
        throw new Error("Risposta prestazioni non valida.");
      }
      setCatalogo(data);
    } catch (error) {
      setErrore(error instanceof Error ? error.message : "Errore durante il caricamento prestazioni.");
      setCatalogo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void caricaPrestazioni();
  }, [caricaPrestazioni]);

  const specialitaDisponibili = React.useMemo(() => {
    const nomi = new Map<string, { nome: string; attiva: boolean }>();

    catalogo?.specialita.forEach((item) => {
      if (!item.nome) return;
      nomi.set(normalizzaTesto(item.nome), { nome: item.nome, attiva: item.attiva });
    });
    catalogo?.prestazioni.forEach((item) => {
      if (!item.specialita) return;
      const key = normalizzaTesto(item.specialita);
      if (!nomi.has(key)) nomi.set(key, { nome: item.specialita, attiva: true });
    });

    return Array.from(nomi.values()).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [catalogo]);

  React.useEffect(() => {
    if (specialitaSelezionata === FILTRO_TUTTE) return;
    if (specialitaDisponibili.some((item) => normalizzaTesto(item.nome) === normalizzaTesto(specialitaSelezionata))) return;
    setSpecialitaSelezionata(FILTRO_TUTTE);
  }, [specialitaDisponibili, specialitaSelezionata]);

  const mediciById = React.useMemo(
    () => new Map((catalogo?.medici ?? []).map((medico) => [medico.id, medico])),
    [catalogo?.medici],
  );

  const listiniByPrestazione = React.useMemo(() => {
    const map = new Map<string, ListinoAmbulatorio[]>();
    (catalogo?.listini ?? []).forEach((listino) => {
      const medico = mediciById.get(listino.medicoId);
      if (!medico) return;
      map.set(listino.prestazioneId, [...(map.get(listino.prestazioneId) ?? []), listino]);
    });
    map.forEach((righe) => {
      righe.sort((a, b) => {
        const medicoA = mediciById.get(a.medicoId)?.nome ?? "";
        const medicoB = mediciById.get(b.medicoId)?.nome ?? "";
        return medicoA.localeCompare(medicoB, "it");
      });
    });
    return map;
  }, [catalogo?.listini, mediciById]);

  const prestazioniFiltrate = React.useMemo(() => {
    const query = normalizzaTesto(ricerca);

    return (catalogo?.prestazioni ?? [])
      .filter((prestazione) => {
        const matchSpecialita =
          specialitaSelezionata === FILTRO_TUTTE ||
          normalizzaTesto(prestazione.specialita) === normalizzaTesto(specialitaSelezionata);
        if (!matchSpecialita) return false;
        if (!query) return true;

        const listini = listiniByPrestazione.get(prestazione.id) ?? [];
        const medici = listini
          .map((listino) => mediciById.get(listino.medicoId)?.nome ?? "")
          .join(" ");

        return [prestazione.nome, prestazione.specialita, medici]
          .some((campo) => normalizzaTesto(campo).includes(query));
      })
      .sort((a, b) => {
        const specialitaDiff = a.specialita.localeCompare(b.specialita, "it");
        return specialitaDiff !== 0 ? specialitaDiff : a.nome.localeCompare(b.nome, "it");
      });
  }, [catalogo?.prestazioni, listiniByPrestazione, mediciById, ricerca, specialitaSelezionata]);

  const totalePrestazioni = catalogo?.prestazioni.length ?? 0;
  const totaleAttive = catalogo?.prestazioni.filter((prestazione) => prestazione.attiva).length ?? 0;
  const totaleListini = catalogo?.listini.length ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <HeaderPrestazioni />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-md border border-border bg-muted/50" />
          ))}
        </div>
        <div className="h-[520px] animate-pulse rounded-md border border-border bg-muted/50" />
      </div>
    );
  }

  if (errore) {
    return (
      <div className="space-y-6">
        <HeaderPrestazioni />
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-3">
              <p className="font-medium">{errore}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void caricaPrestazioni()}>
                Riprova
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HeaderPrestazioni />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={<Stethoscope className="h-5 w-5" />} label="Prestazioni" value={String(totalePrestazioni)} />
        <MetricCard icon={<Tags className="h-5 w-5" />} label="Specialita" value={String(specialitaDisponibili.length)} />
        <MetricCard icon={<Euro className="h-5 w-5" />} label="Righe listino" value={String(totaleListini)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section className="rounded-md border border-border bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Macro aree</h2>
            <p className="text-sm text-muted-foreground">{totaleAttive} prestazioni attive</p>
          </div>
          <div className="space-y-1">
            <MacroAreaButton
              active={specialitaSelezionata === FILTRO_TUTTE}
              label="Tutte"
              count={catalogo?.prestazioni.length ?? 0}
              onClick={() => setSpecialitaSelezionata(FILTRO_TUTTE)}
            />
            {specialitaDisponibili.map((specialita) => {
              const count = catalogo?.prestazioni.filter(
                (prestazione) => normalizzaTesto(prestazione.specialita) === normalizzaTesto(specialita.nome),
              ).length ?? 0;
              return (
                <MacroAreaButton
                  key={specialita.nome}
                  active={specialitaSelezionata === specialita.nome}
                  disabled={!specialita.attiva}
                  label={specialita.nome}
                  count={count}
                  onClick={() => setSpecialitaSelezionata(specialita.nome)}
                />
              );
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-md border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {specialitaSelezionata === FILTRO_TUTTE ? "Tutte le prestazioni" : specialitaSelezionata}
              </h2>
              <p className="text-sm text-muted-foreground">
                Vista consultiva da ambulatorio. Le modifiche si fanno solo in Impostazioni.
              </p>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={ricerca}
                onChange={(event) => setRicerca(event.target.value)}
                placeholder="Cerca visita, specialita o medico"
                className="pl-9"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Prestazione</TableHead>
                  <TableHead className="min-w-[180px]">Specialita</TableHead>
                  <TableHead className="w-32">Durata base</TableHead>
                  <TableHead className="min-w-[420px]">Prezzi per medico</TableHead>
                  <TableHead className="w-28">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestazioniFiltrate.length > 0 ? (
                  prestazioniFiltrate.map((prestazione) => {
                    const righeListino = listiniByPrestazione.get(prestazione.id) ?? [];
                    return (
                      <TableRow key={prestazione.id}>
                        <TableCell className="font-medium text-foreground">{prestazione.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{prestazione.specialita}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                            <Clock className="h-3.5 w-3.5" />
                            {prestazione.durata} min
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {righeListino.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {righeListino.map((listino) => {
                                const medico = mediciById.get(listino.medicoId);
                                return (
                                  <span
                                    key={listino.id}
                                    className="inline-flex max-w-full items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900"
                                  >
                                    <UserRound className="h-3.5 w-3.5 shrink-0" />
                                    <span className="min-w-0 truncate font-medium">{medico?.nome ?? "Medico"}</span>
                                    <span className="shrink-0 text-emerald-700">
                                      {valuta.format(listino.prezzo)} · {listino.durata} min
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Nessun prezzo medico configurato</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={prestazione.attiva ? "default" : "outline"}>
                            {prestazione.attiva ? "Attiva" : "Disattiva"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nessuna prestazione trovata.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeaderPrestazioni() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Prestazioni ambulatorio</h1>
      <p className="text-sm text-muted-foreground">
        Visite e prestazioni organizzate per specialita, con durata base e prezzi dei medici.
      </p>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </div>
  );
}

function MacroAreaButton({
  active,
  disabled,
  label,
  count,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-slate-100 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      }`}
    >
      <span className="min-w-0 truncate font-medium">{label}</span>
      <Badge variant={active ? "secondary" : "outline"} className="shrink-0">
        {count}
      </Badge>
    </button>
  );
}
