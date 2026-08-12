/**
 * Durable API rate limiting.
 *
 * Prefers Upstash Redis REST (shared across Vercel instances) when
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 * Falls back to per-process memory for local / unset env.
 */

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  backend: "upstash" | "memory";
};

function pruneMemory() {
  if (memoryBuckets.size < 2000) return;
  const now = Date.now();
  for (const [k, v] of memoryBuckets) {
    if (now >= v.resetAt) memoryBuckets.delete(k);
  }
}

function takeMemory(key: string, max: number, windowMs: number): RateLimitResult {
  pruneMemory();
  const now = Date.now();
  const cur = memoryBuckets.get(key);
  if (!cur || now >= cur.resetAt) {
    const resetAt = now + windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt, backend: "memory" };
  }
  if (cur.count >= max) {
    return { ok: false, remaining: 0, resetAt: cur.resetAt, backend: "memory" };
  }
  cur.count += 1;
  return { ok: true, remaining: max - cur.count, resetAt: cur.resetAt, backend: "memory" };
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

/**
 * Fixed-window counter via Upstash pipeline:
 * INCR key → EXPIRE key ttl NX (only set TTL on first hit).
 */
async function takeUpstash(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `sw:rl:${key}`;
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  const resetAt = Date.now() + windowMs;

  const res = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, ttlSec, "NX"],
    ]),
    // Edge-friendly: don't hang the middleware forever
    signal: AbortSignal.timeout(1500),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = (await res.json()) as Array<{ result?: number | string | null }>;
  const count = Number(data?.[0]?.result ?? Number.POSITIVE_INFINITY);
  if (!Number.isFinite(count)) throw new Error("Upstash bad result");

  return {
    ok: count <= max,
    remaining: Math.max(0, max - count),
    resetAt,
    backend: "upstash",
  };
}

/**
 * Consume one token for `key` within a fixed window.
 * On Upstash failure, falls back to memory (fail-open locally, still limited).
 */
export async function takeRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!upstashConfigured()) {
    return takeMemory(key, max, windowMs);
  }
  try {
    return await takeUpstash(key, max, windowMs);
  } catch {
    return takeMemory(key, max, windowMs);
  }
}

export function rateLimitBackend(): "upstash" | "memory" {
  return upstashConfigured() ? "upstash" : "memory";
}
