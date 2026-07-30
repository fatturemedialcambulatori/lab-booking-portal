import app from "../artifacts/api-server/dist/app.mjs";

function withApiPrefix(url) {
  if (!url || url.startsWith("/api")) {
    return url;
  }

  return `/api${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function handler(req, res) {
  req.url = withApiPrefix(req.url);
  return app(req, res);
}
