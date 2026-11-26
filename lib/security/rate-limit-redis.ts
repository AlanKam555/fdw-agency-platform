import type { RateLimitStore } from "@/lib/security/rate-limit";
import {
  counterFromEval,
  FIXED_WINDOW_LUA,
  LOCK_ADD_LUA,
  LOCK_CLEAR_LUA,
  LOCK_READ_LUA,
  lockKey,
  rateLimitKey,
  resultFromEval,
} from "@/lib/security/rate-limit-window";

type EvalClient = {
  connect(): Promise<unknown>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
  on(event: "error", listener: (error: unknown) => void): unknown;
};

export function createRedisRateLimitStore(url: string): RateLimitStore {
  let clientPromise: Promise<EvalClient> | null = null;

  async function client(): Promise<EvalClient> {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { createClient } = await import("redis");
        const created = createClient({
          url,
          socket: {
            connectTimeout: 2000,
            reconnectStrategy: false,
          },
        });
        created.on("error", () => {
          clientPromise = null;
        });
        await created.connect();
        return created;
      })();
    }
    return clientPromise;
  }

  return {
    name: "redis",
    async consume(key, limit, windowMs) {
      try {
        const connection = await client();
        const raw = await connection.eval(FIXED_WINDOW_LUA, {
          keys: [rateLimitKey(key)],
          arguments: [String(windowMs)],
        });
        return resultFromEval(raw, limit, windowMs);
      } catch (error) {
        clientPromise = null;
        throw error;
      }
    },
    async readCounter(key) {
      const connection = await client();
      const raw = await connection.eval(LOCK_READ_LUA, { keys: [lockKey(key)], arguments: [] });
      return counterFromEval(raw);
    },
    async addCounter(key, windowMs) {
      const connection = await client();
      const raw = await connection.eval(LOCK_ADD_LUA, {
        keys: [lockKey(key)],
        arguments: [String(windowMs)],
      });
      return counterFromEval(raw);
    },
    async clearCounter(key) {
      const connection = await client();
      await connection.eval(LOCK_CLEAR_LUA, { keys: [lockKey(key)], arguments: [] });
    },
  };
}
