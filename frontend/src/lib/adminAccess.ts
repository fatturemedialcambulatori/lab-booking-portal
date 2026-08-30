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
};

export type AdminAccessConfig = {
  ruoli: AdminRole[];
  account: AdminAccount[];
};

export const ADMIN_ACCESS_STORAGE_KEY = "mmedical_admin_access_v1";

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

const DEFAULT_ROLE_IDS = new Set([
  "admin",
  "segreteria-modena",
  "segreteria-sassuolo",
  "laboratorio-modena",
  "laboratorio-sassuolo",
  "ambulatorio-modena",
  "ambulatorio-sassuolo",
]);

const LEGACY_DEFAULT_ROLE_IDS = new Set([
  "segreteria",
  "laboratorio",
  "medico",
  "avvocato",
  "amministrazione",
]);

const LEGACY_DEFAULT_ACCOUNT_IDS = new Set([
  "segreteria",
  "laboratorio",
  "medico",
  "avvocato",
  "amministrazione",
]);

const DEFAULT_ACCESS_CONFIG: AdminAccessConfig = {
  ruoli: [
    {
      id: "admin",
      nome: "Admin",
      descrizione: "Accesso completo a tutte le sedi, sezioni e operazioni.",
      permessi: TUTTI_I_PERMESSI,
    },
    {
      id: "segreteria-modena",
      nome: "Segreteria Modena",
      descrizione: "Operativita Modena; agenda ambulatoriale visibile e scrivibile su entrambe le sedi.",
      permessi: [
        "laboratorio.accettazione.modena",
        "laboratorio.agenda.modena",
        "laboratorio.agenda.sassuolo",
        "ambulatorio.accettazione.modena",
        "ambulatorio.agenda.modena",
        "ambulatorio.agenda.sassuolo",
        "cassa.modena",
      ],
    },
    {
      id: "segreteria-sassuolo",
      nome: "Segreteria Sassuolo",
      descrizione: "Operativita Sassuolo; agenda ambulatoriale visibile e scrivibile su entrambe le sedi.",
      permessi: [
        "laboratorio.accettazione.sassuolo",
        "laboratorio.agenda.modena",
        "laboratorio.agenda.sassuolo",
        "ambulatorio.accettazione.sassuolo",
        "ambulatorio.agenda.modena",
        "ambulatorio.agenda.sassuolo",
        "cassa.sassuolo",
      ],
    },
    {
      id: "laboratorio-modena",
      nome: "Laboratorio Modena",
      descrizione: "Accesso operativo limitato al laboratorio della sede di Modena.",
      permessi: ["laboratorio.accettazione.modena", "laboratorio.listino"],
    },
    {
      id: "laboratorio-sassuolo",
      nome: "Laboratorio Sassuolo",
      descrizione: "Accesso operativo limitato al laboratorio della sede di Sassuolo.",
      permessi: ["laboratorio.accettazione.sassuolo", "laboratorio.listino"],
    },
    {
      id: "ambulatorio-modena",
      nome: "Ambulatorio Modena",
      descrizione: "Accesso operativo limitato all'ambulatorio della sede di Modena.",
      permessi: [
        "ambulatorio.accettazione.modena",
        "ambulatorio.agenda.modena",
        "ambulatorio.prestazioni",
      ],
    },
    {
      id: "ambulatorio-sassuolo",
      nome: "Ambulatorio Sassuolo",
      descrizione: "Accesso operativo limitato all'ambulatorio della sede di Sassuolo.",
      permessi: [
        "ambulatorio.accettazione.sassuolo",
        "ambulatorio.agenda.sassuolo",
        "ambulatorio.prestazioni",
      ],
    },
  ],
  account: [
    {
      id: "admin",
      nome: "Admin",
      email: "admin@mmedical.local",
      username: "admin",
      password: "",
      ruoloId: "admin",
      stato: "attivo",
    },
    {
      id: "segreteria-modena",
      nome: "Segreteria Modena",
      email: "segreteria.modena@mmedical.local",
      username: "segreteria-modena",
      password: "",
      ruoloId: "segreteria-modena",
      stato: "attivo",
    },
    {
      id: "segreteria-sassuolo",
      nome: "Segreteria Sassuolo",
      email: "segreteria.sassuolo@mmedical.local",
      username: "segreteria-sassuolo",
      password: "",
      ruoloId: "segreteria-sassuolo",
      stato: "attivo",
    },
    {
      id: "laboratorio-modena",
      nome: "Laboratorio Modena",
      email: "laboratorio.modena@mmedical.local",
      username: "laboratorio-modena",
      password: "",
      ruoloId: "laboratorio-modena",
      stato: "attivo",
    },
    {
      id: "laboratorio-sassuolo",
      nome: "Laboratorio Sassuolo",
      email: "laboratorio.sassuolo@mmedical.local",
      username: "laboratorio-sassuolo",
      password: "",
      ruoloId: "laboratorio-sassuolo",
      stato: "attivo",
    },
    {
      id: "ambulatorio-modena",
      nome: "Ambulatorio Modena",
      email: "ambulatorio.modena@mmedical.local",
      username: "ambulatorio-modena",
      password: "",
      ruoloId: "ambulatorio-modena",
      stato: "attivo",
    },
    {
      id: "ambulatorio-sassuolo",
      nome: "Ambulatorio Sassuolo",
      email: "ambulatorio.sassuolo@mmedical.local",
      username: "ambulatorio-sassuolo",
      password: "",
      ruoloId: "ambulatorio-sassuolo",
      stato: "attivo",
    },
  ],
};

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

const mergeDefaultAccessConfig = (config: AdminAccessConfig): AdminAccessConfig => {
  const customRoles = config.ruoli.filter(
    (ruolo) => !DEFAULT_ROLE_IDS.has(ruolo.id) && !LEGACY_DEFAULT_ROLE_IDS.has(ruolo.id),
  );
  const ruoli = [
    ...DEFAULT_ACCESS_CONFIG.ruoli.map((ruoloDefault) => ({
      ...ruoloDefault,
      permessi: [...ruoloDefault.permessi],
    })),
    ...customRoles,
  ];

  const customAccounts = config.account.filter(
    (account) => !DEFAULT_ROLE_IDS.has(account.id) && !LEGACY_DEFAULT_ACCOUNT_IDS.has(account.id),
  );
  const account = [
    ...DEFAULT_ACCESS_CONFIG.account.map((accountDefault) => ({ ...accountDefault })),
    ...customAccounts,
  ];

  return { ...config, ruoli, account };
};

export const readAdminAccessConfig = (): AdminAccessConfig => {
  if (typeof window === "undefined") return DEFAULT_ACCESS_CONFIG;

  try {
    const raw = window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESS_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AdminAccessConfig>;
    if (!Array.isArray(parsed.ruoli) || !Array.isArray(parsed.account)) return DEFAULT_ACCESS_CONFIG;
    return mergeDefaultAccessConfig({ ruoli: parsed.ruoli, account: parsed.account });
  } catch {
    return DEFAULT_ACCESS_CONFIG;
  }
};

export const writeAdminAccessConfig = (config: AdminAccessConfig) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, JSON.stringify(config));
};

export const getRoleById = (config: AdminAccessConfig, ruoloId: string | null | undefined) =>
  config.ruoli.find((ruolo) => ruolo.id === ruoloId);

export const getAccountByUsername = (config: AdminAccessConfig, username: string) =>
  config.account.find((account) => account.username === username);

export const roleHasPermission = (
  config: AdminAccessConfig,
  ruoloId: string | null | undefined,
  permesso: PermissionId,
) => permissionListHas(getRoleById(config, ruoloId)?.permessi ?? [], permesso);
