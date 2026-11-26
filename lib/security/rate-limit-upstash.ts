import type { CounterReading, RateLimitStore } from "@/lib/security/rate-limit";
import {
  counterFromEval,
  parseUpstashBody,
  upstashCommand,
  upstashLockAdd,
  upstashLockClear,
  upstashLockRead,
} from "@/lib/security/rate-limit-window";

export function createUpstashRateLimitStore(url: string, token: string): RateLimitStore {
  async function call(command: readonly string[]): Promise<unknown> {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      throw new Error("Rate limit store request failed.");
    }
    const body = (await response.json()) as { result?: unknown; error?: unknown };
    if (body.error) {
      throw new Error("Rate limit store rejected the command.");
    }
    return body.result;
  }

  return {
    name: "upstash",
    async consume(key, limit, windowMs) {
      return parseUpstashBody({ result: await call(upstashCommand(key, windowMs)) }, limit, windowMs);
    },
    async readCounter(key): Promise<CounterReading> {
      return counterFromEval(await call(upstashLockRead(key)));
    },
    async addCounter(key, windowMs): Promise<CounterReading> {
      return counterFromEval(await call(upstashLockAdd(key, windowMs)));
    },
    async clearCounter(key) {
      await call(upstashLockClear(key));
    },
  };
}
