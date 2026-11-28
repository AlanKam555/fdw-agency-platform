import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { centsToMicro, estimateCostMicro, microToCents, MICRO_PER_CENT } from "@/lib/ai/pricing";
import type { ProviderId } from "@/lib/ai/providers";

function nonNegative(value: string | undefined, fallback: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function budgetLimits() {
  const globalCents = nonNegative(process.env.AI_DAILY_BUDGET_CENTS, 500);
  const userCents = nonNegative(process.env.AI_USER_DAILY_BUDGET_CENTS, 100);
  const featureCents = nonNegative(process.env.AI_FEATURE_DAILY_BUDGET_CENTS, 250);
  return {
    cents: globalCents,
    calls: nonNegative(process.env.AI_MAX_CALLS_PER_DAY, 200),
    globalMicro: centsToMicro(globalCents),
    globalCalls: nonNegative(process.env.AI_MAX_CALLS_PER_DAY, 200),
    userMicro: centsToMicro(userCents),
    userCalls: nonNegative(process.env.AI_USER_MAX_CALLS_PER_DAY, 40),
    featureMicro: centsToMicro(featureCents),
    featureCalls: nonNegative(process.env.AI_FEATURE_MAX_CALLS_PER_DAY, 80),
    chatReserveMicro: nonNegative(process.env.AI_RESERVE_MICRO, 100_000),
    embedReserveMicro: nonNegative(process.env.AI_EMBED_RESERVE_MICRO, 20_000),
  };
}

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  return microToCents(
    estimateCostMicro({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens,
      outputTokens,
      kind: "chat",
    }),
  );
}

export function budgetAllows(spentCents: number, calls: number): boolean {
  const limits = budgetLimits();
  return spentCents < limits.cents && calls < limits.calls;
}

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function todaysUsage(): Promise<{ spentCents: number; calls: number }> {
  const day = utcDay();
  const row = await prisma.aiDailyLedger.findUnique({ where: { id: `${day}:global` } });
  return {
    spentCents: microToCents((row?.spentMicro ?? 0) + (row?.reservedMicro ?? 0)),
    calls: row?.calls ?? 0,
  };
}

export async function reserveBudget(input: {
  feature: string;
  actorId: string | null;
  kind: "chat" | "embedding";
  reserveMicro?: number;
}): Promise<{ ok: true; reservationId: string; reservedMicro: number } | { ok: false; reason: "budget" }> {
  const limits = budgetLimits();
  const reserve =
    input.reserveMicro ?? (input.kind === "embedding" ? limits.embedReserveMicro : limits.chatReserveMicro);
  const day = utcDay();
  const actor = input.actorId || "system";
  const scopes = [
    { scope: "global", microLimit: limits.globalMicro, callLimit: limits.globalCalls },
    { scope: `feature:${input.feature}`, microLimit: limits.featureMicro, callLimit: limits.featureCalls },
    { scope: `user:${actor}`, microLimit: limits.userMicro, callLimit: limits.userCalls },
  ];
  const reservationId = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      for (const scope of scopes) {
        const id = `${day}:${scope.scope}`;
        await tx.$executeRaw`
          INSERT INTO "AiDailyLedger" ("id", "day", "scope", "reservedMicro", "spentMicro", "calls", "updatedAt")
          VALUES (${id}, ${day}, ${scope.scope}, 0, 0, 0, NOW())
          ON CONFLICT ("id") DO NOTHING
        `;
        const updated = await tx.$executeRaw`
          UPDATE "AiDailyLedger"
          SET "reservedMicro" = "reservedMicro" + ${reserve},
              "calls" = "calls" + 1,
              "updatedAt" = NOW()
          WHERE "id" = ${id}
            AND "spentMicro" + "reservedMicro" + ${reserve} <= ${scope.microLimit}
            AND "calls" + 1 <= ${scope.callLimit}
        `;
        if (Number(updated) !== 1) throw new Error("budget");
      }
      await tx.aiReservation.create({
        data: {
          id: reservationId,
          day,
          feature: input.feature,
          actorId: actor,
          reservedMicro: reserve,
          status: "HELD",
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "budget") return { ok: false, reason: "budget" };
    throw error;
  }
  return { ok: true, reservationId, reservedMicro: reserve };
}

export async function settleBudget(reservationId: string, actualMicro: number, success: boolean): Promise<void> {
  const actual = success ? Math.max(0, Math.min(2_000_000_000, Math.round(actualMicro))) : 0;
  await prisma.$transaction(async (tx) => {
    const row = await tx.aiReservation.findUnique({ where: { id: reservationId } });
    if (!row || row.status !== "HELD") return;
    const scopes = ["global", `feature:${row.feature}`, `user:${row.actorId}`];
    for (const scope of scopes) {
      const id = `${row.day}:${scope}`;
      await tx.$executeRaw`
        UPDATE "AiDailyLedger"
        SET "reservedMicro" = GREATEST(0, "reservedMicro" - ${row.reservedMicro}),
            "spentMicro" = "spentMicro" + ${actual},
            "updatedAt" = NOW()
        WHERE "id" = ${id}
      `;
    }
    await tx.aiReservation.update({
      where: { id: row.id },
      data: { status: success ? "SETTLED" : "RELEASED" },
    });
  });
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
  actorId?: string | null;
  kind?: "chat" | "embedding";
}) {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const micro = input.success
    ? estimateCostMicro({
        provider: input.provider as ProviderId,
        model: input.model,
        inputTokens,
        outputTokens,
        kind: input.kind ?? "chat",
      })
    : 0;
  await prisma.aiUsageLog.create({
    data: {
      feature: input.feature,
      provider: input.provider,
      model: input.model.slice(0, 120),
      success: input.success,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
      inputTokens,
      outputTokens,
      estimatedCostMicro: micro,
      estimatedCostCents: microToCents(micro),
      actorId: (input.actorId ?? "").slice(0, 80),
      errorCode: (input.errorCode ?? "").slice(0, 80),
    },
  });
}

export { MICRO_PER_CENT };
