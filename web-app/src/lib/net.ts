import dns from "node:dns";

/** Prefer IPv4 — many upstreams (EONET, Wikidata) hang on broken IPv6 routes. */
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* older node */
}

export async function fetchUpstream(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 12000, ...rest } = init;
  const signal =
    rest.signal ??
    (timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined);
  return fetch(url, { ...rest, signal });
}
