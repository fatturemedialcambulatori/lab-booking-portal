import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  FlaskConical,
  LogOut,
  Settings,
  Stethoscope,
  UserCheck,
  KeyRound,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Login } from "./Login";
import { AdminExams } from "./AdminExams";
import { AccettazionePaziente } from "./AccettazionePaziente";
import { AdminAnagrafiche } from "./AdminAnagrafiche";
import { AdminBookingCalendar } from "./AdminBookingCalendar";
import { AdminSettings } from "./AdminSettings";
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
  const [, navigate] = useLocation();
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
type SettingsTabId = "specialita" | "prestazioni" | "medici" | "compensi";

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
  if (area === "cassa" && tab.startsWith("cassa-")) return "cassa";
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
  navigate,
}: {
  accessConfig: AdminAccessConfig;
  role: string;
  roleLabel: string;
  onLogout: () => void;
  navigate: (path: string) => void;
}) {
  const [activeArea, setActiveArea] = React.useState<AreaId>("laboratorio");
  const [activeTab, setActiveTab] = React.useState<TabId>("accettazione");
  const [settingsTarget, setSettingsTarget] = React.useState<SettingsTarget>({
    tab: "prestazioni",
    medicoId: null,
    key: 0,
  });

  const can = React.useCallback(
    (permission: PermissionId) => roleHasPermission(accessConfig, role, permission),
    [accessConfig, role],
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
    if (can("anagrafiche")) return { area: activeArea, tab: "anagrafiche" as TabId };
    if (can("infortunistica")) return { area: activeArea, tab: "infortunistica" as TabId };
    if (can("impostazioni")) return { area: activeArea, tab: "impostazioni" as TabId };
    if (can("utenti")) return { area: activeArea, tab: "utenti" as TabId };
    return null;
  }, [activeArea, can, visibleMenuGroups]);

  React.useEffect(() => {
    const permission = permessoVoce(activeArea, activeTab);
    if (permission && can(permission)) return;
    if (!permission && activeTab === "anagrafiche" && can("anagrafiche")) return;
    if (!permission && activeTab === "infortunistica" && can("infortunistica")) return;
    if (!permission && activeTab === "impostazioni" && can("impostazioni")) return;
    if (!permission && activeTab === "utenti" && can("utenti")) return;
    if (!firstAllowedTarget) return;
    setActiveArea(firstAllowedTarget.area);
    setActiveTab(firstAllowedTarget.tab);
  }, [activeArea, activeTab, can, firstAllowedTarget]);

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
    setActiveTab("impostazioni");
  };

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="bg-white border-b border-border lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-xl leading-none">+</span>
              </div>
              <div className="min-w-0">
                <span className="block text-lg font-semibold leading-none text-primary">M Medical</span>
                <span className="mt-1 block text-xs text-muted-foreground">Gestionale operativo</span>
              </div>
            </div>
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
                        isCurrentGroup ? "border-primary/25 bg-primary/10" : "border-border bg-muted/40"
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
                          onClick={() => {
                            setActiveArea(group.id);
                            setActiveTab(item.id);
                          }}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <section className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("infortunistica")}
                  aria-current={activeTab === "infortunistica" ? "page" : undefined}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                    activeTab === "infortunistica"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                onClick={() => setActiveTab("anagrafiche")}
                aria-current={activeTab === "anagrafiche" ? "page" : undefined}
                className={`mb-2 flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                  activeTab === "anagrafiche"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                    setActiveTab("impostazioni");
                  }}
                  aria-current={activeTab === "impostazioni" ? "page" : undefined}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                    activeTab === "impostazioni"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>Impostazioni</span>
                </button>
                )}
                {can("utenti") && (
                <button
                  type="button"
                  onClick={() => setActiveTab("utenti")}
                  aria-current={activeTab === "utenti" ? "page" : undefined}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                    activeTab === "utenti"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <KeyRound className="h-4 w-4 shrink-0" />
                  <span>Utenti</span>
                </button>
                )}
              </div>
            )}
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Operatore</p>
            <p className="mt-1 text-sm font-medium text-foreground">{roleLabel}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gestionale M Medical</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold leading-tight text-foreground">{activeSectionLabel}</h1>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm font-medium text-primary">{activeItem.label}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 hidden sm:flex">
                <ArrowLeft className="h-3.5 w-3.5" />
                Portale pazienti
              </Button>
              <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2 text-muted-foreground hover:text-destructive">
                <LogOut className="h-3.5 w-3.5" />
                Esci
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-[1600px]">
            {!firstAllowedTarget && (
              <div className="rounded-md border border-border bg-white p-6 text-sm text-muted-foreground">
                Nessuna sezione abilitata per questo ruolo.
              </div>
            )}

            {activeTab === "accettazione" && <AccettazionePaziente role={role} />}

            {activeTab === "anagrafiche" && <AdminAnagrafiche />}

            {activeTab === "infortunistica" && <AdminInfortunistica />}

            {activeTab === "impostazioni" && (
              <AdminSettings
                initialTab={settingsTarget.tab}
                initialMedicoId={settingsTarget.medicoId}
                focusKey={settingsTarget.key}
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
                    Gestisci il catalogo {activeArea === "ambulatorio" ? "delle prestazioni" : "degli esami"} del modulo {activeGroup.label.toLowerCase()}.
                  </p>
                </div>
                <AdminExams />
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
