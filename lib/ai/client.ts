import { generateObject } from "ai";
import type { ZodType } from "zod";
import { budgetAllows, recordUsage, todaysUsage } from "@/lib/ai/budget";
import { runProviderChain } from "@/lib/ai/chain";
import {
  hasFeatureCredentials,
  languageModelFor,
  providerChain,
  providerConfigured,
  providerDirectory,
  providerModel,
  runnableProviders,
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
}): Promise<{ object: T; provider: ProviderId; model: string }> {
  const usage = await todaysUsage();
  if (!budgetAllows(usage.spentCents, usage.calls)) {
    await recordUsage({
      feature: options.feature,
      provider: "none",
      model: "budget",
      success: false,
      latencyMs: 0,
      errorCode: "budget",
    });
    throw new Error("AI daily budget reached");
  }

  const { maxRetries, backoffMs } = retrySettings();
  const result = await runProviderChain({
    providers: providerChain(options.feature),
    configured: providerConfigured,
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
        await recordUsage({
          feature: options.feature,
          provider,
          model: modelName,
          success: true,
          latencyMs: Date.now() - started,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
        });
        return generated.object;
      } catch (error) {
        await recordUsage({
          feature: options.feature,
          provider,
          model: modelName,
          success: false,
          latencyMs: Date.now() - started,
          errorCode: error instanceof Error ? error.name : "error",
        });
        throw error;
      }
    },
  });

  if (!result.ok) throw new Error(result.error);
  return { object: result.value, provider: result.provider, model: providerModel(result.provider) };
}
