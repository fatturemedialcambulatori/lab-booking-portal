const isSameOriginApiRequest = (input: RequestInfo | URL) => {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    const url = new URL(rawUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

export const installSecureFetch = () => {
  if (typeof window === "undefined") return;
  const currentFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isSameOriginApiRequest(input)) {
      return currentFetch(input, init);
    }

    return currentFetch(input, {
      ...init,
      credentials: init.credentials ?? "include",
    });
  };
};
