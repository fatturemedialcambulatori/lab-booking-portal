import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  Car,
  CircleHelp,
  FileText,
  FlaskConical,
  LogOut,
  Settings,
  Stethoscope,
  UserCheck,
  KeyRound,
  Users,
  Save,
  ReceiptText,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Login, type AuthUser } from "./Login";
import { AdminExams } from "./AdminExams";
import { AccettazionePaziente } from "./AccettazionePaziente";
import { AdminAnagrafiche } from "./AdminAnagrafiche";
import { AdminAmbulatorioOrganization, AdminBookingCalendar } from "./AdminBookingCalendar";
import { AdminSettings, type SettingsSaveControl } from "./AdminSettings";
import { AdminUsers } from "./AdminUsers";
import { AdminInfortunistica } from "./AdminInfortunistica";
import { AdminCassa } from "./AdminCassa";
import { AdminPagamenti } from "./AdminPagamenti";
import { AdminFatturazione } from "./AdminFatturazione";
import {
  permissionListHas,
  type PermissionId,
} from "@/lib/adminAccess";

export default function Admin() {
  const [location, navigate] = useLocation();
  const [authUser, setAuthUser] = React.useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json() as { user?: AuthUser };
        return data.user ?? null;
      })
      .then((user) => {
        if (!cancelled) setAuthUser(user);
      })
      .catch(() => {
        if (!cancelled) setAuthUser(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    try {
      sessionStorage.removeItem("operator_role");
      sessionStorage.removeItem("operator_account_username");
    } catch {
      // The app can still logout in memory if browser storage is unavailable.
    }
    setAuthUser(null);
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
        Verifica sessione operatore...
      </div>
    );
  }

  if (!authUser) {
    return <Login onSuccess={(user) => setAuthUser(user)} />;
  }

  const role = authUser.roleId;
  const roleLabel = authUser.roleName || role;

  return (
    <AdminDashboard
      role={role}
      roleLabel={roleLabel}
      permissions={authUser.permissions}
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
  | "organizzazione-ambulatorio"
  | "anagrafiche"
  | "infortunistica"
  | "cassa-totale"
  | "cassa-pagamenti"
  | "cassa-fatturazione"
  | "cassa-modena"
  | "cassa-sassuolo"
  | "impostazioni"
  | "utenti";
type OperationalAreaId = "laboratorio" | "ambulatorio";
type AreaId = OperationalAreaId | "cassa";
type SettingsTabId = "specialita" | "prestazioni" | "convenzioni" | "risorse" | "medici" | "compensi";

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

const AMBULATORIO_ITEMS: MenuItem[] = [
  { id: "accettazione", label: "Accettazione", Icon: UserCheck },
  { id: "prenotazioni", label: "Agenda", Icon: CalendarDays },
  { id: "organizzazione-ambulatorio", label: "Organizzazione", Icon: Building2 },
  { id: "listino", label: "Prestazioni", Icon: Stethoscope },
];

const ANAGRAFICHE_ITEM: MenuItem = { id: "anagrafiche", label: "Anagrafiche", Icon: Users };
const INFORTUNISTICA_ITEM: MenuItem = { id: "infortunistica", label: "Infortunistica stradale", Icon: Car };
const SETTINGS_ITEM: MenuItem = { id: "impostazioni", label: "Impostazioni", Icon: Settings };
const UTENTI_ITEM: MenuItem = { id: "utenti", label: "Utenti", Icon: KeyRound };
const CASSA_ITEMS: MenuItem[] = [
  { id: "cassa-totale", label: "Totale sedi", Icon: WalletCards },
  { id: "cassa-pagamenti", label: "Pagamenti", Icon: ReceiptText },
  { id: "cassa-fatturazione", label: "Fatturazione", Icon: FileText },
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
    if (tab === "cassa-pagamenti") return "/admin/cassa/pagamenti";
    if (tab === "cassa-fatturazione") return "/admin/cassa/fatturazione";
    if (tab === "cassa-modena") return "/admin/cassa/modena";
    if (tab === "cassa-sassuolo") return "/admin/cassa/sassuolo";
    return "/admin/cassa/totale";
  }

  if (area === "ambulatorio" && tab === "organizzazione-ambulatorio") {
    return "/admin/ambulatorio/organizzazione";
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
    if (rawTab === "pagamenti") return { area: "cassa", tab: "cassa-pagamenti" };
    if (rawTab === "fatturazione") return { area: "cassa", tab: "cassa-fatturazione" };
    if (rawTab === "modena") return { area: "cassa", tab: "cassa-modena" };
    if (rawTab === "sassuolo") return { area: "cassa", tab: "cassa-sassuolo" };
    return { area: "cassa", tab: "cassa-totale" };
  }

  if (section !== "laboratorio" && section !== "ambulatorio") return null;
  if (rawTab === "accettazione") return { area: section, tab: "accettazione" };
  if (rawTab === "agenda" || rawTab === "prenotazioni") return { area: section, tab: "prenotazioni" };
  if (section === "laboratorio" && rawTab === "listino") return { area: section, tab: "listino" };
  if (section === "ambulatorio" && rawTab === "organizzazione") {
    return { area: section, tab: "organizzazione-ambulatorio" };
  }
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
    if (tab === "cassa-fatturazione") return "admin";
    if (tab === "cassa-pagamenti") return null;
  }
  if (area === "laboratorio") {
    if (tab === "accettazione") return "laboratorio.accettazione";
    if (tab === "prenotazioni") return "laboratorio.agenda";
    if (tab === "listino") return "laboratorio.listino";
  }
  if (area === "ambulatorio") {
    if (tab === "accettazione") return "ambulatorio.accettazione";
    if (tab === "prenotazioni") return "ambulatorio.agenda";
    if (tab === "organizzazione-ambulatorio") return "ambulatorio.agenda";
    if (tab === "listino") return "ambulatorio.prestazioni";
  }
  if (tab === "anagrafiche") return "anagrafiche";
  if (tab === "infortunistica") return "infortunistica";
  if (tab === "impostazioni") return "impostazioni";
  if (tab === "utenti") return "utenti";
  return null;
};

function AdminDashboard({
  role,
  roleLabel,
  permissions,
  onLogout,
  location,
  navigate,
}: {
  role: string;
  roleLabel: string;
  permissions: PermissionId[];
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
    (permission: PermissionId) => permissionListHas(permissions, permission),
    [permissions],
  );

  const canAccessTarget = React.useCallback(
    (area: AreaId, tab: TabId) => {
      if (area === "cassa" && tab === "cassa-pagamenti") {
        return can("cassa") || can("cassa.modena") || can("cassa.sassuolo");
      }
      const permission = permessoVoce(area, tab);
      return permission ? can(permission) : false;
    },
    [can],
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
          return canAccessTarget(group.id, item.id);
        }),
      })).filter((group) => group.items.length > 0),
    [canAccessTarget],
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
    if (canAccessTarget(activeArea, activeTab)) return;
    if (!firstAllowedTarget) return;
    setActiveTarget(firstAllowedTarget.area, firstAllowedTarget.tab, { replace: true });
  }, [activeArea, activeTab, canAccessTarget, firstAllowedTarget, setActiveTarget]);

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
  const canEditCatalog = activeArea === "ambulatorio"
    ? can("ambulatorio.prestazioni.write")
    : can("laboratorio.listino.write");
  const isReadOnlyCatalog = !canEditCatalog;
  const pagamentiScope = can("cassa")
    ? "tutte"
    : can("cassa.modena")
      ? "modena"
      : "sassuolo";
  const accettazioneWorkflowRole = role.startsWith("laboratorio") ? "laboratorio" : "segreteria";
  const canUseCassaActions = can("cassa") || can("cassa.modena") || can("cassa.sassuolo");
  const canCreateAcceptance = role === "admin" || role.startsWith("segreteria");
  const settingsSaving = settingsSaveControl?.state === "saving";
  const settingsSaveButtonClass = settingsSaveEnabled
    ? "gap-2 border-slate-950 bg-slate-950 text-white hover:bg-slate-900 hover:text-white"
    : "gap-2 cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-100 hover:bg-slate-100 hover:text-slate-400 disabled:opacity-100";

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside
        className={`${isCassaTab ? "hidden md:flex" : "flex"} z-40 border-b border-border bg-white md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0 md:flex-col md:border-b-0 md:border-r`}
      >
        <div className="flex w-full flex-col">
          <div className="border-b border-border px-5 py-4">
            <button
              type="button"
              onClick={() => firstAllowedTarget && setActiveTarget(firstAllowedTarget.area, firstAllowedTarget.tab)}
              className="flex w-full items-center gap-3 rounded-md text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-2xl font-black leading-none text-white">
                +
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold leading-tight text-primary">M Medical</span>
                <span className="block truncate text-xs text-muted-foreground">Gestionale operativo</span>
              </span>
            </button>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Menu principale">
            {visibleMenuGroups.map((group) => {
              const GroupIcon = group.Icon;
              const isCurrentGroup = isAreaScopedTab && activeArea === group.id;

              return (
                <section key={group.id} className="space-y-2">
                  <div
                    className={`flex items-center gap-3 rounded-md px-3 py-2 ${
                      isCurrentGroup ? "bg-primary/10 text-primary" : "text-foreground"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                        isCurrentGroup ? "border-primary/20 bg-primary/10" : "border-border bg-slate-50"
                      }`}
                    >
                      <GroupIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{group.label}</p>
                      <p className="text-xs leading-tight text-muted-foreground">{group.subtitle}</p>
                    </div>
                  </div>

                  <div className="space-y-1 pl-2">
                    {group.items.map((item) => {
                      const ItemIcon = item.Icon;
                      const isActive = isAreaScopedTab && activeArea === group.id && activeTab === item.id;

                      return (
                        <button
                          key={`${group.id}-${item.id}`}
                          type="button"
                          onClick={() => setActiveTarget(group.id, item.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                          }`}
                        >
                          <ItemIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {can("infortunistica") && (
              <section className="space-y-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTarget(activeArea, "infortunistica")}
                  aria-current={activeTab === "infortunistica" ? "page" : undefined}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                    activeTab === "infortunistica"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                  }`}
                >
                  <Car className="h-4 w-4 shrink-0" />
                  <span>Infortunistica stradale</span>
                </button>
              </section>
            )}
          </nav>

          <div className="border-t border-border px-5 py-4">
            {can("anagrafiche") && (
              <button
                type="button"
                onClick={() => setActiveTarget(activeArea, "anagrafiche")}
                aria-current={activeTab === "anagrafiche" ? "page" : undefined}
                className={`mb-2 flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                  activeTab === "anagrafiche"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                }`}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span>Anagrafiche</span>
              </button>
            )}

            {(can("impostazioni") || can("utenti")) && (
              <div className="mb-4 space-y-2">
                {can("impostazioni") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTarget({ tab: "prestazioni", medicoId: null, key: Date.now() });
                      setActiveTarget(activeArea, "impostazioni");
                    }}
                    aria-current={activeTab === "impostazioni" ? "page" : undefined}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                      activeTab === "impostazioni"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                    }`}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    <span>Impostazioni</span>
                  </button>
                )}
                {can("utenti") && (
                  <button
                    type="button"
                    onClick={() => setActiveTarget(activeArea, "utenti")}
                    aria-current={activeTab === "utenti" ? "page" : undefined}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                      activeTab === "utenti"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                    }`}
                  >
                    <KeyRound className="h-4 w-4 shrink-0" />
                    <span>Utenti</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Operatore</p>
                <p className="truncate text-sm font-medium text-foreground">{roleLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => navigate("/")} title="Portale pazienti">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Notifiche">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Aiuto">
                  <CircleHelp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onLogout} className="hover:bg-red-50 hover:text-destructive" title="Esci">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
                role={accettazioneWorkflowRole}
                area={activeArea === "ambulatorio" ? "ambulatorio" : "laboratorio"}
                canCreateAcceptance={canCreateAcceptance}
                showBillingActions={canUseCassaActions}
                canUpdatePaymentStatus={canUseCassaActions}
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

            {activeTab === "organizzazione-ambulatorio" && (
              <AdminAmbulatorioOrganization onOpenDoctor={apriProfiloMedico} />
            )}

            {activeTab === "listino" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">{activeItem.label}</h1>
                  <p className="text-muted-foreground text-sm">
                    {isReadOnlyCatalog
                      ? `Consulta il catalogo ${activeArea === "ambulatorio" ? "delle prestazioni" : "degli esami"}.`
                      : `Gestisci il catalogo ${activeArea === "ambulatorio" ? "delle prestazioni" : "degli esami"} del modulo ${activeGroup.label.toLowerCase()}.`}
                  </p>
                </div>
                <AdminExams readOnly={isReadOnlyCatalog} />
              </div>
            )}

            {activeTab === "cassa-totale" && <AdminCassa scope="tutte" />}

            {activeTab === "cassa-pagamenti" && <AdminPagamenti scope={pagamentiScope} />}

            {activeTab === "cassa-fatturazione" && <AdminFatturazione />}

            {activeTab === "cassa-modena" && <AdminCassa scope="modena" />}

            {activeTab === "cassa-sassuolo" && <AdminCassa scope="sassuolo" />}

          </div>
        </main>
      </div>
    </div>
  );
}
