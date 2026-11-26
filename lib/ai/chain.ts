import type { ProviderId } from "@/lib/ai/providers";

export async function runProviderChain<T>(options: {
  providers: readonly ProviderId[];
  configured: (id: ProviderId) => boolean;
  run: (id: ProviderId) => Promise<T>;
  maxRetries?: number;
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ ok: true; provider: ProviderId; value: T } | { ok: false; error: "none_configured" | "all_failed" }> {
  const maxRetries = options.maxRetries ?? 0;
  const backoffMs = options.backoffMs ?? 0;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let sawConfigured = false;
  for (const provider of options.providers) {
    if (!options.configured(provider)) continue;
    sawConfigured = true;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return { ok: true, provider, value: await options.run(provider) };
      } catch {
        if (attempt < maxRetries && backoffMs > 0) {
          await sleep(backoffMs * 2 ** attempt);
        }
      }
    }
  }
  return { ok: false, error: sawConfigured ? "all_failed" : "none_configured" };
}
