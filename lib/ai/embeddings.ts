import { embed } from "ai";
import { budgetAllows, recordUsage, todaysUsage } from "@/lib/ai/budget";
import { runProviderChain } from "@/lib/ai/chain";
import {
  embeddingModelFor,
  embeddingModelName,
  providerChain,
  providerConfigured,
  type ProviderId,
} from "@/lib/ai/providers";
import { cosine, deterministicSimilarity, deterministicVector } from "@/lib/matching/semantic";

export { deterministicSimilarity };

async function remoteSimilarity(left: string, right: string): Promise<{ score: number; provider: ProviderId }> {
  const usage = await todaysUsage();
  if (!budgetAllows(usage.spentCents, usage.calls)) {
    throw new Error("budget");
  }
  const result = await runProviderChain({
    providers: providerChain("embedding"),
    configured: (id) => providerConfigured(id) && embeddingModelFor(id) !== null,
    maxRetries: 0,
    run: async (provider) => {
      const model = embeddingModelFor(provider);
      if (!model) throw new Error("no_embedding_model");
      const started = Date.now();
      try {
        const [a, b] = await Promise.all([
          embed({ model, value: left.slice(0, 2000), maxRetries: 0, abortSignal: AbortSignal.timeout(15_000) }),
          embed({ model, value: right.slice(0, 2000), maxRetries: 0, abortSignal: AbortSignal.timeout(15_000) }),
        ]);
        await recordUsage({
          feature: "embedding",
          provider,
          model: embeddingModelName(provider),
          success: true,
          latencyMs: Date.now() - started,
          inputTokens: (a.usage?.tokens ?? 0) + (b.usage?.tokens ?? 0),
        });
        return cosine(a.embedding, b.embedding);
      } catch (error) {
        await recordUsage({
          feature: "embedding",
          provider,
          model: embeddingModelName(provider),
          success: false,
          latencyMs: Date.now() - started,
          errorCode: error instanceof Error ? error.name : "error",
        });
        throw error;
      }
    },
  });
  if (!result.ok) throw new Error(result.error);
  return { score: result.value, provider: result.provider };
}

export async function textSimilarity(left: string, right: string): Promise<{
  score: number;
  source: "embedding" | "deterministic";
}> {
  const fallback = deterministicSimilarity(left, right);
  if (!left.trim() || !right.trim()) return { score: fallback, source: "deterministic" };
  try {
    const remote = await remoteSimilarity(left, right);
    if (!Number.isFinite(remote.score)) return { score: fallback, source: "deterministic" };
    return { score: Math.max(0, Math.min(1, remote.score)), source: "embedding" };
  } catch {
    return { score: fallback, source: "deterministic" };
  }
}

export function vectorsMatch(left: string, right: string): boolean {
  return deterministicVector(left).some((value, index) => value > 0 && deterministicVector(right)[index] > 0);
}
