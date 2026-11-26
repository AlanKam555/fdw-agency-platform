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
