import { setBaseUrl } from "@workspace/api-client-react";

const configuredApiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
let installed = false;

const isApiPath = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

const rawUrlFor = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const toUrl = (input: RequestInfo | URL) => new URL(rawUrlFor(input), window.location.origin);

const isSameOriginApiRequest = (input: RequestInfo | URL) => {
  try {
    const url = toUrl(input);
    return url.origin === window.location.origin && isApiPath(url.pathname);
  } catch {
    return false;
  }
};

const isConfiguredApiRequest = (input: RequestInfo | URL) => {
  if (!configuredApiBaseUrl) return false;

  try {
    const url = toUrl(input);
    const apiBase = new URL(configuredApiBaseUrl);
    return url.origin === apiBase.origin && isApiPath(url.pathname);
  } catch {
    return false;
  }
};

const withConfiguredApiBaseUrl = (input: RequestInfo | URL): RequestInfo | URL => {
  if (!configuredApiBaseUrl || !isSameOriginApiRequest(input)) return input;

  const sourceUrl = toUrl(input);
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}${sourceUrl.hash}`, configuredApiBaseUrl);

  if (typeof input === "string") return targetUrl.toString();
  if (input instanceof URL) return targetUrl;
  return new Request(targetUrl, input);
};

export const installSecureFetch = () => {
  if (typeof window === "undefined") return;
  setBaseUrl(configuredApiBaseUrl || null);
  if (installed) return;
  installed = true;

  const currentFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const requestInput = withConfiguredApiBaseUrl(input);

    if (!isSameOriginApiRequest(requestInput) && !isConfiguredApiRequest(requestInput)) {
      return currentFetch(requestInput, init);
    }

    return currentFetch(requestInput, {
      ...init,
      credentials: init.credentials ?? "include",
    });
  };
};
