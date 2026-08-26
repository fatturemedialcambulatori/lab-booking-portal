import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const jsonBodyLimit = process.env["JSON_BODY_LIMIT"] ?? "10mb";
const normalizeOrigin = (origin: string) => {
  const trimmed = origin.trim();
  if (!trimmed) return "";
  return (trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`).replace(/\/$/, "");
};
const vercelOrigins = [
  process.env["VERCEL_URL"],
  process.env["VERCEL_BRANCH_URL"],
  process.env["VERCEL_PROJECT_PRODUCTION_URL"],
]
  .map((origin) => normalizeOrigin(origin ?? ""))
  .filter(Boolean);
const configuredOrigins = (process.env["CORS_ORIGINS"] ?? process.env["APP_ORIGIN"] ?? "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...configuredOrigins, ...vercelOrigins]));

const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin.replace(/\/$/, ""))) return true;
  if (process.env["NODE_ENV"] !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
};

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  next();
});
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, origin ?? true);
      return;
    }
    callback(new Error("Origin non consentito"));
  },
}));
app.use(cookieParser());
app.use("/api/ocr", express.json({ limit: "20mb" }));
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

app.use("/api", router);

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    (err as { type?: string }).type === "entity.too.large"
  ) {
    res.status(413).json({
      error: `Payload troppo grande. Limite JSON configurato: ${jsonBodyLimit}.`,
    });
    return;
  }

  next(err);
});

export default app;
