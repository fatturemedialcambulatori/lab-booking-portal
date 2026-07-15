export type PermissionId =
  | "laboratorio.accettazione"
  | "laboratorio.agenda"
  | "laboratorio.listino"
  | "ambulatorio.accettazione"
  | "ambulatorio.agenda"
  | "ambulatorio.prestazioni"
  | "anagrafiche"
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
    titolo: "Laboratorio",
    permessi: [
      { id: "laboratorio.accettazione", label: "Accettazione" },
      { id: "laboratorio.agenda", label: "Agenda" },
      { id: "laboratorio.listino", label: "Listino esami" },
    ],
  },
  {
    titolo: "Ambulatorio",
    permessi: [
      { id: "ambulatorio.accettazione", label: "Accettazione" },
      { id: "ambulatorio.agenda", label: "Agenda" },
      { id: "ambulatorio.prestazioni", label: "Prestazioni" },
    ],
  },
  {
    titolo: "Studio",
    permessi: [
      { id: "anagrafiche", label: "Anagrafiche" },
      { id: "impostazioni", label: "Impostazioni" },
      { id: "utenti", label: "Utenti e permessi" },
    ],
  },
];

export const TUTTI_I_PERMESSI = PERMESSI_GRUPPI.flatMap((gruppo) =>
  gruppo.permessi.map((permesso) => permesso.id),
);

const DEFAULT_ACCESS_CONFIG: AdminAccessConfig = {
  ruoli: [
    {
      id: "segreteria",
      nome: "Segreteria",
      descrizione: "Gestione operativa completa dello studio.",
      permessi: TUTTI_I_PERMESSI,
    },
    {
      id: "laboratorio",
      nome: "Laboratorio",
      descrizione: "Area laboratorio, agenda e refertazione operativa.",
      permessi: ["laboratorio.accettazione", "laboratorio.agenda", "laboratorio.listino", "anagrafiche"],
    },
    {
      id: "medico",
      nome: "Medico",
      descrizione: "Accesso alla sola agenda/prestazioni assegnate.",
      permessi: ["ambulatorio.agenda"],
    },
    {
      id: "avvocato",
      nome: "Avvocato",
      descrizione: "Consultazione anagrafiche e dati essenziali.",
      permessi: ["anagrafiche"],
    },
    {
      id: "amministrazione",
      nome: "Amministrazione",
      descrizione: "Gestione amministrativa e impostazioni.",
      permessi: ["anagrafiche", "impostazioni"],
    },
    {
      id: "admin",
      nome: "Amministratore",
      descrizione: "Accesso tecnico completo.",
      permessi: TUTTI_I_PERMESSI,
    },
  ],
  account: [
    {
      id: "segreteria",
      nome: "Segreteria",
      email: "segreteria@mmedical.local",
      username: "segreteria",
      password: "Corona!20",
      ruoloId: "segreteria",
      stato: "attivo",
    },
    {
      id: "laboratorio",
      nome: "Laboratorio",
      email: "laboratorio@mmedical.local",
      username: "laboratorio",
      password: "Corona!26",
      ruoloId: "laboratorio",
      stato: "attivo",
    },
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

const mergeDefaultRuoli = (config: AdminAccessConfig): AdminAccessConfig => {
  const ruoli = [...config.ruoli];
  DEFAULT_ACCESS_CONFIG.ruoli.forEach((ruoloDefault) => {
    if (!ruoli.some((ruolo) => ruolo.id === ruoloDefault.id)) ruoli.push(ruoloDefault);
  });
  return { ...config, ruoli };
};

export const readAdminAccessConfig = (): AdminAccessConfig => {
  if (typeof window === "undefined") return DEFAULT_ACCESS_CONFIG;

  try {
    const raw = window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESS_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AdminAccessConfig>;
    if (!Array.isArray(parsed.ruoli) || !Array.isArray(parsed.account)) return DEFAULT_ACCESS_CONFIG;
    return mergeDefaultRuoli({ ruoli: parsed.ruoli, account: parsed.account });
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
) => Boolean(getRoleById(config, ruoloId)?.permessi.includes(permesso));
