export type PermissionId =
  | "admin"
  | "laboratorio.accettazione"
  | "laboratorio.accettazione.modena"
  | "laboratorio.accettazione.sassuolo"
  | "laboratorio.agenda"
  | "laboratorio.agenda.modena"
  | "laboratorio.agenda.sassuolo"
  | "laboratorio.listino"
  | "laboratorio.listino.write"
  | "ambulatorio.accettazione"
  | "ambulatorio.accettazione.modena"
  | "ambulatorio.accettazione.sassuolo"
  | "ambulatorio.agenda"
  | "ambulatorio.agenda.modena"
  | "ambulatorio.agenda.sassuolo"
  | "ambulatorio.prestazioni"
  | "ambulatorio.prestazioni.write"
  | "anagrafiche"
  | "infortunistica"
  | "cassa"
  | "cassa.modena"
  | "cassa.sassuolo"
  | "impostazioni"
  | "utenti";

export type AdminRole = {
  id: string;
  nome: string;
  descrizione: string;
  permessi: PermissionId[];
};

export type AdminAccount = {
  id: string;
  nome: string;
  email: string;
  username: string;
  password: string;
  ruoloId: string;
  stato: "attivo" | "sospeso";
  mustChangePassword: boolean;
  hasPassword?: boolean;
  lastLoginAt?: string | null;
};

export type AdminAccessConfig = {
  ruoli: AdminRole[];
  account: AdminAccount[];
};

export const PERMESSI_GRUPPI: Array<{
  titolo: string;
  permessi: Array<{ id: PermissionId; label: string }>;
}> = [
  {
    titolo: "Sistema",
    permessi: [
      { id: "admin", label: "Amministratore completo" },
      { id: "utenti", label: "Utenti e permessi" },
      { id: "impostazioni", label: "Impostazioni" },
    ],
  },
  {
    titolo: "Laboratorio",
    permessi: [
      { id: "laboratorio.accettazione", label: "Accettazione tutte le sedi" },
      { id: "laboratorio.accettazione.modena", label: "Accettazione Modena" },
      { id: "laboratorio.accettazione.sassuolo", label: "Accettazione Sassuolo" },
      { id: "laboratorio.agenda", label: "Agenda tutte le sedi" },
      { id: "laboratorio.agenda.modena", label: "Agenda Modena" },
      { id: "laboratorio.agenda.sassuolo", label: "Agenda Sassuolo" },
      { id: "laboratorio.listino", label: "Listino esami lettura" },
      { id: "laboratorio.listino.write", label: "Listino esami modifica" },
    ],
  },
  {
    titolo: "Ambulatorio",
    permessi: [
      { id: "ambulatorio.accettazione", label: "Accettazione tutte le sedi" },
      { id: "ambulatorio.accettazione.modena", label: "Accettazione Modena" },
      { id: "ambulatorio.accettazione.sassuolo", label: "Accettazione Sassuolo" },
      { id: "ambulatorio.agenda", label: "Agenda tutte le sedi" },
      { id: "ambulatorio.agenda.modena", label: "Agenda Modena" },
      { id: "ambulatorio.agenda.sassuolo", label: "Agenda Sassuolo" },
      { id: "ambulatorio.prestazioni", label: "Prestazioni lettura" },
      { id: "ambulatorio.prestazioni.write", label: "Prestazioni modifica" },
    ],
  },
  {
    titolo: "Studio",
    permessi: [
      { id: "anagrafiche", label: "Anagrafiche" },
      { id: "infortunistica", label: "Infortunistica stradale" },
      { id: "cassa", label: "Cassa tutte le sedi" },
      { id: "cassa.modena", label: "Cassa Modena" },
      { id: "cassa.sassuolo", label: "Cassa Sassuolo" },
    ],
  },
];

export const TUTTI_I_PERMESSI = PERMESSI_GRUPPI.flatMap((gruppo) =>
  gruppo.permessi.map((permesso) => permesso.id),
);

const AGGREGATE_PERMISSION_VARIANTS: Partial<Record<PermissionId, PermissionId[]>> = {
  "laboratorio.accettazione": [
    "laboratorio.accettazione.modena",
    "laboratorio.accettazione.sassuolo",
  ],
  "laboratorio.agenda": [
    "laboratorio.agenda.modena",
    "laboratorio.agenda.sassuolo",
  ],
  "ambulatorio.accettazione": [
    "ambulatorio.accettazione.modena",
    "ambulatorio.accettazione.sassuolo",
  ],
  "ambulatorio.agenda": [
    "ambulatorio.agenda.modena",
    "ambulatorio.agenda.sassuolo",
  ],
};

export const slugAccessId = (value: string, fallback = Date.now()) => {
  const slug = value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || String(fallback);
};

export const permissionListHas = (permissions: PermissionId[], permission: PermissionId) => {
  if (permissions.includes("admin")) return true;
  if (permissions.includes(permission)) return true;
  if (permission === "cassa.modena" || permission === "cassa.sassuolo") return permissions.includes("cassa");
  return AGGREGATE_PERMISSION_VARIANTS[permission]?.some((variant) => permissions.includes(variant)) ?? false;
};

export const getRoleById = (config: AdminAccessConfig, ruoloId: string | null | undefined) =>
  config.ruoli.find((ruolo) => ruolo.id === ruoloId);

export const roleHasPermission = (
  config: AdminAccessConfig,
  ruoloId: string | null | undefined,
  permesso: PermissionId,
) => permissionListHas(getRoleById(config, ruoloId)?.permessi ?? [], permesso);
