# MedicalDesk

Gestionale medico interno per M Medical, organizzato per due sedi operative: Modena e Sassuolo.

## Struttura

- `backend/`: API Express in Node.js/TypeScript. E il confine di sicurezza: legge `DATABASE_URL`, Supabase, sessioni, ruoli, upload, log e integrazioni future.
- `backend/packages/db`: schema e accesso Postgres/Supabase via Drizzle.
- `backend/packages/api-zod`: validazioni generate dagli schemi OpenAPI.
- `backend/api-spec`: specifica OpenAPI e generazione client/validator.
- `backend/scripts`: script operativi e migrazioni locali.
- `backend/supabase`: SQL di inizializzazione/migrazione.
- `frontend/`: frontend Next.js App Router. Consuma solo API backend e usa solo variabili pubbliche `NEXT_PUBLIC_*`.
- `frontend/packages/api-client-react`: client React Query generato dalle API backend.

## Ambiente locale

1. Installa le dipendenze:

```bash
pnpm install
```

2. Crea `.env` partendo da `.env.example` e compila solo i valori reali necessari al backend.

3. Avvia backend e frontend insieme:

```bash
pnpm dev
```

Comandi separati:

```bash
pnpm dev:backend
pnpm dev:frontend
```

URL locali predefiniti:

- Backend: `http://127.0.0.1:5100`
- Frontend: `http://localhost:3000`

## Deploy iniziale

1. Applica su Supabase la migration `backend/supabase/2026-08-31-security-access-audit.sql`.
2. Deploya il backend impostando almeno `DATABASE_URL`, `AUTH_SECRET`, `APP_ORIGIN`, `CORS_ORIGINS` e gli eventuali segreti Supabase/Aruba.
3. Deploya il frontend impostando solo `NEXT_PUBLIC_API_BASE_URL` con l'URL pubblico del backend.
4. Verifica `/api/healthz`, poi accedi come admin e controlla `Impostazioni > Log`.

## Variabili

Backend:

- `DATABASE_URL`
- `HOST`
- `DATABASE_POOL_MAX`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `AUTH_SECRET`
- `CORS_ORIGINS`
- `APP_ORIGIN`
- `JSON_BODY_LIMIT`
- `AUTH_PASSWORD_MIN_LENGTH`
- `ARUBA_FE_ENVIRONMENT`
- `ARUBA_FE_USERNAME`
- `ARUBA_FE_PASSWORD`
- `ARUBA_FE_AUTH_BASE_URL`
- `ARUBA_FE_WS_BASE_URL`
- `ARUBA_FE_SENDER_COUNTRY`
- `ARUBA_FE_SENDER_VATCODE`
- `ARUBA_FE_RECEIVER_COUNTRY`
- `ARUBA_FE_RECEIVER_VATCODE`
- `ARUBA_FE_TIMEOUT_MS`
- `ARUBA_FE_SYNC_DELAY_MS`

Frontend:

- `NEXT_PUBLIC_API_BASE_URL`

Il frontend non deve contenere `DATABASE_URL`, service key Supabase o altre credenziali sensibili.

## Script

```bash
pnpm dev
pnpm dev:backend
pnpm dev:frontend
pnpm build
pnpm typecheck
```

## Note architetturali

- Il backend resta l'unico punto di accesso a database, Supabase Storage e integrazioni esterne.
- Le verifiche di ruolo e permesso devono essere enforceate lato backend.
- Ruoli, permessi, account e audit sono persistiti su DB nelle tabelle `admin_roles`, `admin_role_permissions`, `admin_accounts` e `audit_logs`.
- Gli upload passano da API controllate, con limiti dimensione e controlli MIME.
- Log e audit non devono contenere dati sanitari o segreti.
- L'integrazione Aruba Fatturazione Elettronica e esposta solo al ruolo `admin` e, per ora, usa solo endpoint di consultazione. Gli intervalli lunghi vengono sincronizzati in cache locale con finestre compatibili con i limiti Aruba.
- Le integrazioni future previste sono AWS, storage documentale e macchinari/LIS.
