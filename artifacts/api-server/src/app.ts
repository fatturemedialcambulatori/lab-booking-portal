import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const jsonBodyLimit = process.env["JSON_BODY_LIMIT"] ?? "10mb";

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
app.use(cors());
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
