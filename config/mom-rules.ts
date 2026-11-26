/**
 * Configurable Ministry of Manpower (MOM) migrant domestic worker (MDW)
 * work-permit preparation values.
 *
 * VERIFY AGAINST CURRENT MOM GUIDANCE before operational use.
 * These figures were transcribed for this MVP on 2026-11-26 from the public
 * pages cited below. MOM can change them without notice. Nothing in this file
 * submits an application to MOM.
 */

export type MomRules = {
  meta: {
    verificationStatus: "verify against current MOM guidance";
    lastTranscribed: string;
    sources: { title: string; url: string }[];
  };
  fdw: {
    minAgeYears: number;
    maxAgeYearsExclusive: number;
    minEducationYears: number;
    /** Statutory sex gate published by MOM. Set to null if MOM no longer imposes one. */
    requiredSex: "FEMALE" | "MALE" | null;
    approvedSourceCountries: string[];
  };
  employer: {
    minAgeYears: number;
  };
  eop: {
    requiredForFirstTimeEmployer: boolean;
    leadWorkingDays: number;
  };
  securityBond: {
    amountSgd: number;
    exemptNationalities: string[];
  };
  insurance: {
    medicalAnnualClaimLimitSgd: number;
    personalAccidentSumAssuredSgd: number;
  };
  sip: {
    requiredForFirstTimeFdw: boolean;
    deadlineDaysAfterArrivalExcludingSundayAndHolidays: number;
  };
  medicalExam: {
    deadlineDaysAfterArrival: number;
  };
  /** ISO dates YYYY-MM-DD. Empty until an operator maintains Singapore public holidays. */
  publicHolidays: string[];
};

const transcribedMomRules: MomRules = {
  meta: {
    verificationStatus: "verify against current MOM guidance",
    lastTranscribed: "2026-11-26",
    sources: [
      {
        title: "Migrant domestic worker eligibility",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/fdw-eligibility",
      },
      {
        title: "Employer requirements for hiring an MDW",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employer-requirements",
      },
      {
        title: "Employers' Orientation Programme (EOP)",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employers-orientation-programme-eop",
      },
      {
        title: "Security bond requirements for MDWs",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/security-bond",
      },
      {
        title: "Insurance requirements for MDWs",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/insurance-requirements",
      },
      {
        title: "Settling-in Programme (SIP) for first-time MDWs",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/settling-in-programme-sip",
      },
      {
        title: "Pre-employment medical examination for MDWs",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/medical-examination",
      },
      {
        title: "Work Permit for migrant domestic worker",
        url: "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker",
      },
    ],
  },
  fdw: {
    minAgeYears: 23,
    maxAgeYearsExclusive: 50,
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
  employer: {
    minAgeYears: 21,
  },
  eop: {
    requiredForFirstTimeEmployer: true,
    leadWorkingDays: 2,
  },
  securityBond: {
    amountSgd: 5000,
    exemptNationalities: ["Malaysia"],
  },
  insurance: {
    medicalAnnualClaimLimitSgd: 60000,
    personalAccidentSumAssuredSgd: 60000,
  },
  sip: {
    requiredForFirstTimeFdw: true,
    deadlineDaysAfterArrivalExcludingSundayAndHolidays: 7,
  },
  medicalExam: {
    deadlineDaysAfterArrival: 14,
  },
  publicHolidays: [],
};

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : fallback;
}

/** Copies the transcribed rules and applies operator env overrides. Unset vars keep the transcribed defaults. */
export function loadMomRules(base: MomRules = transcribedMomRules): MomRules {
  const rules: MomRules = {
    ...base,
    meta: { ...base.meta, sources: [...base.meta.sources] },
    fdw: { ...base.fdw, approvedSourceCountries: [...base.fdw.approvedSourceCountries] },
    employer: { ...base.employer },
    eop: { ...base.eop },
    securityBond: { ...base.securityBond, exemptNationalities: [...base.securityBond.exemptNationalities] },
    insurance: { ...base.insurance },
    sip: { ...base.sip },
    medicalExam: { ...base.medicalExam },
    publicHolidays: [...base.publicHolidays],
  };
  rules.fdw.minAgeYears = intEnv("MOM_FDW_MIN_AGE", rules.fdw.minAgeYears);
  rules.fdw.maxAgeYearsExclusive = intEnv("MOM_FDW_MAX_AGE_EXCLUSIVE", rules.fdw.maxAgeYearsExclusive);
  rules.fdw.minEducationYears = intEnv("MOM_FDW_MIN_EDUCATION_YEARS", rules.fdw.minEducationYears);
  rules.employer.minAgeYears = intEnv("MOM_EMPLOYER_MIN_AGE", rules.employer.minAgeYears);
  rules.eop.leadWorkingDays = intEnv("MOM_EOP_LEAD_WORKING_DAYS", rules.eop.leadWorkingDays);
  rules.securityBond.amountSgd = intEnv("MOM_SECURITY_BOND_SGD", rules.securityBond.amountSgd);
  rules.insurance.medicalAnnualClaimLimitSgd = intEnv("MOM_MEDICAL_INSURANCE_SGD", rules.insurance.medicalAnnualClaimLimitSgd);
  rules.insurance.personalAccidentSumAssuredSgd = intEnv("MOM_PERSONAL_ACCIDENT_SGD", rules.insurance.personalAccidentSumAssuredSgd);
  rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays = intEnv("MOM_SIP_DEADLINE_DAYS", rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays);
  rules.medicalExam.deadlineDaysAfterArrival = intEnv("MOM_MEDICAL_EXAM_DEADLINE_DAYS", rules.medicalExam.deadlineDaysAfterArrival);
  const sex = process.env.MOM_REQUIRED_SEX?.trim().toUpperCase();
  if (sex === "NONE" || sex === "NULL") rules.fdw.requiredSex = null;
  else if (sex === "FEMALE" || sex === "MALE") rules.fdw.requiredSex = sex;
  const countries = process.env.MOM_APPROVED_COUNTRIES?.split(",").map((item) => item.trim()).filter(Boolean);
  if (countries && countries.length) rules.fdw.approvedSourceCountries = countries;
  const holidays = process.env.MOM_PUBLIC_HOLIDAYS?.split(",").map((item) => item.trim()).filter(Boolean);
  if (holidays && holidays.length) rules.publicHolidays = holidays;
  const exempt = process.env.MOM_BOND_EXEMPT_NATIONALITIES?.split(",").map((item) => item.trim()).filter(Boolean);
  if (exempt && exempt.length) rules.securityBond.exemptNationalities = exempt;
  return rules;
}

export const momRules: MomRules = loadMomRules();

export function countryOnList(nationality: string, list: string[]): boolean {
  const needle = nationality.trim().toLowerCase();
  return list.some((item) => item.toLowerCase() === needle);
}
