import type { MomRules } from "@/config/mom-rules";

export type RuleKind = "int" | "boolean" | "sex" | "list" | "dates";

export type RuleDefinition = {
  key: string;
  name: string;
  unit: string;
  kind: RuleKind;
  sourceUrl: string;
  read: (rules: MomRules) => string;
};

const FDW = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/fdw-eligibility";
const EMPLOYER = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employer-requirements";
const EOP = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employers-orientation-programme-eop";
const BOND = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/security-bond";
const INSURANCE = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/insurance-requirements";
const SIP = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/settling-in-programme-sip";
const MEDICAL = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/medical-examination";
const HOLIDAYS = "https://www.mom.gov.sg/employment-practices/public-holidays";

export const MOM_RULE_DEFINITIONS: RuleDefinition[] = [
  { key: "fdw.minAgeYears", name: "Helper minimum age", unit: "years", kind: "int", sourceUrl: FDW, read: (rules) => String(rules.fdw.minAgeYears) },
  { key: "fdw.maxAgeYearsExclusive", name: "Helper maximum age (exclusive)", unit: "years", kind: "int", sourceUrl: FDW, read: (rules) => String(rules.fdw.maxAgeYearsExclusive) },
  { key: "fdw.minEducationYears", name: "Minimum formal education", unit: "years", kind: "int", sourceUrl: FDW, read: (rules) => String(rules.fdw.minEducationYears) },
  { key: "fdw.requiredSex", name: "Statutory sex gate", unit: "sex", kind: "sex", sourceUrl: FDW, read: (rules) => rules.fdw.requiredSex ?? "none" },
  { key: "fdw.approvedSourceCountries", name: "Approved source countries", unit: "list", kind: "list", sourceUrl: FDW, read: (rules) => rules.fdw.approvedSourceCountries.join(", ") },
  { key: "employer.minAgeYears", name: "Employer minimum age", unit: "years", kind: "int", sourceUrl: EMPLOYER, read: (rules) => String(rules.employer.minAgeYears) },
  { key: "eop.requiredForFirstTimeEmployer", name: "EOP required for a first-time employer", unit: "yes/no", kind: "boolean", sourceUrl: EOP, read: (rules) => rules.eop.requiredForFirstTimeEmployer ? "yes" : "no" },
  { key: "eop.leadWorkingDays", name: "EOP lead time", unit: "working days", kind: "int", sourceUrl: EOP, read: (rules) => String(rules.eop.leadWorkingDays) },
  { key: "securityBond.amountSgd", name: "Security bond amount", unit: "SGD", kind: "int", sourceUrl: BOND, read: (rules) => String(rules.securityBond.amountSgd) },
  { key: "securityBond.exemptNationalities", name: "Security bond exemptions", unit: "list", kind: "list", sourceUrl: BOND, read: (rules) => rules.securityBond.exemptNationalities.join(", ") },
  { key: "insurance.medicalAnnualClaimLimitSgd", name: "Medical insurance annual claim limit", unit: "SGD", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.medicalAnnualClaimLimitSgd) },
  { key: "insurance.personalAccidentSumAssuredSgd", name: "Personal accident sum assured", unit: "SGD", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.personalAccidentSumAssuredSgd) },
  { key: "sip.requiredForFirstTimeFdw", name: "SIP required for a first-time helper", unit: "yes/no", kind: "boolean", sourceUrl: SIP, read: (rules) => rules.sip.requiredForFirstTimeFdw ? "yes" : "no" },
  { key: "sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays", name: "SIP deadline", unit: "days excluding Sunday and public holidays", kind: "int", sourceUrl: SIP, read: (rules) => String(rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays) },
  { key: "medicalExam.deadlineDaysAfterArrival", name: "Medical examination deadline", unit: "calendar days", kind: "int", sourceUrl: MEDICAL, read: (rules) => String(rules.medicalExam.deadlineDaysAfterArrival) },
  { key: "publicHolidays", name: "Public holidays used in deadline maths", unit: "dates", kind: "dates", sourceUrl: HOLIDAYS, read: (rules) => String(rules.publicHolidays.length) },
];

export function ruleDefinition(key: string): RuleDefinition | undefined {
  return MOM_RULE_DEFINITIONS.find((item) => item.key === key);
}

export function staleAfterDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.MOM_RULE_STALE_DAYS ?? "90");
  if (!Number.isInteger(raw) || raw < 1 || raw > 3650) return 90;
  return raw;
}

export function ruleReviewStatus(input: {
  lastVerified: Date;
  verifiedBy: string | null;
  now: Date;
  staleDays: number;
}): { stale: boolean; needsVerification: boolean; ageDays: number } {
  const ageDays = Math.floor((input.now.getTime() - input.lastVerified.getTime()) / (24 * 60 * 60 * 1000));
  return {
    stale: ageDays > input.staleDays,
    needsVerification: !input.verifiedBy,
    ageDays,
  };
}

function cloneRules(rules: MomRules): MomRules {
  return {
    ...rules,
    meta: { ...rules.meta, sources: rules.meta.sources.map((source) => ({ ...source })) },
    fdw: { ...rules.fdw, approvedSourceCountries: [...rules.fdw.approvedSourceCountries] },
    employer: { ...rules.employer },
    eop: { ...rules.eop },
    securityBond: { ...rules.securityBond, exemptNationalities: [...rules.securityBond.exemptNationalities] },
    insurance: { ...rules.insurance },
    sip: { ...rules.sip },
    medicalExam: { ...rules.medicalExam },
    publicHolidays: [...rules.publicHolidays],
  };
}

function asInt(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) ? number : null;
}

function asList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items : null;
  }
  if (typeof value === "string") {
    const items = value.split(",").map((item) => item.trim()).filter(Boolean);
    return items.length ? items : null;
  }
  return null;
}

/** Applies one stored override. Unknown keys and invalid values leave the rules unchanged. */
export function applyRuleOverride(rules: MomRules, key: string, value: unknown): MomRules {
  const next = cloneRules(rules);
  const definition = ruleDefinition(key);
  if (!definition || definition.kind === "dates") return rules;
  if (definition.kind === "int") {
    const number = asInt(value);
    if (number === null) return rules;
    if (key === "fdw.minAgeYears") next.fdw.minAgeYears = number;
    else if (key === "fdw.maxAgeYearsExclusive") next.fdw.maxAgeYearsExclusive = number;
    else if (key === "fdw.minEducationYears") next.fdw.minEducationYears = number;
    else if (key === "employer.minAgeYears") next.employer.minAgeYears = number;
    else if (key === "eop.leadWorkingDays") next.eop.leadWorkingDays = number;
    else if (key === "securityBond.amountSgd") next.securityBond.amountSgd = number;
    else if (key === "insurance.medicalAnnualClaimLimitSgd") next.insurance.medicalAnnualClaimLimitSgd = number;
    else if (key === "insurance.personalAccidentSumAssuredSgd") next.insurance.personalAccidentSumAssuredSgd = number;
    else if (key === "sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays") next.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays = number;
    else if (key === "medicalExam.deadlineDaysAfterArrival") next.medicalExam.deadlineDaysAfterArrival = number;
    else return rules;
    return next;
  }
  if (definition.kind === "boolean") {
    const flag = value === true || value === "true" || value === "yes";
    const negative = value === false || value === "false" || value === "no";
    if (!flag && !negative) return rules;
    if (key === "eop.requiredForFirstTimeEmployer") next.eop.requiredForFirstTimeEmployer = flag;
    else if (key === "sip.requiredForFirstTimeFdw") next.sip.requiredForFirstTimeFdw = flag;
    else return rules;
    return next;
  }
  if (definition.kind === "sex") {
    const sex = String(value ?? "").trim().toUpperCase();
    if (sex === "NONE" || sex === "NULL") next.fdw.requiredSex = null;
    else if (sex === "FEMALE" || sex === "MALE") next.fdw.requiredSex = sex;
    else return rules;
    return next;
  }
  const list = asList(value);
  if (!list) return rules;
  if (key === "fdw.approvedSourceCountries") next.fdw.approvedSourceCountries = list;
  else if (key === "securityBond.exemptNationalities") next.securityBond.exemptNationalities = list;
  else return rules;
  return next;
}

export function applyHolidayAdjustments(
  dates: string[],
  adjustments: { date: string; suppressed: boolean }[],
): string[] {
  const set = new Set(dates);
  for (const adjustment of adjustments) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustment.date)) continue;
    if (adjustment.suppressed) set.delete(adjustment.date);
    else set.add(adjustment.date);
  }
  return [...set].sort();
}
