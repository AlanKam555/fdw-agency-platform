import { momRules, type MomRules, countryOnList } from "@/config/mom-rules";
import { addWorkingDays, completedYears, onOrAfter } from "@/lib/mom/dates";

export type FdwEligibilityInput = {
  dateOfBirth: Date;
  nationality: string;
  educationYears: number;
  sex: "FEMALE" | "MALE" | "UNSPECIFIED";
  on?: Date;
};

export type EmployerEligibilityInput = {
  dateOfBirth: Date | null;
  isUndischargedBankrupt: boolean | null;
  firstTimeEmployer: boolean;
  eopCompleted: boolean;
  eopCompletedOn: Date | null;
  proposedSubmissionDate: Date;
};

export type CheckStatus = "pass" | "fail" | "missing";

export type EligibilityCheck = {
  id: string;
  status: CheckStatus;
  detail: string;
};

export function evaluateFdw(
  input: FdwEligibilityInput,
  rules: MomRules = momRules,
): EligibilityCheck[] {
  const on = input.on ?? new Date();
  const age = completedYears(input.dateOfBirth, on);
  const checks: EligibilityCheck[] = [
    {
      id: "fdw_min_age",
      status: age >= rules.fdw.minAgeYears ? "pass" : "fail",
      detail: `Completed age is ${age}. Configured minimum is ${rules.fdw.minAgeYears}.`,
    },
    {
      id: "fdw_max_age",
      status: age < rules.fdw.maxAgeYearsExclusive ? "pass" : "fail",
      detail: `Completed age is ${age}. Configured rule is below ${rules.fdw.maxAgeYearsExclusive}.`,
    },
    {
      id: "fdw_source_country",
      status: countryOnList(input.nationality, rules.fdw.approvedSourceCountries)
        ? "pass"
        : "fail",
      detail: `${input.nationality} is ${
        countryOnList(input.nationality, rules.fdw.approvedSourceCountries)
          ? "on"
          : "not on"
      } the configured approved source list.`,
    },
    {
      id: "fdw_education",
      status: input.educationYears >= rules.fdw.minEducationYears ? "pass" : "fail",
      detail: `${input.educationYears} years of formal education. Configured minimum is ${rules.fdw.minEducationYears}.`,
    },
  ];
  if (rules.fdw.requiredSex) {
    checks.push({
      id: "fdw_statutory_sex",
      status: input.sex === rules.fdw.requiredSex ? "pass" : "fail",
      detail: `Configured MOM statutory sex gate is ${rules.fdw.requiredSex}. This is a pass/fail legal check, not a ranking weight. Set requiredSex to null if MOM withdraws the rule.`,
    });
  }
  return checks;
}

export function evaluateEmployer(
  input: EmployerEligibilityInput,
  rules: MomRules = momRules,
): EligibilityCheck[] {
  const checks: EligibilityCheck[] = [];
  if (!input.dateOfBirth) {
    checks.push({
      id: "employer_age",
      status: "missing",
      detail: "Employer date of birth is not on file.",
    });
  } else {
    const age = completedYears(input.dateOfBirth, input.proposedSubmissionDate);
    checks.push({
      id: "employer_age",
      status: age >= rules.employer.minAgeYears ? "pass" : "fail",
      detail: `Employer completed age is ${age}. Configured minimum is ${rules.employer.minAgeYears}.`,
    });
  }

  if (input.isUndischargedBankrupt === null) {
    checks.push({
      id: "employer_bankruptcy",
      status: "missing",
      detail: "Staff have not recorded whether the employer is an undischarged bankrupt.",
    });
  } else {
    checks.push({
      id: "employer_bankruptcy",
      status: input.isUndischargedBankrupt ? "fail" : "pass",
      detail: input.isUndischargedBankrupt
        ? "Recorded as an undischarged bankrupt."
        : "Recorded as not an undischarged bankrupt.",
    });
  }

  if (!rules.eop.requiredForFirstTimeEmployer || !input.firstTimeEmployer) {
    checks.push({
      id: "employer_eop",
      status: "pass",
      detail: input.firstTimeEmployer
        ? "EOP is not required by the current configuration."
        : "Repeat employer: configured rules do not require EOP.",
    });
  } else if (!input.eopCompleted || !input.eopCompletedOn) {
    checks.push({
      id: "employer_eop",
      status: "fail",
      detail:
        "First-time employer has not completed the Employers' Orientation Programme.",
    });
  } else {
    const earliest = addWorkingDays(
      input.eopCompletedOn,
      rules.eop.leadWorkingDays,
      rules.publicHolidays,
    );
    const ok = onOrAfter(input.proposedSubmissionDate, earliest);
    checks.push({
      id: "employer_eop",
      status: ok ? "pass" : "fail",
      detail: ok
        ? `EOP completed with at least ${rules.eop.leadWorkingDays} working days before the proposed submission date.`
        : `EOP must be at least ${rules.eop.leadWorkingDays} working days before submission. Earliest configured date is ${earliest.toISOString().slice(0, 10)}.`,
    });
  }

  return checks;
}

export function securityBondRequired(
  nationality: string,
  rules: MomRules = momRules,
): boolean {
  return !countryOnList(nationality, rules.securityBond.exemptNationalities);
}
