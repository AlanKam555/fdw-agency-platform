import type { RateLimitStore } from "@/lib/security/rate-limit";
import { parseUpstashBody, upstashCommand } from "@/lib/security/rate-limit-window";

export function createUpstashRateLimitStore(url: string, token: string): RateLimitStore {
  return {
    name: "upstash",
    async consume(key, limit, windowMs) {
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(upstashCommand(key, windowMs)),
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) {
        throw new Error("Rate limit store request failed.");
      }
      return parseUpstashBody(await response.json(), limit, windowMs);
    },
  };
}
