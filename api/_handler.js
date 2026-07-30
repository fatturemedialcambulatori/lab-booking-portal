import app from "../artifacts/api-server/dist/app.mjs";

function readPathParam(req, searchParams) {
  const value = req.query?.path ?? searchParams.get("path");
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("/");
  }

  return typeof value === "string" ? value : "";
}

function normalizeRewrittenCatchAll(req) {
  const currentUrl = req.url || "";
  if (!currentUrl.includes("[...path]")) {
    return currentUrl;
  }

  const parsed = new URL(currentUrl, "http://localhost");
  const path = readPathParam(req, parsed.searchParams).replace(/^\/+/, "");
  if (!path) {
    return currentUrl;
  }

  parsed.searchParams.delete("path");
  const query = parsed.searchParams.toString();
  return `/api/${path}${query ? `?${query}` : ""}`;
}

function withApiPrefix(url) {
  if (!url || url.startsWith("/api")) {
    return url;
  }

  return `/api${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function handler(req, res) {
  req.url = withApiPrefix(normalizeRewrittenCatchAll(req));
  return app(req, res);
}
