import { Router } from "express";
import {
  changeOwnPassword,
  clearSessionCookie,
  createSessionForAccount,
  isLoginRateLimited,
  loadPublicAccessConfig,
  loginWithPassword,
  publicSession,
  recordLoginResult,
  requireAnyPermission,
  requireAuth,
  saveAccessConfig,
  setSessionCookie,
} from "../lib/auth";
import { writeAuditLog } from "../lib/audit";

const router = Router();

const auditAuthEvent = (
  req: Parameters<typeof writeAuditLog>[0],
  input: Parameters<typeof writeAuditLog>[1],
) => {
  void writeAuditLog(req, input).catch((err) => {
    req.log.warn({ err }, "Failed to write auth audit event");
  });
};

router.get("/auth/accounts", requireAnyPermission(["utenti"]), async (req, res) => {
  try {
    const config = await loadPublicAccessConfig();
    res.json({
      ruoli: config.ruoli,
      account: config.account.filter((account) => account.stato === "attivo"),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load login accounts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    res.status(400).json({ error: "Username e password sono richiesti" });
    return;
  }

  if (isLoginRateLimited(req, username)) {
    auditAuthEvent(req, {
      actorUsername: username,
      action: "auth.login",
      entityType: "auth",
      outcome: "blocked",
      reason: "rate_limited",
    });
    res.status(429).json({ error: "Troppi tentativi. Riprova tra qualche minuto." });
    return;
  }

  try {
    const account = await loginWithPassword(username, password);
    recordLoginResult(req, username, Boolean(account));

    if (!account) {
      auditAuthEvent(req, {
        actorUsername: username,
        action: "auth.login",
        entityType: "auth",
        outcome: "blocked",
        reason: "invalid_credentials",
      });
      res.status(401).json({ error: "Credenziali non valide" });
      return;
    }

    const session = await createSessionForAccount(account);
    setSessionCookie(res, session);
    auditAuthEvent(req, {
      actorAccountId: account.id,
      actorUsername: account.username,
      actorRoleId: account.ruoloId,
      action: "auth.login",
      entityType: "auth",
      outcome: "success",
      metadata: {
        mustChangePassword: account.mustChangePassword,
      },
    });
    res.json({ user: publicSession(session) });
  } catch (err) {
    req.log.error({ err }, "Failed to login");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicSession(req.auth!) });
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Password attuale e nuova password sono richieste" });
    return;
  }

  try {
    const session = await changeOwnPassword(req.auth!, currentPassword, newPassword);
    setSessionCookie(res, session);
    auditAuthEvent(req, {
      action: "auth.password_change",
      entityType: "auth",
      outcome: "success",
    });
    res.json({ user: publicSession(session) });
  } catch (err) {
    auditAuthEvent(req, {
      action: "auth.password_change",
      entityType: "auth",
      outcome: "blocked",
      reason: "password_change_rejected",
    });
    res.status(400).json({
      error: err instanceof Error ? err.message : "Cambio password non riuscito",
    });
  }
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

router.get("/admin-access", requireAnyPermission(["utenti"]), async (req, res) => {
  try {
    res.json(await loadPublicAccessConfig());
  } catch (err) {
    req.log.error({ err }, "Failed to load admin access config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin-access", requireAnyPermission(["utenti"]), async (req, res) => {
  try {
    res.json(await saveAccessConfig(req.body));
  } catch (err) {
    req.log.warn({ err }, "Invalid admin access config");
    res.status(400).json({ error: err instanceof Error ? err.message : "Configurazione account non valida" });
  }
});

export default router;
