import "server-only";

/**
 * Shared fetch for public datasets: timeout, small in-memory TTL cache, and a
 * descriptive User-Agent (several public APIs ask callers to identify themselves).
 */
const cache = new Map<string, { at: number; value: unknown }>();
const UA = "NotWasted/1.0 (surplus food redistribution demo; Oracle hackathon)";

export async function fetchJson<T>(url: string, { ttlMs = 60 * 60_000, timeoutMs = 12_000, init }: { ttlMs?: number; timeoutMs?: number; init?: RequestInit } = {}): Promise<T> {
  const key = `${init?.method ?? "GET"} ${url} ${typeof init?.body === "string" ? init.body : ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...init?.headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  const value = (await res.json()) as T;
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Runs a public-data call and reports the failure instead of throwing, so pages degrade gracefully. */
export async function attempt<T>(source: string, fn: () => Promise<T>): Promise<{ ok: true; data: T; source: string } | { ok: false; error: string; source: string }> {
  try {
    return { ok: true, data: await fn(), source };
  } catch (err) {
    console.warn(`[public-data] ${source}:`, (err as Error).message);
    return { ok: false, error: (err as Error).message, source };
  }
}

/** Davidson County / Nashville bounding box (west, south, east, north). */
export const NASHVILLE_BBOX = [-87.06, 35.96, -86.51, 36.41] as const;
