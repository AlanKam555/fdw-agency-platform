import { MOM_VERIFICATION_STATUS, MOM_VERIFIED_ON, copyMomRules, type MomRules } from "@/config/mom-rules";

export type RuleKind = "int" | "boolean" | "sex" | "list" | "dates" | "day";

export type RuleDefinition = {
  key: string;
  name: string;
  unit: string;
  kind: RuleKind;
  sourceUrl: string;
  sourceUrls?: string[];
  verificationStatus: typeof MOM_VERIFICATION_STATUS;
  verifiedOn: string;
  read: (rules: MomRules) => string;
};

const FDW = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/fdw-eligibility";
const EMPLOYER = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employer-requirements";
const EOP = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employers-orientation-programme-eop";
const BOND = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/security-bond";
const INSURANCE = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/insurance-requirements";
const SIP = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/settling-in-programme-sip";
const MEDICAL = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/medical-examination";
const SIX_ME = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/six-monthly-medical-examination";
const LEVY = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/foreign-domestic-worker-levy/paying-levy";
const REST = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/employers-guide/rest-days-and-well-being";
const EA_FAQ = "https://www.mom.gov.sg/faq/employment-agencies/how-will-foreign-workers-know-the-amount-that-they-are-expected-to-pay-the-singapore-ea";
const EA_PDF = "https://www.mom.gov.sg/-/media/mom/documents/publications/foreign-workers/agency-fee-know-the-limits.pdf";
const HOLIDAYS = "https://www.mom.gov.sg/employment-practices/public-holidays";

function rule(
  partial: Omit<RuleDefinition, "verificationStatus" | "verifiedOn">,
): RuleDefinition {
  return {
    ...partial,
    verificationStatus: MOM_VERIFICATION_STATUS,
    verifiedOn: MOM_VERIFIED_ON,
  };
}

export const MOM_RULE_DEFINITIONS: RuleDefinition[] = [
  rule({ key: "fdw.minAgeYears", name: "Helper minimum age", unit: "years", kind: "int", sourceUrl: FDW, read: (rules) => String(rules.fdw.minAgeYears) }),
  rule({ key: "fdw.maxAgeYearsExclusive", name: "New application maximum age (exclusive)", unit: "years", kind: "int", sourceUrl: FDW, read: (rules) => String(rules.fdw.maxAgeYearsExclusive) }),
  rule({ key: "fdw.renewalMaxAgeYearsExclusive", name: "Renewal maximum age (exclusive)", unit: "years", kind: "int", sourceUrl: FDW, read: (rules) => String(rules.fdw.renewalMaxAgeYearsExclusive) }),
  rule({ key: "fdw.minEducationYears", name: "Minimum formal education", unit: "years", kind: "int", sourceUrl: FDW, read: (rules) => String(rules.fdw.minEducationYears) }),
  rule({ key: "fdw.requiredSex", name: "Statutory sex gate", unit: "sex", kind: "sex", sourceUrl: FDW, read: (rules) => rules.fdw.requiredSex ?? "none" }),
  rule({ key: "fdw.approvedSourceCountries", name: "Approved source countries", unit: "list", kind: "list", sourceUrl: FDW, read: (rules) => rules.fdw.approvedSourceCountries.join(", ") }),
  rule({ key: "employer.minAgeYears", name: "Employer minimum age", unit: "years", kind: "int", sourceUrl: EMPLOYER, read: (rules) => String(rules.employer.minAgeYears) }),
  rule({ key: "eop.requiredForFirstTimeEmployer", name: "EOP required for a first-time employer", unit: "yes/no", kind: "boolean", sourceUrl: EOP, read: (rules) => rules.eop.requiredForFirstTimeEmployer ? "yes" : "no" }),
  rule({ key: "eop.leadWorkingDays", name: "EOP lead time", unit: "working days", kind: "int", sourceUrl: EOP, read: (rules) => String(rules.eop.leadWorkingDays) }),
  rule({ key: "securityBond.amountSgd", name: "Security bond amount", unit: "SGD", kind: "int", sourceUrl: BOND, read: (rules) => String(rules.securityBond.amountSgd) }),
  rule({ key: "securityBond.exemptNationalities", name: "Security bond exemptions", unit: "list", kind: "list", sourceUrl: BOND, read: (rules) => rules.securityBond.exemptNationalities.join(", ") }),
  rule({ key: "insurance.medicalAnnualClaimLimitSgd", name: "Medical insurance annual claim limit", unit: "SGD", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.medicalAnnualClaimLimitSgd) }),
  rule({ key: "insurance.personalAccidentSumAssuredSgd", name: "Personal accident sum assured", unit: "SGD", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.personalAccidentSumAssuredSgd) }),
  rule({ key: "insurance.inpatientSubLimitCents", name: "Medical insurance inpatient sub-limit", unit: "cents", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.inpatientSubLimitCents) }),
  rule({ key: "insurance.daySurgerySubLimitCents", name: "Medical insurance day-surgery sub-limit", unit: "cents", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.daySurgerySubLimitCents) }),
  rule({ key: "insurance.coPaymentInsurerPercent", name: "Insurer share above the co-payment threshold", unit: "percent", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.coPaymentInsurerPercent) }),
  rule({ key: "insurance.coPaymentEmployerPercent", name: "Employer share above the co-payment threshold", unit: "percent", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.coPaymentEmployerPercent) }),
  rule({ key: "insurance.coPaymentThresholdCents", name: "Medical co-payment threshold", unit: "cents", kind: "int", sourceUrl: INSURANCE, read: (rules) => String(rules.insurance.coPaymentThresholdCents) }),
  rule({ key: "insurance.coPaymentEffectiveFrom", name: "Medical co-payment effective from", unit: "date", kind: "day", sourceUrl: INSURANCE, read: (rules) => rules.insurance.coPaymentEffectiveFrom }),
  rule({ key: "levy.firstHelperMonthlyCents", name: "Levy, first helper, per month", unit: "cents", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.firstHelperMonthlyCents) }),
  rule({ key: "levy.firstHelperDailyCents", name: "Levy, first helper, per day", unit: "cents", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.firstHelperDailyCents) }),
  rule({ key: "levy.subsequentHelperMonthlyCents", name: "Levy, subsequent helper, per month", unit: "cents", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.subsequentHelperMonthlyCents) }),
  rule({ key: "levy.subsequentHelperDailyCents", name: "Levy, subsequent helper, per day", unit: "cents", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.subsequentHelperDailyCents) }),
  rule({ key: "levy.concessionaryMonthlyCents", name: "Concessionary levy, per month", unit: "cents", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.concessionaryMonthlyCents) }),
  rule({ key: "levy.concessionaryDailyCents", name: "Concessionary levy, per day", unit: "cents", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.concessionaryDailyCents) }),
  rule({ key: "levy.concessionaryHelperCap", name: "Helpers who may receive the concessionary levy", unit: "helpers", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.concessionaryHelperCap) }),
  rule({ key: "levy.firstTimeStartDayInclusive", name: "First-time levy start day, counting arrival", unit: "day", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.firstTimeStartDayInclusive) }),
  rule({ key: "levy.laterHelperStartOffsetDays", name: "Later helper levy start, days after arrival", unit: "days", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.laterHelperStartOffsetDays) }),
  rule({ key: "levy.paymentDayOfFollowingMonth", name: "Levy payment day of the following month", unit: "day", kind: "int", sourceUrl: LEVY, read: (rules) => String(rules.levy.paymentDayOfFollowingMonth) }),
  rule({ key: "restDays.perWeek", name: "Rest days per week", unit: "days", kind: "int", sourceUrl: REST, read: (rules) => String(rules.restDays.perWeek) }),
  rule({ key: "restDays.compensationMinExtraDaysSalary", name: "Extra salary days if a rest day is worked", unit: "days", kind: "int", sourceUrl: REST, read: (rules) => String(rules.restDays.compensationMinExtraDaysSalary) }),
  rule({ key: "restDays.minNonCompensablePerMonth", name: "Rest days per month that cannot be compensated away", unit: "days", kind: "int", sourceUrl: REST, read: (rules) => String(rules.restDays.minNonCompensablePerMonth) }),
  rule({ key: "restDays.deferralMaxMonths", name: "How long the non-compensable rest day may be deferred", unit: "months", kind: "int", sourceUrl: REST, read: (rules) => String(rules.restDays.deferralMaxMonths) }),
  rule({ key: "sixMonthlyExam.intervalMonths", name: "Six-monthly medical examination interval", unit: "months", kind: "int", sourceUrl: SIX_ME, read: (rules) => String(rules.sixMonthlyExam.intervalMonths) }),
  rule({ key: "sixMonthlyExam.exemptFromAgeYears", name: "Age from which 6ME is not required", unit: "years", kind: "int", sourceUrl: SIX_ME, read: (rules) => String(rules.sixMonthlyExam.exemptFromAgeYears) }),
  rule({ key: "sip.requiredForFirstTimeFdw", name: "SIP required for a first-time helper", unit: "yes/no", kind: "boolean", sourceUrl: SIP, read: (rules) => rules.sip.requiredForFirstTimeFdw ? "yes" : "no" }),
  rule({ key: "sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays", name: "SIP deadline", unit: "days excluding Sunday and public holidays", kind: "int", sourceUrl: SIP, read: (rules) => String(rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays) }),
  rule({ key: "sip.cannotAttendOnArrivalDay", name: "SIP cannot be attended on the arrival day", unit: "yes/no", kind: "boolean", sourceUrl: SIP, read: (rules) => rules.sip.cannotAttendOnArrivalDay ? "yes" : "no" }),
  rule({ key: "medicalExam.deadlineDaysAfterArrival", name: "Medical examination deadline", unit: "calendar days", kind: "int", sourceUrl: MEDICAL, read: (rules) => String(rules.medicalExam.deadlineDaysAfterArrival) }),
  rule({ key: "eaFee.maxSalaryMonthsPerYear", name: "Agency fee charged to the helper, months of salary per year", unit: "months", kind: "int", sourceUrl: EA_FAQ, sourceUrls: [EA_FAQ, EA_PDF], read: (rules) => String(rules.eaFee.maxSalaryMonthsPerYear) }),
  rule({ key: "eaFee.maxSalaryMonths", name: "Agency fee charged to the helper, maximum months of salary", unit: "months", kind: "int", sourceUrl: EA_FAQ, sourceUrls: [EA_FAQ, EA_PDF], read: (rules) => String(rules.eaFee.maxSalaryMonths) }),
  rule({ key: "eaFee.earlyTerminationRefundPercent", name: "Agency fee refund if the employer terminates early", unit: "percent", kind: "int", sourceUrl: EA_PDF, sourceUrls: [EA_FAQ, EA_PDF], read: (rules) => String(rules.eaFee.earlyTerminationRefundPercent) }),
  rule({ key: "eaFee.earlyTerminationWithinMonths", name: "Early-termination refund window", unit: "months", kind: "int", sourceUrl: EA_PDF, sourceUrls: [EA_FAQ, EA_PDF], read: (rules) => String(rules.eaFee.earlyTerminationWithinMonths) }),
  rule({ key: "publicHolidays", name: "Public holidays used in deadline maths", unit: "dates", kind: "dates", sourceUrl: HOLIDAYS, read: (rules) => String(rules.publicHolidays.length) }),
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

const INT_SETTERS: Record<string, (rules: MomRules, value: number) => void> = {
  "fdw.minAgeYears": (rules, value) => {
    rules.fdw.minAgeYears = value;
  },
  "fdw.maxAgeYearsExclusive": (rules, value) => {
    rules.fdw.maxAgeYearsExclusive = value;
  },
  "fdw.renewalMaxAgeYearsExclusive": (rules, value) => {
    rules.fdw.renewalMaxAgeYearsExclusive = value;
  },
  "fdw.minEducationYears": (rules, value) => {
    rules.fdw.minEducationYears = value;
  },
  "employer.minAgeYears": (rules, value) => {
    rules.employer.minAgeYears = value;
  },
  "eop.leadWorkingDays": (rules, value) => {
    rules.eop.leadWorkingDays = value;
  },
  "securityBond.amountSgd": (rules, value) => {
    rules.securityBond.amountSgd = value;
  },
  "insurance.medicalAnnualClaimLimitSgd": (rules, value) => {
    rules.insurance.medicalAnnualClaimLimitSgd = value;
  },
  "insurance.personalAccidentSumAssuredSgd": (rules, value) => {
    rules.insurance.personalAccidentSumAssuredSgd = value;
  },
  "insurance.inpatientSubLimitCents": (rules, value) => {
    rules.insurance.inpatientSubLimitCents = value;
  },
  "insurance.daySurgerySubLimitCents": (rules, value) => {
    rules.insurance.daySurgerySubLimitCents = value;
  },
  "insurance.coPaymentInsurerPercent": (rules, value) => {
    rules.insurance.coPaymentInsurerPercent = value;
  },
  "insurance.coPaymentEmployerPercent": (rules, value) => {
    rules.insurance.coPaymentEmployerPercent = value;
  },
  "insurance.coPaymentThresholdCents": (rules, value) => {
    rules.insurance.coPaymentThresholdCents = value;
  },
  "sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays": (rules, value) => {
    rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays = value;
  },
  "medicalExam.deadlineDaysAfterArrival": (rules, value) => {
    rules.medicalExam.deadlineDaysAfterArrival = value;
  },
  "levy.firstHelperMonthlyCents": (rules, value) => {
    rules.levy.firstHelperMonthlyCents = value;
  },
  "levy.firstHelperDailyCents": (rules, value) => {
    rules.levy.firstHelperDailyCents = value;
  },
  "levy.subsequentHelperMonthlyCents": (rules, value) => {
    rules.levy.subsequentHelperMonthlyCents = value;
  },
  "levy.subsequentHelperDailyCents": (rules, value) => {
    rules.levy.subsequentHelperDailyCents = value;
  },
  "levy.concessionaryMonthlyCents": (rules, value) => {
    rules.levy.concessionaryMonthlyCents = value;
  },
  "levy.concessionaryDailyCents": (rules, value) => {
    rules.levy.concessionaryDailyCents = value;
  },
  "levy.concessionaryHelperCap": (rules, value) => {
    rules.levy.concessionaryHelperCap = value;
  },
  "levy.firstTimeStartDayInclusive": (rules, value) => {
    rules.levy.firstTimeStartDayInclusive = value;
  },
  "levy.laterHelperStartOffsetDays": (rules, value) => {
    rules.levy.laterHelperStartOffsetDays = value;
  },
  "levy.paymentDayOfFollowingMonth": (rules, value) => {
    rules.levy.paymentDayOfFollowingMonth = value;
  },
  "restDays.perWeek": (rules, value) => {
    rules.restDays.perWeek = value;
  },
  "restDays.compensationMinExtraDaysSalary": (rules, value) => {
    rules.restDays.compensationMinExtraDaysSalary = value;
  },
  "restDays.minNonCompensablePerMonth": (rules, value) => {
    rules.restDays.minNonCompensablePerMonth = value;
  },
  "restDays.deferralMaxMonths": (rules, value) => {
    rules.restDays.deferralMaxMonths = value;
  },
  "sixMonthlyExam.intervalMonths": (rules, value) => {
    rules.sixMonthlyExam.intervalMonths = value;
  },
  "sixMonthlyExam.exemptFromAgeYears": (rules, value) => {
    rules.sixMonthlyExam.exemptFromAgeYears = value;
  },
  "eaFee.maxSalaryMonthsPerYear": (rules, value) => {
    rules.eaFee.maxSalaryMonthsPerYear = value;
  },
  "eaFee.maxSalaryMonths": (rules, value) => {
    rules.eaFee.maxSalaryMonths = value;
  },
  "eaFee.earlyTerminationRefundPercent": (rules, value) => {
    rules.eaFee.earlyTerminationRefundPercent = value;
  },
  "eaFee.earlyTerminationWithinMonths": (rules, value) => {
    rules.eaFee.earlyTerminationWithinMonths = value;
  },
};

/** Applies one stored override. Unknown keys and invalid values leave the rules unchanged. */
export function applyRuleOverride(rules: MomRules, key: string, value: unknown): MomRules {
  const next = copyMomRules(rules);
  const definition = ruleDefinition(key);
  if (!definition || definition.kind === "dates") return rules;
  if (definition.kind === "int") {
    const number = asInt(value);
    const set = INT_SETTERS[key];
    if (number === null || !set) return rules;
    set(next, number);
    return next;
  }
  if (definition.kind === "day") {
    const day = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return rules;
    if (key === "insurance.coPaymentEffectiveFrom") next.insurance.coPaymentEffectiveFrom = day;
    else return rules;
    return next;
  }
  if (definition.kind === "boolean") {
    const flag = value === true || value === "true" || value === "yes";
    const negative = value === false || value === "false" || value === "no";
    if (!flag && !negative) return rules;
    if (key === "eop.requiredForFirstTimeEmployer") next.eop.requiredForFirstTimeEmployer = flag;
    else if (key === "sip.requiredForFirstTimeFdw") next.sip.requiredForFirstTimeFdw = flag;
    else if (key === "sip.cannotAttendOnArrivalDay") next.sip.cannotAttendOnArrivalDay = flag;
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
