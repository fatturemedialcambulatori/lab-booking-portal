import app from "./app";
import { logger } from "./lib/logger";
import { migrateRefValues } from "./lib/migrateRefValues";

const rawPort = process.env["PORT"] ?? "5100";
const host = process.env["HOST"] ?? "127.0.0.1";

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host, port }, "Server listening");

  migrateRefValues(logger);
});
