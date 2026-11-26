import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";

export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "mistral",
  "groq",
  "deepseek",
  "azure",
  "bedrock",
  "openrouter",
  "custom",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const AI_FEATURES = ["marketing", "matching", "explanation", "embedding"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

const OPENAI_COMPATIBLE: Partial<Record<ProviderId, { env: string; baseURL: string }>> = {
  xai: { env: "XAI_API_KEY", baseURL: "https://api.x.ai/v1" },
  mistral: { env: "MISTRAL_API_KEY", baseURL: "https://api.mistral.ai/v1" },
  groq: { env: "GROQ_API_KEY", baseURL: "https://api.groq.com/openai/v1" },
  deepseek: { env: "DEEPSEEK_API_KEY", baseURL: "https://api.deepseek.com" },
  openrouter: { env: "OPENROUTER_API_KEY", baseURL: "https://openrouter.ai/api/v1" },
};

const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-2.0-flash",
  xai: "grok-3",
  mistral: "mistral-small-latest",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  azure: "gpt-4o-mini",
  bedrock: "anthropic.claude-3-haiku-20240307-v1:0",
  openrouter: "openai/gpt-4o-mini",
  custom: "llama3.2",
};

const DEFAULT_EMBEDDINGS: Partial<Record<ProviderId, string>> = {
  openai: "text-embedding-3-small",
  mistral: "mistral-embed",
  azure: "text-embedding-3-small",
  bedrock: "amazon.titan-embed-text-v2:0",
  custom: "nomic-embed-text",
};

function envSet(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export function providerConfigured(id: ProviderId): boolean {
  switch (id) {
    case "openai":
      return envSet("OPENAI_API_KEY");
    case "anthropic":
      return envSet("ANTHROPIC_API_KEY");
    case "google":
      return envSet("GOOGLE_GENERATIVE_AI_API_KEY");
    case "azure":
      return envSet("AZURE_OPENAI_API_KEY") && envSet("AZURE_OPENAI_BASE_URL");
    case "bedrock":
      return envSet("AWS_ACCESS_KEY_ID") && envSet("AWS_SECRET_ACCESS_KEY");
    case "custom":
      return envSet("AI_CUSTOM_BASE_URL");
    default: {
      const spec = OPENAI_COMPATIBLE[id];
      return spec ? envSet(spec.env) : false;
    }
  }
}

export function providerModel(id: ProviderId): string {
  const specific = process.env[`AI_${id.toUpperCase()}_MODEL`]?.trim();
  if (specific) return specific;
  if (process.env.AI_MODEL?.trim() && id === (process.env.AI_PROVIDER ?? "openai").toLowerCase()) {
    return process.env.AI_MODEL.trim();
  }
  return DEFAULT_MODELS[id];
}

export function embeddingModelName(id: ProviderId): string {
  return process.env[`AI_${id.toUpperCase()}_EMBEDDING_MODEL`]?.trim() || DEFAULT_EMBEDDINGS[id] || "text-embedding-3-small";
}

export function providerChain(feature: AiFeature): ProviderId[] {
  const featureEnv: Record<AiFeature, string> = {
    marketing: "AI_MARKETING_PROVIDERS",
    matching: "AI_MATCHING_PROVIDERS",
    explanation: "AI_EXPLANATION_PROVIDERS",
    embedding: "AI_EMBEDDING_PROVIDERS",
  };
  const listed = parseProviderList(process.env[featureEnv[feature]]);
  if (listed.length) return listed;
  const legacy = parseProviderList(process.env.AI_PROVIDER);
  if (legacy.length) return legacy;
  const configured = PROVIDER_IDS.filter(providerConfigured);
  return configured.length ? configured : ["openai"];
}

export function runnableProviders(feature: AiFeature): ProviderId[] {
  return providerChain(feature).filter(providerConfigured);
}

export function hasFeatureCredentials(feature: AiFeature): boolean {
  return runnableProviders(feature).length > 0;
}

/** Safe for an admin page. Model names only. Never includes credentials. */
export function providerDirectory() {
  return PROVIDER_IDS.map((id) => ({
    id,
    configured: providerConfigured(id),
    model: providerModel(id),
    embeddingModel: DEFAULT_EMBEDDINGS[id] ? embeddingModelName(id) : "",
    features: AI_FEATURES.filter((feature) => providerChain(feature).includes(id)),
  }));
}

export function languageModelFor(id: ProviderId): LanguageModel {
  const name = providerModel(id);
  if (id === "anthropic") return anthropic(name);
  if (id === "google") return google(name);
  if (id === "bedrock") {
    return createAmazonBedrock({
      region: process.env.BEDROCK_AWS_REGION || process.env.AWS_REGION || "ap-southeast-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    })(name);
  }
  if (id === "azure") {
    return createOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY || "",
      baseURL: process.env.AZURE_OPENAI_BASE_URL,
    }).chat(name);
  }
  if (id === "custom") {
    return createOpenAI({
      apiKey: process.env.AI_CUSTOM_API_KEY || "ollama",
      baseURL: process.env.AI_CUSTOM_BASE_URL,
    }).chat(name);
  }
  if (id === "openai") return createOpenAI({ apiKey: process.env.OPENAI_API_KEY || "" }).chat(name);
  const spec = OPENAI_COMPATIBLE[id];
  return createOpenAI({
    apiKey: (spec && process.env[spec.env]) || "",
    baseURL: spec?.baseURL,
  }).chat(name);
}

export function embeddingModelFor(id: ProviderId): EmbeddingModel | null {
  const name = embeddingModelName(id);
  if (id === "openai") return createOpenAI({ apiKey: process.env.OPENAI_API_KEY || "" }).embedding(name);
  if (id === "azure") {
    return createOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY || "",
      baseURL: process.env.AZURE_OPENAI_BASE_URL,
    }).embedding(name);
  }
  if (id === "custom") {
    return createOpenAI({
      apiKey: process.env.AI_CUSTOM_API_KEY || "ollama",
      baseURL: process.env.AI_CUSTOM_BASE_URL,
    }).embedding(name);
  }
  if (id === "bedrock") {
    return createAmazonBedrock({
      region: process.env.BEDROCK_AWS_REGION || process.env.AWS_REGION || "ap-southeast-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }).embedding(name);
  }
  const spec = OPENAI_COMPATIBLE[id];
  if (!spec) return null;
  const hasEmbedding = Boolean(DEFAULT_EMBEDDINGS[id] || process.env[`AI_${id.toUpperCase()}_EMBEDDING_MODEL`]);
  if (!hasEmbedding) return null;
  return createOpenAI({ apiKey: process.env[spec.env] || "", baseURL: spec.baseURL }).embedding(name);
}

function parseProviderList(value: string | undefined): ProviderId[] {
  if (!value?.trim()) return [];
  const ids: ProviderId[] = [];
  for (const part of value.split(",")) {
    const id = part.trim().toLowerCase();
    if (isProviderId(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
