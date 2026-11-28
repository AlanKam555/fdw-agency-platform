import { generateObject } from "ai";
import type { ZodType } from "zod";
import { recordUsage, reserveBudget, settleBudget } from "@/lib/ai/budget";
import { estimateCostMicro } from "@/lib/ai/pricing";
import { runProviderChain } from "@/lib/ai/chain";
import {
  hasFeatureCredentials,
  languageModelFor,
  providerChain,
  providerConfigured,
  providerDirectory,
  providerModel,
  runnableProviders,
  providerAllowedForData,
  type AiFeature,
  type ProviderId,
} from "@/lib/ai/providers";

export type { AiFeature, ProviderId };
export { hasFeatureCredentials, hasFeatureCredentials as hasAiCredentials, providerDirectory, runnableProviders };

export function configuredProvider(): ProviderId {
  return runnableProviders("explanation")[0] ?? providerChain("explanation")[0] ?? "openai";
}

function timeoutMs(): number {
  const value = Number(process.env.AI_TIMEOUT_MS ?? 20_000);
  return Number.isFinite(value) && value >= 1000 ? value : 20_000;
}

function retrySettings() {
  const retries = Number(process.env.AI_MAX_RETRIES ?? 2);
  const backoff = Number(process.env.AI_RETRY_BASE_MS ?? 400);
  return {
    maxRetries: Number.isFinite(retries) && retries >= 0 ? Math.min(4, retries) : 2,
    backoffMs: Number.isFinite(backoff) && backoff >= 0 ? backoff : 400,
  };
}

function readUsage(usage: unknown): { inputTokens: number; outputTokens: number } {
  if (!usage || typeof usage !== "object") return { inputTokens: 0, outputTokens: 0 };
  const record = usage as Record<string, unknown>;
  const input = Number(record.inputTokens ?? record.promptTokens ?? 0);
  const output = Number(record.outputTokens ?? record.completionTokens ?? 0);
  return {
    inputTokens: Number.isFinite(input) ? input : 0,
    outputTokens: Number.isFinite(output) ? output : 0,
  };
}

export async function generateStructured<T>(options: {
  feature: AiFeature;
  schema: ZodType<T>;
  system: string;
  prompt: string;
  actorId?: string | null;
}): Promise<{ object: T; provider: ProviderId; model: string }> {
  const limits = await import("@/lib/ai/budget");
  const hold = await reserveBudget({
    feature: options.feature,
    actorId: options.actorId ?? null,
    kind: "chat",
    reserveMicro: limits.budgetLimits().chatReserveMicro,
  });
  if (!hold.ok) {
    await recordUsage({
      feature: options.feature,
      provider: "none",
      model: "budget",
      success: false,
      latencyMs: 0,
      errorCode: "budget",
      actorId: options.actorId,
      kind: "chat",
    });
    throw new Error("AI daily budget reached");
  }

  const { maxRetries, backoffMs } = retrySettings();
  let settled = false;
  let actualMicro = 0;
  let succeeded = false;
  try {
    const result = await runProviderChain({
      providers: providerChain(options.feature),
      configured: (id) => providerConfigured(id) && providerAllowedForData(id),
      maxRetries,
      backoffMs,
      run: async (provider) => {
        const started = Date.now();
        const modelName = providerModel(provider);
        try {
          const generated = await generateObject({
            model: languageModelFor(provider),
            schema: options.schema,
            system: options.system,
            prompt: options.prompt,
            temperature: 0.2,
            maxRetries: 0,
            abortSignal: AbortSignal.timeout(timeoutMs()),
          });
          const tokens = readUsage(generated.usage);
          actualMicro = estimateCostMicro({
            provider,
            model: modelName,
            inputTokens: tokens.inputTokens,
            outputTokens: tokens.outputTokens,
            kind: "chat",
          });
          succeeded = true;
          await recordUsage({
            feature: options.feature,
            provider,
            model: modelName,
            success: true,
            latencyMs: Date.now() - started,
            inputTokens: tokens.inputTokens,
            outputTokens: tokens.outputTokens,
            actorId: options.actorId,
            kind: "chat",
          });
          return { object: generated.object, model: modelName };
        } catch (error) {
          await recordUsage({
            feature: options.feature,
            provider,
            model: modelName,
            success: false,
            latencyMs: Date.now() - started,
            errorCode: error instanceof Error ? error.name : "error",
            actorId: options.actorId,
            kind: "chat",
          });
          throw error;
        }
      },
    });
    if (!result.ok) throw new Error(result.error);
    await settleBudget(hold.reservationId, actualMicro, true);
    settled = true;
    return { object: result.value.object, provider: result.provider, model: result.value.model };
  } finally {
    if (!settled) await settleBudget(hold.reservationId, 0, succeeded);
  }
}
