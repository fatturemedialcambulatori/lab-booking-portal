import React from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  PERMESSI_GRUPPI,
  TUTTI_I_PERMESSI,
  readAdminAccessConfig,
  slugAccessId,
  writeAdminAccessConfig,
  type AdminAccessConfig,
  type AdminAccount,
  type AdminRole,
  type PermissionId,
} from "@/lib/adminAccess";

const ruoloVuoto = (): AdminRole => ({
  id: "",
  nome: "",
  descrizione: "",
  permessi: [],
});

const accountVuoto = (ruoloId = ""): AdminAccount => ({
  id: "",
  nome: "",
  email: "",
  username: "",
  password: "",
  ruoloId,
  stato: "attivo",
});

export function AdminUsers() {
  const [config, setConfig] = React.useState<AdminAccessConfig>(readAdminAccessConfig);
  const [roleDialogOpen, setRoleDialogOpen] = React.useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = React.useState(false);
  const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = React.useState<string | null>(null);
  const [accountDaEliminareId, setAccountDaEliminareId] = React.useState<string | null>(null);
  const [roleForm, setRoleForm] = React.useState<AdminRole>(ruoloVuoto);
  const [accountForm, setAccountForm] = React.useState<AdminAccount>(() =>
    accountVuoto(config.ruoli[0]?.id ?? ""),
  );
  const accountDaEliminare = config.account.find((account) => account.id === accountDaEliminareId) ?? null;

  const salvaConfig = (updater: (corrente: AdminAccessConfig) => AdminAccessConfig) => {
    setConfig((corrente) => {
      const prossima = updater(corrente);
      writeAdminAccessConfig(prossima);
      return prossima;
    });
  };

  const apriNuovoRuolo = () => {
    setEditingRoleId(null);
    setRoleForm(ruoloVuoto());
    setRoleDialogOpen(true);
  };

  const apriModificaRuolo = (ruolo: AdminRole) => {
    setEditingRoleId(ruolo.id);
    setRoleForm({ ...ruolo, permessi: [...ruolo.permessi] });
    setRoleDialogOpen(true);
  };

  const salvaRuolo = () => {
    const nome = roleForm.nome.trim();
    if (!nome) return;
    const id = editingRoleId ?? slugAccessId(nome);
    const ruolo: AdminRole = {
      id,
      nome,
      descrizione: roleForm.descrizione.trim(),
      permessi: roleForm.permessi,
    };

    salvaConfig((corrente) => ({
      ...corrente,
      ruoli: editingRoleId
        ? corrente.ruoli.map((item) => (item.id === editingRoleId ? ruolo : item))
        : [...corrente.ruoli, ruolo],
    }));
    setRoleDialogOpen(false);
  };

  const apriNuovoAccount = () => {
    setEditingAccountId(null);
    setAccountForm(accountVuoto(config.ruoli[0]?.id ?? ""));
    setAccountDialogOpen(true);
  };

  const apriModificaAccount = (account: AdminAccount) => {
    setEditingAccountId(account.id);
    setAccountForm({ ...account });
    setAccountDialogOpen(true);
  };

  const salvaAccount = () => {
    const nome = accountForm.nome.trim();
    const username = accountForm.username.trim();
    const password = accountForm.password.trim();
    if (!nome || !username || !password || !accountForm.ruoloId) return;

    const nuovoAccount: AdminAccount = {
      ...accountForm,
      id: editingAccountId ?? `account-${slugAccessId(username)}`,
      nome,
      username,
      email: accountForm.email.trim(),
      password,
    };

    salvaConfig((corrente) => ({
      ...corrente,
      account: editingAccountId
        ? corrente.account.map((item) => (item.id === editingAccountId ? nuovoAccount : item))
        : [...corrente.account.filter((item) => item.username !== username), nuovoAccount],
    }));
    setEditingAccountId(null);
    setAccountDialogOpen(false);
  };

  const eliminaAccount = () => {
    if (!accountDaEliminare) return;
    salvaConfig((corrente) => ({
      ...corrente,
      account: corrente.account.filter((account) => account.id !== accountDaEliminare.id),
    }));
    setAccountDaEliminareId(null);
  };

  const togglePermesso = (permesso: PermissionId, checked: boolean) => {
    setRoleForm((corrente) => ({
      ...corrente,
      permessi: checked
        ? Array.from(new Set([...corrente.permessi, permesso]))
        : corrente.permessi.filter((item) => item !== permesso),
    }));
  };

  const nomeRuolo = (ruoloId: string) =>
    config.ruoli.find((ruolo) => ruolo.id === ruoloId)?.nome ?? "Ruolo non trovato";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Account e permessi</h1>
          <p className="text-sm text-muted-foreground">
            Crea ruoli, scegli cosa possono vedere e assegna gli account operativi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={apriNuovoRuolo} className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Nuovo ruolo
          </Button>
          <Button type="button" onClick={apriNuovoAccount} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuovo account
          </Button>
        </div>
      </div>

      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Ruoli</h2>
            <p className="text-sm text-muted-foreground">
              Ogni ruolo controlla le voci visibili nel menu del gestionale.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {config.ruoli.map((ruolo) => (
            <div key={ruolo.id} className="rounded-md border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{ruolo.nome}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ruolo.descrizione || "Nessuna descrizione."}
                  </p>
                </div>
                <Badge variant="secondary">{ruolo.permessi.length} permessi</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ruolo.permessi.slice(0, 5).map((permesso) => (
                  <Badge key={permesso} variant="outline" className="text-xs">
                    {permesso}
                  </Badge>
                ))}
                {ruolo.permessi.length > 5 && <Badge variant="outline">+{ruolo.permessi.length - 5}</Badge>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => apriModificaRuolo(ruolo)} className="mt-4">
                Modifica permessi
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Account</h2>
            <p className="text-sm text-muted-foreground">
              Ogni account usa il ruolo assegnato per mostrare o nascondere le sezioni.
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-24">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {config.account.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <p className="font-medium">{account.nome}</p>
                  <p className="text-xs text-muted-foreground">{account.email || "-"}</p>
                </TableCell>
                <TableCell>{account.username}</TableCell>
                <TableCell>
                  <Select
                    value={account.ruoloId}
                    onValueChange={(ruoloId) =>
                      salvaConfig((corrente) => ({
                        ...corrente,
                        account: corrente.account.map((item) =>
                          item.id === account.id ? { ...item, ruoloId } : item,
                        ),
                      }))
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {config.ruoli.map((ruolo) => (
                        <SelectItem key={ruolo.id} value={ruolo.id}>
                          {ruolo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant={account.stato === "attivo" ? "outline" : "default"}
                    onClick={() =>
                      salvaConfig((corrente) => ({
                        ...corrente,
                        account: corrente.account.map((item) =>
                          item.id === account.id
                            ? { ...item, stato: item.stato === "attivo" ? "sospeso" : "attivo" }
                            : item,
                        ),
                      }))
                    }
                  >
                    {account.stato === "attivo" ? "Attivo" : "Sospeso"}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => apriModificaAccount(account)}
                      title="Modifica account"
                      aria-label={`Modifica ${account.nome}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setAccountDaEliminareId(account.id)}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Elimina account"
                      aria-label={`Elimina ${account.nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRoleId ? "Modifica ruolo" : "Nuovo ruolo"}</DialogTitle>
            <DialogDescription>
              Spunta le sezioni che questo ruolo puo vedere nel gestionale.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3">
              <Field label="Nome ruolo">
                <Input
                  value={roleForm.nome}
                  onChange={(event) => setRoleForm((corrente) => ({ ...corrente, nome: event.target.value }))}
                  placeholder="Es. Medico, Avvocato, Amministrazione"
                />
              </Field>
              <Field label="Descrizione">
                <Input
                  value={roleForm.descrizione}
                  onChange={(event) =>
                    setRoleForm((corrente) => ({ ...corrente, descrizione: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleForm((corrente) => ({ ...corrente, permessi: TUTTI_I_PERMESSI }))}
              >
                Seleziona tutto
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleForm((corrente) => ({ ...corrente, permessi: [] }))}
              >
                Deseleziona tutto
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {PERMESSI_GRUPPI.map((gruppo) => (
              <div key={gruppo.titolo} className="rounded-md border border-border bg-muted/20 p-3">
                <h3 className="text-sm font-semibold text-foreground">{gruppo.titolo}</h3>
                <div className="mt-3 space-y-3">
                  {gruppo.permessi.map((permesso) => (
                    <label key={permesso.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={roleForm.permessi.includes(permesso.id)}
                        onCheckedChange={(checked) => togglePermesso(permesso.id, Boolean(checked))}
                      />
                      <span>{permesso.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={salvaRuolo}>
              Salva ruolo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={accountDialogOpen}
        onOpenChange={(open) => {
          setAccountDialogOpen(open);
          if (!open) setEditingAccountId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingAccountId ? "Modifica account" : "Nuovo account"}</DialogTitle>
            <DialogDescription>
              {editingAccountId
                ? "Aggiorna dati, password, stato e ruolo associato all'account."
                : "Crea l'account e associa il ruolo che determina le sezioni visibili."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome">
              <Input
                value={accountForm.nome}
                onChange={(event) =>
                  setAccountForm((corrente) => ({ ...corrente, nome: event.target.value }))
                }
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={accountForm.email}
                onChange={(event) =>
                  setAccountForm((corrente) => ({ ...corrente, email: event.target.value }))
                }
              />
            </Field>
            <Field label="Username">
              <Input
                value={accountForm.username}
                onChange={(event) =>
                  setAccountForm((corrente) => ({ ...corrente, username: event.target.value }))
                }
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={accountForm.password}
                onChange={(event) =>
                  setAccountForm((corrente) => ({ ...corrente, password: event.target.value }))
                }
              />
            </Field>
            <Field label="Ruolo">
              <Select
                value={accountForm.ruoloId}
                onValueChange={(ruoloId) => setAccountForm((corrente) => ({ ...corrente, ruoloId }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.ruoli.map((ruolo) => (
                    <SelectItem key={ruolo.id} value={ruolo.id}>
                      {ruolo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              <KeyRound className="mb-2 h-4 w-4 text-primary" />
              Vedra le sezioni abilitate per il ruolo {nomeRuolo(accountForm.ruoloId)}.
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={salvaAccount}>
              {editingAccountId ? "Salva account" : "Crea account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(accountDaEliminare)}
        onOpenChange={(open) => {
          if (!open) setAccountDaEliminareId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo account?</AlertDialogTitle>
            <AlertDialogDescription>
              {accountDaEliminare
                ? `${accountDaEliminare.nome} non potra piu accedere con username ${accountDaEliminare.username}.`
                : "L'account selezionato verra eliminato."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={eliminaAccount} className="bg-destructive text-destructive-foreground">
              Elimina account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
