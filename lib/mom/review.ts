import { loadMomRules } from "@/config/mom-rules";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  MOM_RULE_DEFINITIONS,
  applyRuleOverride,
  ruleDefinition,
  ruleReviewStatus,
  staleAfterDays,
  type RuleDefinition,
} from "@/lib/mom/rule-catalog";

export type RuleRow = {
  key: string;
  name: string;
  unit: string;
  kind: RuleDefinition["kind"];
  sourceUrl: string;
  catalogValue: string;
  value: string;
  override: string | null;
  overrideSourceUrl: string;
  overrideNote: string;
  lastVerified: string;
  verifiedBy: string | null;
  stale: boolean;
  needsVerification: boolean;
  ageDays: number;
};

function transcribedOn(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

export async function momRuleRows(now = new Date()): Promise<RuleRow[]> {
  const base = loadMomRules();
  const states = await prisma.momRuleState.findMany();
  const byKey = new Map(states.map((state) => [state.key, state]));
  const names = await staffNames(states.map((state) => state.verifiedById).filter((id): id is string => Boolean(id)));
  const staleDays = staleAfterDays();
  let effective = base;
  for (const state of states) {
    if (!state.overrideJson) continue;
    try {
      effective = applyRuleOverride(effective, state.key, JSON.parse(state.overrideJson) as unknown);
    } catch {
      continue;
    }
  }
  return MOM_RULE_DEFINITIONS.map((definition) => {
    const state = byKey.get(definition.key);
    const verifiedAt = state?.lastVerifiedAt ?? transcribedOn(base.meta.lastTranscribed);
    const status = ruleReviewStatus({
      lastVerified: verifiedAt,
      verifiedBy: state?.verifiedById ?? null,
      now,
      staleDays,
    });
    return {
      key: definition.key,
      name: definition.name,
      unit: definition.unit,
      kind: definition.kind,
      sourceUrl: state?.sourceUrl || definition.sourceUrl,
      catalogValue: definition.read(base),
      value: definition.read(effective),
      override: state?.overrideJson ?? null,
      overrideSourceUrl: state?.sourceUrl ?? "",
      overrideNote: state?.note ?? "",
      lastVerified: verifiedAt.toISOString().slice(0, 10),
      verifiedBy: state?.verifiedById ? names.get(state.verifiedById) ?? "Former staff" : null,
      stale: status.stale,
      needsVerification: status.needsVerification,
      ageDays: status.ageDays,
    };
  });
}

export async function staleMomRuleCount(now = new Date()): Promise<number> {
  const rows = await momRuleRows(now);
  return rows.filter((row) => row.stale).length;
}

async function staffNames(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name]));
}

function storedOverride(kind: RuleDefinition["kind"], raw: string): unknown {
  if (kind === "int") return Number(raw);
  if (kind === "boolean") return raw === "true" || raw === "yes";
  if (kind === "list") return raw.split(",").map((item) => item.trim()).filter(Boolean);
  return raw.trim();
}

export async function reviewMomRule(input: {
  action: "verify" | "override" | "clear";
  key: string;
  value?: string;
  sourceUrl?: string;
  note?: string;
  actorId: string;
  ip: string;
}) {
  const definition = ruleDefinition(input.key);
  if (!definition) return { ok: false as const, error: "That rule is not in the catalog." };
  if (input.action === "clear") {
    await prisma.momRuleState.deleteMany({ where: { key: input.key } });
    await writeAudit({
      actorId: input.actorId,
      action: "mom.rule_clear",
      entityType: "MomRuleState",
      entityId: input.key,
      ip: input.ip,
    });
    return { ok: true as const };
  }
  if (input.action === "verify") {
    await prisma.momRuleState.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        sourceUrl: definition.sourceUrl,
        lastVerifiedAt: new Date(),
        verifiedById: input.actorId,
      },
      update: {
        lastVerifiedAt: new Date(),
        verifiedById: input.actorId,
      },
    });
    await writeAudit({
      actorId: input.actorId,
      action: "mom.rule_verify",
      entityType: "MomRuleState",
      entityId: input.key,
      metadata: { key: input.key },
      ip: input.ip,
    });
    return { ok: true as const };
  }
  if (definition.kind === "dates") {
    return { ok: false as const, error: "Change public holidays on the holiday page." };
  }
  const raw = input.value ?? "";
  if (definition.kind === "boolean" && !/^(true|false|yes|no)$/i.test(raw)) {
    return { ok: false as const, error: "Use yes or no for this rule." };
  }
  const value = storedOverride(definition.kind, raw);
  if (definition.kind === "int" && !Number.isInteger(value)) {
    return { ok: false as const, error: "That value is not valid for this rule." };
  }
  if (definition.kind === "list" && (!Array.isArray(value) || value.length === 0)) {
    return { ok: false as const, error: "That value is not valid for this rule." };
  }
  const catalog = loadMomRules();
  const trial = applyRuleOverride(catalog, input.key, value);
  if (definition.read(trial) === definition.read(catalog) && definition.kind !== "boolean" && definition.kind !== "list") {
    return { ok: false as const, error: "That value is not valid for this rule." };
  }
  await prisma.momRuleState.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      overrideJson: JSON.stringify(value),
      sourceUrl: input.sourceUrl ?? "",
      note: input.note ?? "",
      verifiedById: input.actorId,
      lastVerifiedAt: new Date(),
    },
    update: {
      overrideJson: JSON.stringify(value),
      sourceUrl: input.sourceUrl ?? "",
      note: input.note ?? "",
      verifiedById: input.actorId,
      lastVerifiedAt: new Date(),
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "mom.rule_override",
    entityType: "MomRuleState",
    entityId: input.key,
    metadata: { key: input.key, sourceUrl: input.sourceUrl ?? "" },
    ip: input.ip,
  });
  return { ok: true as const };
}
