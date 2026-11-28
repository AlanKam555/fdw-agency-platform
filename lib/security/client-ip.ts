const MAX_HOPS = 10;

function headerSource(input: Headers | { headers: Headers }): Headers {
  return input instanceof Headers ? input : input.headers;
}

function hopsFrom(env: NodeJS.ProcessEnv): number {
  const raw = Number(env.TRUSTED_PROXY_HOPS ?? "0");
  if (!Number.isInteger(raw) || raw < 0) return 0;
  return Math.min(raw, MAX_HOPS);
}

function sanitizeIp(value: string): string {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  if (!trimmed || trimmed.length > 64) return "unknown";
  if (!/^[0-9a-fA-F:.]+$/.test(trimmed)) return "unknown";
  return trimmed;
}

function fromForwarded(header: string, hops: number): string {
  const parts = header.split(",").map((part) => part.trim()).filter(Boolean);
  const index = parts.length - 1 - hops;
  if (index < 0 || index >= parts.length) return "unknown";
  return sanitizeIp(parts[index]);
}

export function clientIp(input: Headers | { headers: Headers }, env: NodeJS.ProcessEnv = process.env): string {
  const headers = headerSource(input);
  const configured = env.CLIENT_IP_HEADER?.trim().toLowerCase() ?? "";
  if (configured && /^[a-z0-9-]{1,40}$/.test(configured)) {
    const platform = headers.get(configured);
    if (platform) return sanitizeIp(platform.split(",")[0] ?? "");
  }
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return fromForwarded(forwarded, hopsFrom(env));
  return "unknown";
}
