import type { RateLimitResult } from "@/lib/security/rate-limit";

export const RATE_LIMIT_PREFIX = "fdw:rl:";

export const FIXED_WINDOW_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
else
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`.trim();

export function rateLimitKey(key: string): string {
  return `${RATE_LIMIT_PREFIX}${key}`;
}

export function upstashCommand(key: string, windowMs: number): [string, string, string, string, string] {
  return ["EVAL", FIXED_WINDOW_LUA, "1", rateLimitKey(key), String(windowMs)];
}

export function resultFromEval(raw: unknown, limit: number, windowMs: number): RateLimitResult {
  const values = Array.isArray(raw) ? raw : [];
  const current = Number(values[0]);
  const ttl = Number(values[1]);
  if (!Number.isFinite(current)) {
    throw new Error("Rate limit store returned an unexpected result.");
  }
  if (current <= limit) {
    return { ok: true, remaining: Math.max(0, limit - current), retryAfterSeconds: 0 };
  }
  const retryAfterSeconds =
    Number.isFinite(ttl) && ttl > 0 ? Math.ceil(ttl / 1000) : Math.ceil(windowMs / 1000);
  return { ok: false, remaining: 0, retryAfterSeconds };
}

export const LOCK_PREFIX = "fdw:lock:";

export const LOCK_ADD_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
else
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`.trim();

export const LOCK_READ_LUA = `
local value = redis.call('GET', KEYS[1])
if not value then
  return {0, 0}
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  return {0, 0}
end
return {tonumber(value), ttl}
`.trim();

export const LOCK_CLEAR_LUA = `return redis.call('DEL', KEYS[1])`;

export function lockKey(key: string): string {
  return `${LOCK_PREFIX}${key}`;
}

export function upstashLockAdd(key: string, windowMs: number): [string, string, string, string, string] {
  return ["EVAL", LOCK_ADD_LUA, "1", lockKey(key), String(windowMs)];
}

export function upstashLockRead(key: string): [string, string, string, string] {
  return ["EVAL", LOCK_READ_LUA, "1", lockKey(key)];
}

export function upstashLockClear(key: string): [string, string, string, string] {
  return ["EVAL", LOCK_CLEAR_LUA, "1", lockKey(key)];
}

export function counterFromEval(raw: unknown): { count: number; ttlMs: number } {
  const values = Array.isArray(raw) ? raw : [];
  const count = Number(values[0]);
  const ttl = Number(values[1]);
  if (!Number.isFinite(count)) {
    throw new Error("Rate limit store returned an unexpected result.");
  }
  return {
    count: Math.max(0, count),
    ttlMs: Number.isFinite(ttl) && ttl > 0 ? ttl : 0,
  };
}

export function parseUpstashBody(body: unknown, limit: number, windowMs: number): RateLimitResult {
  if (!body || typeof body !== "object") {
    throw new Error("Rate limit store returned an unexpected result.");
  }
  const record = body as { result?: unknown; error?: unknown };
  if (record.error) {
    throw new Error("Rate limit store rejected the command.");
  }
  return resultFromEval(record.result, limit, windowMs);
}
