import { loadMomRules, type MomRules } from "@/config/mom-rules";
import { prisma } from "@/lib/db";
import { applyHolidayAdjustments, applyRuleOverride } from "@/lib/mom/rule-catalog";

export async function effectiveMomRules(): Promise<MomRules> {
  const [states, adjustments] = await Promise.all([
    prisma.momRuleState.findMany(),
    prisma.publicHolidayAdjustment.findMany(),
  ]);
  let rules = loadMomRules();
  for (const state of states) {
    if (!state.overrideJson) continue;
    try {
      rules = applyRuleOverride(rules, state.key, JSON.parse(state.overrideJson) as unknown);
    } catch {
      continue;
    }
  }
  rules.publicHolidays = applyHolidayAdjustments(rules.publicHolidays, adjustments);
  return rules;
}
