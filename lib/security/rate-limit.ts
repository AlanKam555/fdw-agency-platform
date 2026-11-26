import { createRedisRateLimitStore } from "@/lib/security/rate-limit-redis";
import { createUpstashRateLimitStore } from "@/lib/security/rate-limit-upstash";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type CounterReading = { count: number; ttlMs: number };

export interface RateLimitStore {
  readonly name: string;
  consume(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitResult>;
  readCounter?(key: string, now?: number): Promise<CounterReading>;
  addCounter?(key: string, windowMs: number, now?: number): Promise<CounterReading>;
  clearCounter?(key: string): Promise<void>;
}

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
const counters = new Map<string, { count: number; expiresAt: number }>();
let override: { store: RateLimitStore | null } | null = null;
let upstashStore: RateLimitStore | null = null;
let upstashKey = "";
let redisStore: RateLimitStore | null = null;
let redisKey = "";

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = buckets.get(key);
  if (!current || now - current.updatedAt >= windowMs) {
    buckets.set(key, { tokens: limit - 1, updatedAt: now });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  if (current.tokens <= 0) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - current.updatedAt)) / 1000);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  current.tokens -= 1;
  return { ok: true, remaining: current.tokens, retryAfterSeconds: 0 };
}

export function readMemoryCounter(key: string, now = Date.now()): CounterReading {
  const row = counters.get(key);
  if (!row || row.expiresAt <= now) return { count: 0, ttlMs: 0 };
  return { count: row.count, ttlMs: row.expiresAt - now };
}

export function addMemoryCounter(key: string, windowMs: number, now = Date.now()): CounterReading {
  const row = counters.get(key);
  if (!row || row.expiresAt <= now) {
    counters.set(key, { count: 1, expiresAt: now + windowMs });
    return { count: 1, ttlMs: windowMs };
  }
  row.count += 1;
  return { count: row.count, ttlMs: Math.max(0, row.expiresAt - now) };
}

export function clearMemoryCounter(key: string): void {
  counters.delete(key);
}

export function resetRateLimits(): void {
  buckets.clear();
  counters.clear();
  override = null;
  upstashStore = null;
  upstashKey = "";
  redisStore = null;
  redisKey = "";
}

/** Tests inject a store. Pass null to force the in-memory limiter. */
export function setRateLimitStoreForTests(store: RateLimitStore | null): void {
  override = { store };
}

function configuredStore(): RateLimitStore | null {
  const driver = (process.env.RATE_LIMIT_DRIVER ?? "memory").trim().toLowerCase();
  if (driver === "upstash") {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
    if (!url || !token) return null;
    const key = `${url}\n${token}`;
    if (!upstashStore || upstashKey !== key) {
      upstashKey = key;
      upstashStore = createUpstashRateLimitStore(url, token);
    }
    return upstashStore;
  }
  if (driver === "redis") {
    const url = process.env.REDIS_URL?.trim() ?? "";
    if (!url) return null;
    if (!redisStore || redisKey !== url) {
      redisKey = url;
      redisStore = createRedisRateLimitStore(url);
    }
    return redisStore;
  }
  return null;
}

function selectedStore(): RateLimitStore | null {
  if (override) return override.store;
  return configuredStore();
}

export function activeRateLimitDriver(): string {
  return selectedStore()?.name ?? "memory";
}

async function withCounterStore<T>(
  run: (store: RateLimitStore) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  const store = selectedStore();
  if (store?.readCounter && store.addCounter && store.clearCounter) {
    try {
      return await run(store);
    } catch {
      console.error(`[rate-limit] ${store.name} counter failed; using the in-memory counter for this process`);
    }
  }
  return fallback();
}

export function readFailureCount(key: string, now = Date.now()): Promise<CounterReading> {
  return withCounterStore((store) => store.readCounter!(key, now), () => readMemoryCounter(key, now));
}

export function addFailureCount(key: string, windowMs: number, now = Date.now()): Promise<CounterReading> {
  return withCounterStore(
    (store) => store.addCounter!(key, windowMs, now),
    () => addMemoryCounter(key, windowMs, now),
  );
}

export function clearFailureCount(key: string): Promise<void> {
  return withCounterStore(
    (store) => store.clearCounter!(key),
    () => {
      clearMemoryCounter(key);
    },
  );
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const store = selectedStore();
  if (store) {
    try {
      return await store.consume(key, limit, windowMs, now);
    } catch {
      console.error(`[rate-limit] ${store.name} failed; using the in-memory limiter for this process`);
    }
  }
  return rateLimit(key, limit, windowMs, now);
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("x-real-ip") ?? "unknown";
}
