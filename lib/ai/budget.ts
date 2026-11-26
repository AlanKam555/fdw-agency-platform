import { prisma } from "@/lib/db";

/** Rough cents per million tokens. An estimate for the cap, not an invoice. */
const INPUT_CENTS_PER_MILLION = 20;
const OUTPUT_CENTS_PER_MILLION = 80;

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const raw =
    (Math.max(0, inputTokens) / 1_000_000) * INPUT_CENTS_PER_MILLION +
    (Math.max(0, outputTokens) / 1_000_000) * OUTPUT_CENTS_PER_MILLION;
  return Math.round(raw);
}

export function budgetLimits() {
  const cents = Number(process.env.AI_DAILY_BUDGET_CENTS ?? 500);
  const calls = Number(process.env.AI_MAX_CALLS_PER_DAY ?? 200);
  return {
    cents: Number.isFinite(cents) && cents >= 0 ? cents : 500,
    calls: Number.isFinite(calls) && calls >= 0 ? calls : 200,
  };
}

export function budgetAllows(spentCents: number, calls: number): boolean {
  const limits = budgetLimits();
  return spentCents < limits.cents && calls < limits.calls;
}

export async function todaysUsage(): Promise<{ spentCents: number; calls: number }> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const aggregate = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: start } },
    _sum: { estimatedCostCents: true },
    _count: true,
  });
  return {
    spentCents: aggregate._sum.estimatedCostCents ?? 0,
    calls: aggregate._count,
  };
}

export async function recordUsage(input: {
  feature: string;
  provider: string;
  model: string;
  success: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: string;
}) {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  await prisma.aiUsageLog.create({
    data: {
      feature: input.feature,
      provider: input.provider,
      model: input.model.slice(0, 120),
      success: input.success,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
      inputTokens,
      outputTokens,
      estimatedCostCents: input.success ? estimateCostCents(inputTokens, outputTokens) : 0,
      errorCode: (input.errorCode ?? "").slice(0, 80),
    },
  });
}
