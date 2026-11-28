import type { ProviderId } from "@/lib/ai/providers";

/** 1 micro-dollar = 1e-6 USD. 1 cent = 10_000 micro-dollars. */
export const MICRO_PER_CENT = 10_000;

/**
 * Placeholder rates in micro-dollars per million tokens.
 * UNVERIFIED. Verify each rate against the current provider price card before treating a figure as a charge.
 */
export const PRICE_TABLE_NOTE =
  "Prices are placeholders. Verify each rate against the current provider price card before treating a figure as a charge.";

type Rate = { inputPerMillion: number; outputPerMillion: number };

const UNVERIFIED: Record<string, Rate> = {
  "openai:gpt-4o-mini": { inputPerMillion: 150_000, outputPerMillion: 600_000 },
  "openai:text-embedding-3-small": { inputPerMillion: 20_000, outputPerMillion: 0 },
  "anthropic:claude-3-5-haiku-latest": { inputPerMillion: 800_000, outputPerMillion: 4_000_000 },
  "google:gemini-2.0-flash": { inputPerMillion: 100_000, outputPerMillion: 400_000 },
  "mistral:mistral-small-latest": { inputPerMillion: 200_000, outputPerMillion: 600_000 },
  "mistral:mistral-embed": { inputPerMillion: 100_000, outputPerMillion: 0 },
};

/** Unknown models are expensive on purpose so a missing price is not a free call. UNVERIFIED. */
const UNKNOWN_RATE: Rate = { inputPerMillion: 5_000_000, outputPerMillion: 15_000_000 };

function positive(value: unknown, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.round(number);
}

export function priceTable(): Record<string, Rate> {
  const table: Record<string, Rate> = { ...UNVERIFIED };
  const raw = process.env.AI_PRICE_TABLE_JSON?.trim();
  if (!raw) return table;
  try {
    const parsed = JSON.parse(raw) as Record<string, { inputPerMillion?: unknown; outputPerMillion?: unknown }>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return table;
    for (const [key, rate] of Object.entries(parsed)) {
      if (!rate || typeof rate !== "object") continue;
      table[key] = {
        inputPerMillion: positive(rate.inputPerMillion, UNKNOWN_RATE.inputPerMillion),
        outputPerMillion: positive(rate.outputPerMillion, UNKNOWN_RATE.outputPerMillion),
      };
    }
  } catch {
    return table;
  }
  return table;
}

export function rateFor(provider: string, model: string, kind: "chat" | "embedding"): Rate {
  const table = priceTable();
  return table[`${provider}:${model}`] ?? (kind === "embedding" ? table["openai:text-embedding-3-small"] ?? UNKNOWN_RATE : UNKNOWN_RATE);
}

export function estimateCostMicro(input: {
  provider: ProviderId | string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  kind: "chat" | "embedding";
}): number {
  const rate = rateFor(input.provider, input.model, input.kind);
  const raw =
    (Math.max(0, input.inputTokens) / 1_000_000) * rate.inputPerMillion +
    (Math.max(0, input.outputTokens) / 1_000_000) * rate.outputPerMillion;
  return Math.max(0, Math.min(2_000_000_000, Math.round(raw)));
}

export function microToCents(micro: number): number {
  return Math.round(Math.max(0, micro) / MICRO_PER_CENT);
}

export function centsToMicro(cents: number): number {
  return Math.round(Math.max(0, cents) * MICRO_PER_CENT);
}
