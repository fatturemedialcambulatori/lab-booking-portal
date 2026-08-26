import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Car,
  CircleHelp,
  FlaskConical,
  LogOut,
  Settings,
  Stethoscope,
  UserCheck,
  KeyRound,
  Users,
  Save,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Login } from "./Login";
import { AdminExams } from "./AdminExams";
import { AccettazionePaziente } from "./AccettazionePaziente";
import { AdminAnagrafiche } from "./AdminAnagrafiche";
import { AdminBookingCalendar } from "./AdminBookingCalendar";
import { AdminSettings, type SettingsSaveControl } from "./AdminSettings";
import { AdminUsers } from "./AdminUsers";
import { AdminInfortunistica } from "./AdminInfortunistica";
import { AdminCassa } from "./AdminCassa";
import {
  getRoleById,
  readAdminAccessConfig,
  roleHasPermission,
  type AdminAccessConfig,
  type PermissionId,
} from "@/lib/adminAccess";

const getStoredRole = () => {
  try {
    return sessionStorage.getItem("operator_role");
  } catch {
    return null;
  }
};

export default function Admin() {
  const [location, navigate] = useLocation();
  const [accessConfig] = React.useState(readAdminAccessConfig);
  const [role, setRole] = React.useState<string | null>(getStoredRole);

  const handleLogout = () => {
    try {
      sessionStorage.removeItem("operator_role");
    } catch {
      // The app can still logout in memory if browser storage is unavailable.
    }
    setRole(null);
  };

  if (!role) {
    return <Login onSuccess={(r) => setRole(r)} />;
  }

  const roleLabel = getRoleById(accessConfig, role)?.nome ?? role;

  return (
    <AdminDashboard
      accessConfig={accessConfig}
      role={role}
      roleLabel={roleLabel}
      onLogout={handleLogout}
      location={location}
      navigate={navigate}
    />
  );
}

type TabId =
  | "prenotazioni"
  | "accettazione"
  | "listino"
  | "anagrafiche"
  | "infortunistica"
  | "cassa-totale"
  | "cassa-modena"
  | "cassa-sassuolo"
  | "impostazioni"
  | "utenti";
type OperationalAreaId = "laboratorio" | "ambulatorio";
type AreaId = OperationalAreaId | "cassa";
type SettingsTabId = "specialita" | "prestazioni" | "convenzioni" | "medici" | "compensi";

type SettingsTarget = {
  tab: SettingsTabId;
  medicoId: string | null;
  key: number;
};

type MenuItem = {
  id: TabId;
  label: string;
  Icon: LucideIcon;
};

type MenuGroup = {
  id: AreaId;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
  items: MenuItem[];
};

const WORKFLOW_ITEMS: MenuItem[] = [
  { id: "accettazione", label: "Accettazione", Icon: UserCheck },
  { id: "prenotazioni", label: "Agenda", Icon: CalendarDays },
  { id: "listino", label: "Listino Esami", Icon: FlaskConical },
];

const AMBULATORIO_ITEMS: MenuItem[] = WORKFLOW_ITEMS.map((item) =>
  item.id === "listino" ? { ...item, label: "Prestazioni", Icon: Stethoscope } : item,
);

const ANAGRAFICHE_ITEM: MenuItem = { id: "anagrafiche", label: "Anagrafiche", Icon: Users };
const INFORTUNISTICA_ITEM: MenuItem = { id: "infortunistica", label: "Infortunistica stradale", Icon: Car };
const SETTINGS_ITEM: MenuItem = { id: "impostazioni", label: "Impostazioni", Icon: Settings };
const UTENTI_ITEM: MenuItem = { id: "utenti", label: "Utenti", Icon: KeyRound };
const CASSA_ITEMS: MenuItem[] = [
  { id: "cassa-totale", label: "Totale sedi", Icon: WalletCards },
  { id: "cassa-modena", label: "Modena", Icon: WalletCards },
  { id: "cassa-sassuolo", label: "Sassuolo", Icon: WalletCards },
];

const cleanAdminPath = (path: string) => path.split(/[?#]/)[0]?.replace(/\/+$/, "") || "/admin";

const adminPathForTarget = (area: AreaId, tab: TabId) => {
  if (tab === "anagrafiche") return "/admin/anagrafiche";
  if (tab === "infortunistica") return "/admin/infortunistica";
  if (tab === "impostazioni") return "/admin/impostazioni";
  if (tab === "utenti") return "/admin/utenti";

  if (area === "cassa") {
    if (tab === "cassa-modena") return "/admin/cassa/modena";
    if (tab === "cassa-sassuolo") return "/admin/cassa/sassuolo";
    return "/admin/cassa/totale";
  }

  const tabSlug = tab === "prenotazioni" ? "agenda" : area === "ambulatorio" && tab === "listino" ? "prestazioni" : tab;
  return `/admin/${area}/${tabSlug}`;
};

const routeTargetFromPath = (path: string): { area: AreaId; tab: TabId } | null => {
  const cleaned = cleanAdminPath(path);
  if (cleaned === "/admin") return null;

  const parts = cleaned.split("/").filter(Boolean);
  if (parts[0] !== "admin") return null;

  const [section, rawTab] = parts.slice(1);

  if (section === "anagrafiche") return { area: "laboratorio", tab: "anagrafiche" };
  if (section === "infortunistica" || section === "infortunistica-stradale") {
    return { area: "laboratorio", tab: "infortunistica" };
  }
  if (section === "impostazioni") return { area: "laboratorio", tab: "impostazioni" };
  if (section === "utenti") return { area: "laboratorio", tab: "utenti" };

  if (section === "cassa") {
    if (rawTab === "modena") return { area: "cassa", tab: "cassa-modena" };
    if (rawTab === "sassuolo") return { area: "cassa", tab: "cassa-sassuolo" };
    return { area: "cassa", tab: "cassa-totale" };
  }

  if (section !== "laboratorio" && section !== "ambulatorio") return null;
  if (rawTab === "accettazione") return { area: section, tab: "accettazione" };
  if (rawTab === "agenda" || rawTab === "prenotazioni") return { area: section, tab: "prenotazioni" };
  if (section === "laboratorio" && rawTab === "listino") return { area: section, tab: "listino" };
  if (section === "ambulatorio" && (rawTab === "prestazioni" || rawTab === "listino")) {
    return { area: section, tab: "listino" };
  }

  return null;
};

const MENU_GROUPS: MenuGroup[] = [
  {
    id: "laboratorio",
    label: "Laboratorio",
    subtitle: "Analisi e referti",
    Icon: FlaskConical,
    items: WORKFLOW_ITEMS,
  },
  {
    id: "ambulatorio",
    label: "Ambulatorio",
    subtitle: "Visite e prestazioni",
    Icon: UserCheck,
    items: AMBULATORIO_ITEMS,
  },
  {
    id: "cassa",
    label: "Cassa",
    subtitle: "Incassi e chiusure",
    Icon: WalletCards,
    items: CASSA_ITEMS,
  },
];

const permessoVoce = (area: AreaId, tab: TabId): PermissionId | null => {
  if (area === "cassa") {
    if (tab === "cassa-totale") return "cassa";
    if (tab === "cassa-modena") return "cassa.modena";
    if (tab === "cassa-sassuolo") return "cassa.sassuolo";
  }
  if (area === "laboratorio") {
    if (tab === "accettazione") return "laboratorio.accettazione";
    if (tab === "prenotazioni") return "laboratorio.agenda";
    if (tab === "listino") return "laboratorio.listino";
  }
  if (area === "ambulatorio") {
    if (tab === "accettazione") return "ambulatorio.accettazione";
    if (tab === "prenotazioni") return "ambulatorio.agenda";
    if (tab === "listino") return "ambulatorio.prestazioni";
  }
  if (tab === "anagrafiche") return "anagrafiche";
  if (tab === "infortunistica") return "infortunistica";
  if (tab === "impostazioni") return "impostazioni";
  if (tab === "utenti") return "utenti";
  return null;
};

function AdminDashboard({
  accessConfig,
  role,
  roleLabel,
  onLogout,
  location,
  navigate,
}: {
  accessConfig: AdminAccessConfig;
  role: string;
  roleLabel: string;
  onLogout: () => void;
  location: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}) {
  const initialTarget = React.useMemo(() => routeTargetFromPath(location), [location]);
  const [activeArea, setActiveArea] = React.useState<AreaId>(initialTarget?.area ?? "laboratorio");
  const [activeTab, setActiveTab] = React.useState<TabId>(initialTarget?.tab ?? "accettazione");
  const [settingsSaveControl, setSettingsSaveControl] = React.useState<SettingsSaveControl | null>(null);
  const [settingsTarget, setSettingsTarget] = React.useState<SettingsTarget>({
    tab: "prestazioni",
    medicoId: null,
    key: 0,
  });

  const can = React.useCallback(
    (permission: PermissionId) => roleHasPermission(accessConfig, role, permission),
    [accessConfig, role],
  );

  const setActiveTarget = React.useCallback(
    (area: AreaId, tab: TabId, options?: { replace?: boolean }) => {
      setActiveArea(area);
      setActiveTab(tab);
      const nextPath = adminPathForTarget(area, tab);
      if (cleanAdminPath(location) !== nextPath) {
        navigate(nextPath, options);
      }
    },
    [location, navigate],
  );

  const visibleMenuGroups = React.useMemo(
    () =>
      MENU_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const permission = permessoVoce(group.id, item.id);
          return permission ? can(permission) : false;
        }),
      })).filter((group) => group.items.length > 0),
    [can],
  );

  const firstAllowedTarget = React.useMemo(() => {
    const firstGroup = visibleMenuGroups[0];
    if (firstGroup?.items[0]) return { area: firstGroup.id, tab: firstGroup.items[0].id };
    if (can("anagrafiche")) return { area: "laboratorio" as AreaId, tab: "anagrafiche" as TabId };
    if (can("infortunistica")) return { area: "laboratorio" as AreaId, tab: "infortunistica" as TabId };
    if (can("impostazioni")) return { area: "laboratorio" as AreaId, tab: "impostazioni" as TabId };
    if (can("utenti")) return { area: "laboratorio" as AreaId, tab: "utenti" as TabId };
    return null;
  }, [can, visibleMenuGroups]);

  React.useEffect(() => {
    const routeTarget = routeTargetFromPath(location);
    if (!routeTarget) return;
    setActiveArea(routeTarget.area);
    setActiveTab(routeTarget.tab);
  }, [location]);

  React.useEffect(() => {
    const permission = permessoVoce(activeArea, activeTab);
    if (permission && can(permission)) return;
    if (!permission && activeTab === "anagrafiche" && can("anagrafiche")) return;
    if (!permission && activeTab === "infortunistica" && can("infortunistica")) return;
    if (!permission && activeTab === "impostazioni" && can("impostazioni")) return;
    if (!permission && activeTab === "utenti" && can("utenti")) return;
    if (!firstAllowedTarget) return;
    setActiveTarget(firstAllowedTarget.area, firstAllowedTarget.tab, { replace: true });
  }, [activeArea, activeTab, can, firstAllowedTarget, setActiveTarget]);

  React.useEffect(() => {
    const routeTarget = routeTargetFromPath(location);
    if (routeTarget || !firstAllowedTarget) return;
    setActiveTarget(firstAllowedTarget.area, firstAllowedTarget.tab, { replace: true });
  }, [firstAllowedTarget, location, setActiveTarget]);

  const activeGroup =
    visibleMenuGroups.find((group) => group.id === activeArea) ?? visibleMenuGroups[0] ?? MENU_GROUPS[0];
  const isAreaScopedTab =
    activeTab !== "impostazioni" &&
    activeTab !== "anagrafiche" &&
    activeTab !== "infortunistica" &&
    activeTab !== "utenti";
  const activeItem = activeTab === "impostazioni"
    ? SETTINGS_ITEM
    : activeTab === "utenti"
      ? UTENTI_ITEM
    : activeTab === "infortunistica"
      ? INFORTUNISTICA_ITEM
    : activeTab === "anagrafiche"
      ? ANAGRAFICHE_ITEM
      : activeGroup.items.find((item) => item.id === activeTab) ?? activeGroup.items[0];
  const activeSectionLabel = activeTab === "impostazioni"
    ? "Segreteria"
    : activeTab === "utenti"
      ? "Segreteria"
    : activeTab === "infortunistica"
      ? "Studio"
    : activeTab === "anagrafiche"
      ? "Studio"
      : activeGroup.label;

  const apriProfiloMedico = (medicoId: string) => {
    setSettingsTarget({ tab: "medici", medicoId, key: Date.now() });
    setActiveTarget(activeArea, "impostazioni");
  };
  const isCassaTab = activeTab.startsWith("cassa-");
  const showSettingsSave = activeTab === "impostazioni";
  const settingsSaveEnabled = Boolean(settingsSaveControl?.canSave);
  const isReadOnlyLaboratoryListino = activeArea === "laboratorio" && role === "segreteria";
  const settingsSaving = settingsSaveControl?.state === "saving";
  const settingsSaveButtonClass = settingsSaveEnabled
    ? "gap-2 border-slate-950 bg-slate-950 text-white hover:bg-slate-900 hover:text-white"
    : "gap-2 cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-100 hover:bg-slate-100 hover:text-slate-400 disabled:opacity-100";
  const railMainItems = visibleMenuGroups.flatMap((group) =>
    group.items.map((item) => ({
      key: `${group.id}-${item.id}`,
      label: `${group.label} · ${item.label}`,
      Icon: item.Icon,
      active: isAreaScopedTab && activeArea === group.id && activeTab === item.id,
      onClick: () => setActiveTarget(group.id, item.id),
    })),
  );
  const railSecondaryItems = [
    can("anagrafiche")
      ? {
          key: "anagrafiche",
          label: "Anagrafiche",
          Icon: Users,
          active: activeTab === "anagrafiche",
          onClick: () => setActiveTarget(activeArea, "anagrafiche"),
        }
      : null,
    can("infortunistica")
      ? {
          key: "infortunistica",
          label: "Infortunistica stradale",
          Icon: Car,
          active: activeTab === "infortunistica",
          onClick: () => setActiveTarget(activeArea, "infortunistica"),
        }
      : null,
    can("impostazioni")
      ? {
          key: "impostazioni",
          label: "Impostazioni",
          Icon: Settings,
          active: activeTab === "impostazioni",
          onClick: () => {
            setSettingsTarget({ tab: "prestazioni", medicoId: null, key: Date.now() });
            setActiveTarget(activeArea, "impostazioni");
          },
        }
      : null,
    can("utenti")
      ? {
          key: "utenti",
          label: "Utenti",
          Icon: KeyRound,
          active: activeTab === "utenti",
          onClick: () => setActiveTarget(activeArea, "utenti"),
        }
      : null,
  ].filter((item): item is {
    key: string;
    label: string;
    Icon: LucideIcon;
    active: boolean;
    onClick: () => void;
  } => Boolean(item));

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside
        className={`${isCassaTab ? "hidden md:flex" : "flex"} fixed inset-x-0 bottom-0 z-40 h-16 border-t border-border bg-white md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:h-screen md:w-20 md:shrink-0 md:flex-col md:border-r md:border-t-0`}
      >
        <div className="hidden h-16 items-center justify-center border-b border-border md:flex">
          <button
            type="button"
            onClick={() => firstAllowedTarget && setActiveTarget(firstAllowedTarget.area, firstAllowedTarget.tab)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
            title="M Medical"
            aria-label="M Medical"
          >
            <span className="text-3xl font-black leading-none">+</span>
          </button>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 md:flex-col md:items-center md:overflow-y-auto md:overflow-x-hidden md:py-4" aria-label="Menu principale">
          {[...railMainItems, ...railSecondaryItems].map(({ key, label, Icon, active, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              aria-current={active ? "page" : undefined}
              title={label}
              aria-label={label}
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-md transition-colors ${
                active
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.14)]"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {active && <span className="absolute left-0 hidden h-7 w-0.5 rounded-r bg-primary md:block" />}
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </nav>

        <div className="hidden border-t border-border px-2 py-3 md:block">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navigate("/")}
              title="Portale pazienti"
              aria-label="Portale pazienti"
              className="flex h-11 w-full items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              title="Notifiche"
              aria-label="Notifiche"
              className="relative flex h-11 w-full items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-1.5 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">9+</span>
            </button>
            <button
              type="button"
              title="Aiuto"
              aria-label="Aiuto"
              className="flex h-11 w-full items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <CircleHelp className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              title={`Esci · ${roleLabel}`}
              aria-label="Esci"
              className="flex h-11 w-full items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {showSettingsSave && (
          <div className="sticky top-0 z-30 flex justify-end border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => settingsSaveControl?.onSave()}
              disabled={!settingsSaveEnabled || settingsSaving}
              className={settingsSaveButtonClass}
            >
              <Save className={`h-3.5 w-3.5 ${settingsSaving ? "animate-pulse" : ""}`} />
              {settingsSaving ? "Salvo..." : "Salva"}
            </Button>
          </div>
        )}

        <main className={`flex-1 pb-20 md:pb-0 ${activeTab === "prenotazioni" ? "p-0" : isCassaTab ? "px-3 py-4 sm:px-6 sm:py-8" : "px-5 py-7 sm:px-8"}`}>
          <div className={activeTab === "prenotazioni" ? "h-full" : "mx-auto max-w-[1560px]"}>
            {!firstAllowedTarget && (
              <div className="rounded-md border border-border bg-white p-6 text-sm text-muted-foreground">
                Nessuna sezione abilitata per questo ruolo.
              </div>
            )}

            {activeTab === "accettazione" && (
              <AccettazionePaziente
                role={role}
                area={activeArea === "ambulatorio" ? "ambulatorio" : "laboratorio"}
              />
            )}

            {activeTab === "anagrafiche" && <AdminAnagrafiche />}

            {activeTab === "infortunistica" && <AdminInfortunistica />}

            {activeTab === "impostazioni" && (
              <AdminSettings
                initialTab={settingsTarget.tab}
                initialMedicoId={settingsTarget.medicoId}
                focusKey={settingsTarget.key}
                onSaveControlChange={setSettingsSaveControl}
              />
            )}

            {activeTab === "utenti" && <AdminUsers />}

            {activeTab === "prenotazioni" && (
              <AdminBookingCalendar
                area={activeArea === "ambulatorio" ? "ambulatorio" : "laboratorio"}
                onOpenDoctor={apriProfiloMedico}
              />
            )}

            {activeTab === "listino" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">{activeItem.label}</h1>
                  <p className="text-muted-foreground text-sm">
                    {isReadOnlyLaboratoryListino
                      ? "Consulta il catalogo degli esami del laboratorio."
                      : `Gestisci il catalogo ${activeArea === "ambulatorio" ? "delle prestazioni" : "degli esami"} del modulo ${activeGroup.label.toLowerCase()}.`}
                  </p>
                </div>
                <AdminExams readOnly={isReadOnlyLaboratoryListino} />
              </div>
            )}

            {activeTab === "cassa-totale" && <AdminCassa scope="tutte" />}

            {activeTab === "cassa-modena" && <AdminCassa scope="modena" />}

            {activeTab === "cassa-sassuolo" && <AdminCassa scope="sassuolo" />}

          </div>
        </main>
      </div>
    </div>
  );
}
