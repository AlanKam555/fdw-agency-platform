import { createHash } from "node:crypto";
import { embed, embedMany } from "ai";
import { recordUsage, reserveBudget, settleBudget } from "@/lib/ai/budget";
import { estimateCostMicro } from "@/lib/ai/pricing";
import { minimisePii, piiMinimisationEnabled } from "@/lib/ai/pii";
import { runProviderChain } from "@/lib/ai/chain";
import {
  embeddingModelFor,
  embeddingModelName,
  providerChain,
  providerConfigured,
  providerAllowedForData,
  type ProviderId,
} from "@/lib/ai/providers";
import { prisma } from "@/lib/db";
import { cosine, deterministicSimilarity, deterministicVector } from "@/lib/matching/semantic";

export { deterministicSimilarity };

export type SemanticDetail = {
  charsUsed: number;
  cap: number;
  originalChars: number;
  source: "embedding" | "deterministic" | "skipped";
  cached: boolean;
  employerEmbeddedOnce: boolean;
};

export function embedCap(): number {
  const value = Number(process.env.AI_EMBED_MAX_CHARS ?? 600);
  return Number.isFinite(value) && value >= 80 && value <= 4_000 ? Math.floor(value) : 600;
}

export function embedConcurrency(): number {
  const value = Number(process.env.AI_EMBED_CONCURRENCY ?? 4);
  return Number.isFinite(value) && value >= 1 && value <= 8 ? Math.floor(value) : 4;
}

export function embedTimeoutMs(): number {
  const value = Number(process.env.AI_EMBED_TIMEOUT_MS ?? 20_000);
  return Number.isFinite(value) && value >= 1_000 ? value : 20_000;
}

export function prepareEmbedText(raw: string): { text: string; originalChars: number; charsUsed: number; cap: number } {
  const cap = embedCap();
  const minimised = piiMinimisationEnabled() ? minimisePii(raw) : raw;
  const text = minimised.slice(0, cap);
  return { text, originalChars: raw.length, charsUsed: text.length, cap };
}

export function embeddingContentHash(model: string, text: string): string {
  return createHash("sha256").update(`${model}\n${text}`).digest("hex");
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

async function loadCached(model: string, texts: string[]): Promise<Map<string, number[]>> {
  const hashes = texts.map((text) => embeddingContentHash(model, text));
  const rows = await prisma.embeddingCache.findMany({
    where: { model, contentHash: { in: hashes } },
  });
  const byHash = new Map(rows.map((row) => [row.contentHash, row.vector]));
  const found = new Map<string, number[]>();
  texts.forEach((text, index) => {
    const vector = byHash.get(hashes[index]);
    if (Array.isArray(vector) && vector.every((item) => typeof item === "number")) {
      found.set(text, vector as number[]);
    }
  });
  return found;
}

async function storeCached(model: string, pairs: { text: string; vector: number[] }[]) {
  for (const pair of pairs) {
    const contentHash = embeddingContentHash(model, pair.text);
    await prisma.embeddingCache.upsert({
      where: { contentHash_model: { contentHash, model } },
      create: { contentHash, model, vector: pair.vector },
      update: {},
    });
  }
}

async function embedBatch(provider: ProviderId, texts: string[], actorId: string | null): Promise<number[][]> {
  const model = embeddingModelFor(provider);
  if (!model) throw new Error("no_embedding_model");
  const modelName = embeddingModelName(provider);
  const estimatedTokens = Math.max(1, Math.ceil(texts.join(" ").length / 4));
  const reserveMicro = Math.max(
    1,
    estimateCostMicro({
      provider,
      model: modelName,
      inputTokens: estimatedTokens,
      outputTokens: 0,
      kind: "embedding",
    }),
  );
  const hold = await reserveBudget({
    feature: "embedding",
    actorId,
    kind: "embedding",
    reserveMicro,
  });
  if (!hold.ok) throw new Error("budget");
  const started = Date.now();
  const signal = AbortSignal.timeout(embedTimeoutMs());
  try {
    let vectors: number[][];
    let tokens = estimatedTokens;
    try {
      const many = await embedMany({ model, values: texts, maxRetries: 0, abortSignal: signal });
      vectors = many.embeddings;
      tokens = many.usage?.tokens ?? estimatedTokens;
    } catch {
      tokens = 0;
      vectors = await mapPool(texts, embedConcurrency(), async (value) => {
        const single = await embed({ model, value, maxRetries: 0, abortSignal: signal });
        tokens += single.usage?.tokens ?? 0;
        return single.embedding;
      });
    }
    const micro = estimateCostMicro({
      provider,
      model: modelName,
      inputTokens: tokens,
      outputTokens: 0,
      kind: "embedding",
    });
    await settleBudget(hold.reservationId, micro, true);
    await recordUsage({
      feature: "embedding",
      provider,
      model: modelName,
      success: true,
      latencyMs: Date.now() - started,
      inputTokens: tokens,
      actorId,
      kind: "embedding",
    });
    return vectors;
  } catch (error) {
    await settleBudget(hold.reservationId, 0, false);
    await recordUsage({
      feature: "embedding",
      provider,
      model: modelName,
      success: false,
      latencyMs: Date.now() - started,
      errorCode: error instanceof Error ? error.name : "error",
      actorId,
      kind: "embedding",
    });
    throw error;
  }
}

export async function rankTextSimilarities(input: {
  employerText: string;
  employerConsent: boolean;
  candidates: { id: string; text: string; consent: boolean }[];
  actorId: string | null;
}): Promise<Record<string, { score: number; source: "embedding" | "deterministic"; detail: SemanticDetail }>> {
  const employerPrepared = prepareEmbedText(input.employerText);
  const prepared = new Map(input.candidates.map((candidate) => [candidate.id, prepareEmbedText(candidate.text)]));
  const result: Record<string, { score: number; source: "embedding" | "deterministic"; detail: SemanticDetail }> = {};

  const remoteIds = input.candidates
    .filter((candidate) => input.employerConsent && candidate.consent && prepared.get(candidate.id)?.text && employerPrepared.text)
    .map((candidate) => candidate.id);

  for (const candidate of input.candidates) {
    const prep = prepared.get(candidate.id)!;
    const skipped = !input.employerConsent || !candidate.consent;
    if (skipped || !remoteIds.includes(candidate.id)) {
      result[candidate.id] = {
        score: deterministicSimilarity(prep.text, employerPrepared.text),
        source: "deterministic",
        detail: {
          charsUsed: prep.charsUsed,
          cap: prep.cap,
          originalChars: prep.originalChars,
          source: skipped ? "skipped" : "deterministic",
          cached: false,
          employerEmbeddedOnce: true,
        },
      };
    }
  }

  if (!remoteIds.length) return result;

  const chain = await runProviderChain({
    providers: providerChain("embedding"),
    configured: (id) => providerConfigured(id) && providerAllowedForData(id) && embeddingModelFor(id) !== null,
    maxRetries: 0,
    run: async (provider) => {
      const modelName = embeddingModelName(provider);
      const unique = [...new Set([employerPrepared.text, ...remoteIds.map((id) => prepared.get(id)!.text)])];
      const cached = await loadCached(modelName, unique);
      const missing = unique.filter((text) => !cached.has(text));
      if (missing.length) {
        const vectors = await embedBatch(provider, missing, input.actorId);
        await storeCached(
          modelName,
          missing.map((text, index) => ({ text, vector: vectors[index] })),
        );
        missing.forEach((text, index) => cached.set(text, vectors[index]));
      }
      const employerVector = cached.get(employerPrepared.text);
      if (!employerVector) throw new Error("missing_employer_vector");
      const employerCached = !missing.includes(employerPrepared.text) || missing.length === 0;
      for (const id of remoteIds) {
        const prep = prepared.get(id)!;
        const vector = cached.get(prep.text);
        if (!vector) throw new Error("missing_candidate_vector");
        result[id] = {
          score: cosine(vector, employerVector),
          source: "embedding",
          detail: {
            charsUsed: prep.charsUsed,
            cap: prep.cap,
            originalChars: prep.originalChars,
            source: "embedding",
            cached: cached.has(prep.text) && !missing.includes(prep.text),
            employerEmbeddedOnce: true,
          },
        };
      }
      void employerCached;
      return true;
    },
  });

  if (!chain.ok) {
    for (const id of remoteIds) {
      const prep = prepared.get(id)!;
      result[id] = {
        score: deterministicSimilarity(prep.text, employerPrepared.text),
        source: "deterministic",
        detail: {
          charsUsed: prep.charsUsed,
          cap: prep.cap,
          originalChars: prep.originalChars,
          source: "deterministic",
          cached: false,
          employerEmbeddedOnce: true,
        },
      };
    }
  }
  return result;
}

export async function textSimilarity(left: string, right: string): Promise<{
  score: number;
  source: "embedding" | "deterministic";
}> {
  const ranked = await rankTextSimilarities({
    employerText: right,
    employerConsent: true,
    candidates: [{ id: "left", text: left, consent: true }],
    actorId: null,
  });
  const row = ranked.left;
  return { score: row?.score ?? deterministicSimilarity(left, right), source: row?.source ?? "deterministic" };
}

export function vectorsMatch(left: string, right: string): boolean {
  return deterministicVector(left).some((value, index) => value > 0 && deterministicVector(right)[index] > 0);
}
