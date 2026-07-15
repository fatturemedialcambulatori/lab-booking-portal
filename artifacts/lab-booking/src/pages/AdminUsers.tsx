import React from "react";
import { UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type Utente = {
  id: string;
  nome: string;
  email: string;
  ruolo: string;
  stato: "attivo" | "sospeso";
};

const UTENTI_INIZIALI: Utente[] = [
  { id: "segreteria", nome: "Segreteria", email: "segreteria@mmedical.local", ruolo: "Segreteria", stato: "attivo" },
  { id: "lab", nome: "Laboratorio", email: "laboratorio@mmedical.local", ruolo: "Laboratorio", stato: "attivo" },
  { id: "admin", nome: "Amministratore", email: "admin@mmedical.local", ruolo: "Admin", stato: "sospeso" },
];

export function AdminUsers() {
  const [utenti, setUtenti] = React.useState(UTENTI_INIZIALI);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Utenti e permessi</h1>
        <p className="text-sm text-muted-foreground">
          Bozza del futuro sistema di autenticazione con ruoli e abilitazioni operative.
        </p>
      </div>

      <section className="space-y-5 rounded-md border border-border bg-card p-5">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Accessi operativi</h2>
            <p className="text-sm text-muted-foreground">
              Gestione frontend di ruoli e stato utente, pronta per il futuro login.
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {utenti.map((utente) => (
              <TableRow key={utente.id}>
                <TableCell className="font-medium">{utente.nome}</TableCell>
                <TableCell>{utente.email}</TableCell>
                <TableCell>
                  <Select
                    value={utente.ruolo}
                    onValueChange={(ruolo) =>
                      setUtenti((correnti) =>
                        correnti.map((u) => (u.id === utente.id ? { ...u, ruolo } : u)),
                      )
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Segreteria">Segreteria</SelectItem>
                      <SelectItem value="Laboratorio">Laboratorio</SelectItem>
                      <SelectItem value="Medico">Medico</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant={utente.stato === "attivo" ? "outline" : "default"}
                    onClick={() =>
                      setUtenti((correnti) =>
                        correnti.map((u) =>
                          u.id === utente.id
                            ? { ...u, stato: u.stato === "attivo" ? "sospeso" : "attivo" }
                            : u,
                        ),
                      )
                    }
                  >
                    {utente.stato === "attivo" ? "Attivo" : "Sospeso"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-3">
          {[
            { label: "Segreteria", detail: "Agende, anagrafiche, listini e accettazione" },
            { label: "Laboratorio", detail: "Accettazione laboratorio e refertazione" },
            { label: "Medico", detail: "Agenda personale e prestazioni assegnate" },
          ].map((permesso) => (
            <div key={permesso.label}>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{permesso.label}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{permesso.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
