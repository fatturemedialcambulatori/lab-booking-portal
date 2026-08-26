import { Router } from "express";
import {
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

const router = Router();

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
    res.status(429).json({ error: "Troppi tentativi. Riprova tra qualche minuto." });
    return;
  }

  try {
    const account = await loginWithPassword(username, password);
    recordLoginResult(req, username, Boolean(account));

    if (!account) {
      res.status(401).json({ error: "Credenziali non valide" });
      return;
    }

    const session = await createSessionForAccount(account);
    setSessionCookie(res, session);
    res.json({ user: publicSession(session) });
  } catch (err) {
    req.log.error({ err }, "Failed to login");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicSession(req.auth!) });
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
