import { officialHolidayDates } from "@/config/public-holidays";

/**
 * Configurable Ministry of Manpower (MOM) migrant domestic worker (MDW)
 * work-permit preparation values.
 *
 * VERIFY AGAINST CURRENT MOM GUIDANCE before operational use.
 * Money added in this file is integer cents (S$300 is 30000). MOM can change
 * any figure without notice. Nothing in this file submits an application to MOM.
 */

export const MOM_VERIFICATION_STATUS = "verify against current MOM guidance" as const;
export const MOM_VERIFIED_ON = "2026-11-28";

export type MomRuleStamp = {
  verificationStatus: typeof MOM_VERIFICATION_STATUS;
  verifiedOn: string;
  sourceUrl: string;
};

const FDW_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/fdw-eligibility";
const EMPLOYER_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employer-requirements";
const EOP_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employers-orientation-programme-eop";
const BOND_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/security-bond";
const INSURANCE_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/insurance-requirements";
const SIP_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/settling-in-programme-sip";
const MEDICAL_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/medical-examination";
const SIX_ME_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/six-monthly-medical-examination";
const LEVY_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/foreign-domestic-worker-levy/paying-levy";
const REST_URL =
  "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/employers-guide/rest-days-and-well-being";
const EA_FEE_FAQ_URL =
  "https://www.mom.gov.sg/faq/employment-agencies/how-will-foreign-workers-know-the-amount-that-they-are-expected-to-pay-the-singapore-ea";
const EA_FEE_PDF_URL =
  "https://www.mom.gov.sg/-/media/mom/documents/publications/foreign-workers/agency-fee-know-the-limits.pdf";
const HUB_URL = "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker";

function stamp(sourceUrl: string): MomRuleStamp {
  return {
    verificationStatus: MOM_VERIFICATION_STATUS,
    verifiedOn: MOM_VERIFIED_ON,
    sourceUrl,
  };
}

export type MomRules = {
  meta: {
    verificationStatus: typeof MOM_VERIFICATION_STATUS;
    lastTranscribed: string;
    verifiedOn: string;
    sources: { title: string; url: string }[];
  };
  fdw: MomRuleStamp & {
    minAgeYears: number;
    /** New applications must be below this age. */
    maxAgeYearsExclusive: number;
    /** A helper aged 50 or older may renew until below this age. */
    renewalMaxAgeYearsExclusive: number;
    minEducationYears: number;
    /** Statutory sex gate published by MOM. Set to null if MOM no longer imposes one. */
    requiredSex: "FEMALE" | "MALE" | null;
    approvedSourceCountries: string[];
  };
  employer: MomRuleStamp & {
    minAgeYears: number;
  };
  eop: MomRuleStamp & {
    requiredForFirstTimeEmployer: boolean;
    leadWorkingDays: number;
  };
  securityBond: MomRuleStamp & {
    amountSgd: number;
    exemptNationalities: string[];
  };
  insurance: MomRuleStamp & {
    medicalAnnualClaimLimitSgd: number;
    personalAccidentSumAssuredSgd: number;
    /** Each of inpatient and day surgery must meet this annual sub-limit. Integer cents. */
    inpatientSubLimitCents: number;
    daySurgerySubLimitCents: number;
    coPaymentInsurerPercent: number;
    coPaymentEmployerPercent: number;
    /** Claims above this amount use the co-payment split. Integer cents. */
    coPaymentThresholdCents: number;
    coPaymentEffectiveFrom: string;
  };
  sip: MomRuleStamp & {
    requiredForFirstTimeFdw: boolean;
    deadlineDaysAfterArrivalExcludingSundayAndHolidays: number;
    cannotAttendOnArrivalDay: boolean;
  };
  medicalExam: MomRuleStamp & {
    deadlineDaysAfterArrival: number;
  };
  levy: MomRuleStamp & {
    firstHelperMonthlyCents: number;
    firstHelperDailyCents: number;
    subsequentHelperMonthlyCents: number;
    subsequentHelperDailyCents: number;
    concessionaryMonthlyCents: number;
    concessionaryDailyCents: number;
    concessionaryHelperCap: number;
    /** First-time helper: levy starts on this day of arrival, and the arrival date counts as day 1. */
    firstTimeStartDayInclusive: number;
    /** Any later helper: levy starts this many calendar days after arrival. */
    laterHelperStartOffsetDays: number;
    paymentDayOfFollowingMonth: number;
  };
  restDays: MomRuleStamp & {
    perWeek: number;
    /** If she agrees to work a rest day, pay at least this many extra days of salary. */
    compensationMinExtraDaysSalary: number;
    /** At least this many rest days in a month cannot be bought out. */
    minNonCompensablePerMonth: number;
    nonCompensableMayBeTwoHalfDays: boolean;
    deferralMaxMonths: number;
  };
  sixMonthlyExam: MomRuleStamp & {
    intervalMonths: number;
    /** Helpers who have reached this age are exempt and only need an exam on renewal. */
    exemptFromAgeYears: number;
  };
  eaFee: MomRuleStamp & {
    sourceUrls: string[];
    maxSalaryMonthsPerYear: number;
    maxSalaryMonths: number;
    earlyTerminationRefundPercent: number;
    earlyTerminationWithinMonths: number;
  };
  /** ISO dates YYYY-MM-DD. Empty until an operator maintains Singapore public holidays. */
  publicHolidays: string[];
};

const transcribedMomRules: MomRules = {
  meta: {
    verificationStatus: MOM_VERIFICATION_STATUS,
    lastTranscribed: "2026-11-26",
    verifiedOn: MOM_VERIFIED_ON,
    sources: [
      { title: "Migrant domestic worker eligibility", url: FDW_URL },
      { title: "Employer requirements for hiring an MDW", url: EMPLOYER_URL },
      { title: "Employers' Orientation Programme (EOP)", url: EOP_URL },
      { title: "Security bond requirements for MDWs", url: BOND_URL },
      { title: "Insurance requirements for MDWs", url: INSURANCE_URL },
      { title: "Settling-in Programme (SIP) for first-time MDWs", url: SIP_URL },
      { title: "Pre-employment medical examination for MDWs", url: MEDICAL_URL },
      { title: "Six-monthly medical examination", url: SIX_ME_URL },
      { title: "Levy payment for a migrant domestic worker", url: LEVY_URL },
      { title: "Rest days and well-being", url: REST_URL },
      { title: "Agency fee: Know the Limits", url: EA_FEE_FAQ_URL },
      { title: "Work Permit for migrant domestic worker", url: HUB_URL },
    ],
  },
  fdw: {
    ...stamp(FDW_URL),
    minAgeYears: 23,
    maxAgeYearsExclusive: 50,
    renewalMaxAgeYearsExclusive: 60,
    minEducationYears: 8,
    requiredSex: "FEMALE",
    approvedSourceCountries: [
      "Bangladesh",
      "Cambodia",
      "Hong Kong",
      "India",
      "Indonesia",
      "Macau",
      "Malaysia",
      "Myanmar",
      "Philippines",
      "South Korea",
      "Sri Lanka",
      "Taiwan",
      "Thailand",
    ],
  },
  employer: { ...stamp(EMPLOYER_URL), minAgeYears: 21 },
  eop: { ...stamp(EOP_URL), requiredForFirstTimeEmployer: true, leadWorkingDays: 2 },
  securityBond: { ...stamp(BOND_URL), amountSgd: 5000, exemptNationalities: ["Malaysia"] },
  insurance: {
    ...stamp(INSURANCE_URL),
    medicalAnnualClaimLimitSgd: 60000,
    personalAccidentSumAssuredSgd: 60000,
    inpatientSubLimitCents: 6_000_000,
    daySurgerySubLimitCents: 6_000_000,
    coPaymentInsurerPercent: 75,
    coPaymentEmployerPercent: 25,
    coPaymentThresholdCents: 1_500_000,
    coPaymentEffectiveFrom: "2023-07-01",
  },
  sip: {
    ...stamp(SIP_URL),
    requiredForFirstTimeFdw: true,
    deadlineDaysAfterArrivalExcludingSundayAndHolidays: 7,
    cannotAttendOnArrivalDay: true,
  },
  medicalExam: { ...stamp(MEDICAL_URL), deadlineDaysAfterArrival: 14 },
  levy: {
    ...stamp(LEVY_URL),
    firstHelperMonthlyCents: 30_000,
    firstHelperDailyCents: 987,
    subsequentHelperMonthlyCents: 45_000,
    subsequentHelperDailyCents: 1480,
    concessionaryMonthlyCents: 6_000,
    concessionaryDailyCents: 198,
    concessionaryHelperCap: 2,
    firstTimeStartDayInclusive: 5,
    laterHelperStartOffsetDays: 1,
    paymentDayOfFollowingMonth: 17,
  },
  restDays: {
    ...stamp(REST_URL),
    perWeek: 1,
    compensationMinExtraDaysSalary: 1,
    minNonCompensablePerMonth: 1,
    nonCompensableMayBeTwoHalfDays: true,
    deferralMaxMonths: 1,
  },
  sixMonthlyExam: {
    ...stamp(SIX_ME_URL),
    intervalMonths: 6,
    exemptFromAgeYears: 50,
  },
  eaFee: {
    ...stamp(EA_FEE_FAQ_URL),
    sourceUrls: [EA_FEE_FAQ_URL, EA_FEE_PDF_URL],
    maxSalaryMonthsPerYear: 1,
    maxSalaryMonths: 2,
    earlyTerminationRefundPercent: 50,
    earlyTerminationWithinMonths: 6,
  },
  publicHolidays: [],
};

function intEnv(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : fallback;
}

export function copyMomRules(base: MomRules): MomRules {
  return {
    ...base,
    meta: { ...base.meta, sources: base.meta.sources.map((source) => ({ ...source })) },
    fdw: { ...base.fdw, approvedSourceCountries: [...base.fdw.approvedSourceCountries] },
    employer: { ...base.employer },
    eop: { ...base.eop },
    securityBond: { ...base.securityBond, exemptNationalities: [...base.securityBond.exemptNationalities] },
    insurance: { ...base.insurance },
    sip: { ...base.sip },
    medicalExam: { ...base.medicalExam },
    levy: { ...base.levy },
    restDays: { ...base.restDays },
    sixMonthlyExam: { ...base.sixMonthlyExam },
    eaFee: { ...base.eaFee, sourceUrls: [...base.eaFee.sourceUrls] },
    publicHolidays: [...base.publicHolidays],
  };
}

/** Copies the transcribed rules and applies operator env overrides. Unset vars keep the transcribed defaults. */
export function loadMomRules(
  base: MomRules = transcribedMomRules,
  env: NodeJS.ProcessEnv = process.env,
): MomRules {
  const rules = copyMomRules(base);
  const set = (name: string, fallback: number) => intEnv(name, fallback, env);
  rules.fdw.minAgeYears = set("MOM_FDW_MIN_AGE", rules.fdw.minAgeYears);
  rules.fdw.maxAgeYearsExclusive = set("MOM_FDW_MAX_AGE_EXCLUSIVE", rules.fdw.maxAgeYearsExclusive);
  rules.fdw.renewalMaxAgeYearsExclusive = set("MOM_FDW_RENEWAL_MAX_AGE_EXCLUSIVE", rules.fdw.renewalMaxAgeYearsExclusive);
  rules.fdw.minEducationYears = set("MOM_FDW_MIN_EDUCATION_YEARS", rules.fdw.minEducationYears);
  rules.employer.minAgeYears = set("MOM_EMPLOYER_MIN_AGE", rules.employer.minAgeYears);
  rules.eop.leadWorkingDays = set("MOM_EOP_LEAD_WORKING_DAYS", rules.eop.leadWorkingDays);
  rules.securityBond.amountSgd = set("MOM_SECURITY_BOND_SGD", rules.securityBond.amountSgd);
  rules.insurance.medicalAnnualClaimLimitSgd = set("MOM_MEDICAL_INSURANCE_SGD", rules.insurance.medicalAnnualClaimLimitSgd);
  rules.insurance.personalAccidentSumAssuredSgd = set("MOM_PERSONAL_ACCIDENT_SGD", rules.insurance.personalAccidentSumAssuredSgd);
  rules.insurance.inpatientSubLimitCents = set("MOM_MEDICAL_INPATIENT_CENTS", rules.insurance.inpatientSubLimitCents);
  rules.insurance.daySurgerySubLimitCents = set("MOM_MEDICAL_DAY_SURGERY_CENTS", rules.insurance.daySurgerySubLimitCents);
  rules.insurance.coPaymentInsurerPercent = set("MOM_MEDICAL_COPAY_INSURER_PERCENT", rules.insurance.coPaymentInsurerPercent);
  rules.insurance.coPaymentEmployerPercent = set("MOM_MEDICAL_COPAY_EMPLOYER_PERCENT", rules.insurance.coPaymentEmployerPercent);
  rules.insurance.coPaymentThresholdCents = set("MOM_MEDICAL_COPAY_THRESHOLD_CENTS", rules.insurance.coPaymentThresholdCents);
  rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays = set("MOM_SIP_DEADLINE_DAYS", rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays);
  rules.medicalExam.deadlineDaysAfterArrival = set("MOM_MEDICAL_EXAM_DEADLINE_DAYS", rules.medicalExam.deadlineDaysAfterArrival);
  rules.levy.firstHelperMonthlyCents = set("MOM_LEVY_FIRST_MONTHLY_CENTS", rules.levy.firstHelperMonthlyCents);
  rules.levy.firstHelperDailyCents = set("MOM_LEVY_FIRST_DAILY_CENTS", rules.levy.firstHelperDailyCents);
  rules.levy.subsequentHelperMonthlyCents = set("MOM_LEVY_SUBSEQUENT_MONTHLY_CENTS", rules.levy.subsequentHelperMonthlyCents);
  rules.levy.subsequentHelperDailyCents = set("MOM_LEVY_SUBSEQUENT_DAILY_CENTS", rules.levy.subsequentHelperDailyCents);
  rules.levy.concessionaryMonthlyCents = set("MOM_LEVY_CONCESSION_MONTHLY_CENTS", rules.levy.concessionaryMonthlyCents);
  rules.levy.concessionaryDailyCents = set("MOM_LEVY_CONCESSION_DAILY_CENTS", rules.levy.concessionaryDailyCents);
  rules.levy.concessionaryHelperCap = set("MOM_LEVY_CONCESSION_CAP", rules.levy.concessionaryHelperCap);
  rules.levy.firstTimeStartDayInclusive = set("MOM_LEVY_FIRST_START_DAY", rules.levy.firstTimeStartDayInclusive);
  rules.levy.laterHelperStartOffsetDays = set("MOM_LEVY_LATER_START_OFFSET_DAYS", rules.levy.laterHelperStartOffsetDays);
  rules.levy.paymentDayOfFollowingMonth = set("MOM_LEVY_PAYMENT_DAY", rules.levy.paymentDayOfFollowingMonth);
  rules.restDays.perWeek = set("MOM_REST_DAYS_PER_WEEK", rules.restDays.perWeek);
  rules.restDays.minNonCompensablePerMonth = set("MOM_REST_DAYS_MIN_PER_MONTH", rules.restDays.minNonCompensablePerMonth);
  rules.restDays.compensationMinExtraDaysSalary = set("MOM_REST_DAY_COMPENSATION_DAYS", rules.restDays.compensationMinExtraDaysSalary);
  rules.restDays.deferralMaxMonths = set("MOM_REST_DAY_DEFERRAL_MONTHS", rules.restDays.deferralMaxMonths);
  rules.sixMonthlyExam.intervalMonths = set("MOM_6ME_INTERVAL_MONTHS", rules.sixMonthlyExam.intervalMonths);
  rules.sixMonthlyExam.exemptFromAgeYears = set("MOM_6ME_EXEMPT_FROM_AGE", rules.sixMonthlyExam.exemptFromAgeYears);
  rules.eaFee.maxSalaryMonthsPerYear = set("MOM_EA_FEE_MONTHS_PER_YEAR", rules.eaFee.maxSalaryMonthsPerYear);
  rules.eaFee.maxSalaryMonths = set("MOM_EA_FEE_MAX_MONTHS", rules.eaFee.maxSalaryMonths);
  rules.eaFee.earlyTerminationRefundPercent = set("MOM_EA_FEE_REFUND_PERCENT", rules.eaFee.earlyTerminationRefundPercent);
  rules.eaFee.earlyTerminationWithinMonths = set("MOM_EA_FEE_REFUND_WITHIN_MONTHS", rules.eaFee.earlyTerminationWithinMonths);
  const copayFrom = env.MOM_MEDICAL_COPAY_FROM?.trim();
  if (copayFrom && /^\d{4}-\d{2}-\d{2}$/.test(copayFrom)) rules.insurance.coPaymentEffectiveFrom = copayFrom;
  const sex = env.MOM_REQUIRED_SEX?.trim().toUpperCase();
  if (sex === "NONE" || sex === "NULL") rules.fdw.requiredSex = null;
  else if (sex === "FEMALE" || sex === "MALE") rules.fdw.requiredSex = sex;
  const countries = env.MOM_APPROVED_COUNTRIES?.split(",").map((item) => item.trim()).filter(Boolean);
  if (countries && countries.length) rules.fdw.approvedSourceCountries = countries;
  const holidays = env.MOM_PUBLIC_HOLIDAYS?.split(",").map((item) => item.trim()).filter(Boolean);
  if (holidays && holidays.length) rules.publicHolidays = holidays;
  else if (rules.publicHolidays.length === 0) rules.publicHolidays = officialHolidayDates();
  const exempt = env.MOM_BOND_EXEMPT_NATIONALITIES?.split(",").map((item) => item.trim()).filter(Boolean);
  if (exempt && exempt.length) rules.securityBond.exemptNationalities = exempt;
  if (env.MOM_SIP_ARRIVAL_DAY?.trim().toLowerCase() === "allow") rules.sip.cannotAttendOnArrivalDay = false;
  return rules;
}

export const momRules: MomRules = loadMomRules();

export function countryOnList(nationality: string, list: string[]): boolean {
  const needle = nationality.trim().toLowerCase();
  return list.some((item) => item.toLowerCase() === needle);
}

export const EA_FEE_SOURCES = [EA_FEE_FAQ_URL, EA_FEE_PDF_URL] as const;
