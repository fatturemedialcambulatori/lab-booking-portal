import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, Eye, EyeOff } from "lucide-react";
import { readAdminAccessConfig, type PermissionId } from "@/lib/adminAccess";

export type AuthUser = {
  accountId: string;
  username: string;
  nome: string;
  roleId: string;
  roleName: string;
  permissions: PermissionId[];
  expiresAt: string;
};

interface LoginProps {
  onSuccess: (user: AuthUser) => void;
}

export function Login({ onSuccess }: LoginProps) {
  const fallbackAccessConfig = React.useMemo(readAdminAccessConfig, []);
  const defaultUsername = fallbackAccessConfig.account.find((account) => account.stato === "attivo")?.username ?? "";
  const [username, setUsername] = React.useState<string>(defaultUsername);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username) {
      setError("Seleziona un utente.");
      return;
    }
    if (!password) {
      setError("Inserisci la password.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => null) as { user?: AuthUser; error?: string } | null;
      if (!response.ok || !data?.user) {
        setError(data?.error ?? "Credenziali non valide. Riprova.");
        setPassword("");
        return;
      }

      try {
        sessionStorage.setItem("operator_role", data.user.roleId);
        sessionStorage.setItem("operator_account_username", data.user.username);
      } catch {
        // Continue with in-memory login if browser storage is unavailable.
      }
      onSuccess(data.user);
    } catch {
      setError("Errore di rete durante il login. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <span className="text-white font-bold text-2xl leading-none">+</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">LabMedica</h1>
          <p className="text-sm text-muted-foreground mt-1">Accesso Operatori</p>
        </div>

        <Card className="p-6 shadow-lg border-border/60">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Utente</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => { setUsername(event.target.value); setError(""); }}
                placeholder="Username"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  className={`pr-10 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <Lock className="h-4 w-4" />
              {loading ? "Verifica..." : "Accedi"}
            </Button>
          </form>
        </Card>

        <p className="text-center mt-6">
          <a href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Torna al portale pazienti
          </a>
        </p>
      </div>
    </div>
  );
}
