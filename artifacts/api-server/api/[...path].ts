import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/app";

function withApiPrefix(url: string | undefined): string | undefined {
  if (!url || url.startsWith("/api")) {
    return url;
  }

  return `/api${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = withApiPrefix(req.url);
  return app(req, res);
}
