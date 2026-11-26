type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

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
    const retryAfterSeconds = Math.ceil(
      (windowMs - (now - current.updatedAt)) / 1000,
    );
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  current.tokens -= 1;
  return { ok: true, remaining: current.tokens, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("x-real-ip") ?? "unknown";
}
