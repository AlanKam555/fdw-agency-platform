import { momRules, type MomRules } from "@/config/mom-rules";
import {
  assessRestDaysPerMonth,
  assessWorkerAgencyFee,
  levyRate,
  medicalSubLimitsMeetMinimum,
  sgdFromCents,
  sixMonthlyExamRequired,
  sipAttendanceAllowed,
  type PermitAction,
} from "@/lib/mom/compliance";
import { completedYears } from "@/lib/mom/dates";
import {
  evaluateEmployer,
  evaluateFdw,
  securityBondRequired,
  type CheckStatus,
} from "@/lib/mom/eligibility";

export type ChecklistSection =
  | "fdw_eligibility"
  | "employer_eligibility"
  | "before_submission"
  | "before_arrival"
  | "after_arrival"
  | "agency_boundary";

export type ChecklistItem = {
  id: string;
  section: ChecklistSection;
  status: CheckStatus | "attest" | "reminder" | "info";
  label: string;
  detail: string;
  sourceUrl: string;
};

export type MomPackInput = {
  fdw: {
    fullName: string;
    dateOfBirth: Date;
    nationality: string;
    educationYears: number;
    sex: "FEMALE" | "MALE" | "UNSPECIFIED";
    firstTimeInSingapore: boolean;
    salaryExpectationSgd: number;
  };
  employer: {
    fullName: string;
    dateOfBirth: Date | null;
    isUndischargedBankrupt: boolean | null;
    firstTimeEmployer: boolean;
    eopCompleted: boolean;
    eopCompletedOn: Date | null;
    childrenUnder7Count: number;
    measlesVaccinatedUnder7: boolean | null;
    addressArea: string;
  };
  attestation: {
    notRelated: boolean;
    fdwOutsideSingapore: boolean;
    securityBondArranged: boolean;
    medicalInsuranceArranged: boolean;
    personalAccidentArranged: boolean;
    addressIsNricRegistered: boolean;
    salaryAgreedSgd: number;
    restDaysPerMonth: number;
    proposedSubmissionDate: Date;
    arrivalOn?: Date | null;
    permitAction?: PermitAction;
    sipOn?: Date | null;
    inpatientSubLimitSgd?: number | null;
    daySurgerySubLimitSgd?: number | null;
    workerFeeSgd?: number | null;
    contractMonths?: number | null;
    workPassMonths?: number | null;
  };
};

function source(rules: MomRules, titleIncludes: string): string {
  return (
    rules.meta.sources.find((item) => item.title.includes(titleIncludes))?.url ??
    rules.meta.sources[0]?.url ??
    "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker"
  );
}

export function buildChecklist(
  input: MomPackInput,
  rules: MomRules = momRules,
): { items: ChecklistItem[]; ready: boolean } {
  const items: ChecklistItem[] = [];
  const on = input.attestation.proposedSubmissionDate;

  for (const check of evaluateFdw(
    { ...input.fdw, on, permitAction: input.attestation.permitAction ?? "new" },
    rules,
  )) {
    items.push({
      id: check.id,
      section: "fdw_eligibility",
      status: check.status,
      label: check.id,
      detail: check.detail,
      sourceUrl: source(rules, "worker eligibility"),
    });
  }

  for (const check of evaluateEmployer(
    {
      dateOfBirth: input.employer.dateOfBirth,
      isUndischargedBankrupt: input.employer.isUndischargedBankrupt,
      firstTimeEmployer: input.employer.firstTimeEmployer,
      eopCompleted: input.employer.eopCompleted,
      eopCompletedOn: input.employer.eopCompletedOn,
      proposedSubmissionDate: on,
    },
    rules,
  )) {
    items.push({
      id: check.id,
      section: "employer_eligibility",
      status: check.status,
      label: check.id,
      detail: check.detail,
      sourceUrl: source(rules, "Employer requirements"),
    });
  }

  items.push({
    id: "not_related",
    section: "before_submission",
    status: input.attestation.notRelated ? "pass" : "attest",
    label: "Helper is not related to the employer",
    detail: input.attestation.notRelated
      ? "Staff attested that the helper is not related to the employer."
      : "Staff must attest that the helper is not related to the employer before submission.",
    sourceUrl: source(rules, "worker eligibility"),
  });

  const malaysian = !securityBondRequired(input.fdw.nationality, rules);
  items.push({
    id: "outside_singapore",
    section: "before_submission",
    status:
      malaysian || input.attestation.fdwOutsideSingapore ? "pass" : "attest",
    label: "Helper is outside Singapore during the application",
    detail: malaysian
      ? "Configured rules note a Malaysian exception to the 'not in Singapore' application condition. Verify the current MOM page."
      : input.attestation.fdwOutsideSingapore
        ? "Staff attested the helper is outside Singapore."
        : "Staff must attest the helper is outside Singapore. MOM states employers generally cannot bring a helper in before IPA.",
    sourceUrl: source(rules, "worker eligibility"),
  });

  items.push({
    id: "nric_address",
    section: "before_submission",
    status: input.attestation.addressIsNricRegistered ? "pass" : "attest",
    label: "Work will be at the employer's NRIC-registered address",
    detail: input.attestation.addressIsNricRegistered
      ? `Staff attested the workplace is the NRIC-registered address (area on file: ${input.employer.addressArea}).`
      : "Staff must confirm the helper will work at the employer's NRIC-registered address.",
    sourceUrl: source(rules, "worker eligibility"),
  });

  items.push({
    id: "financial_ability",
    section: "before_submission",
    status: "info",
    label: "MOM assesses caregiving needs and financial ability",
    detail:
      "MOM says it considers caregiving needs and financial ability. No numeric income threshold is encoded here, because the public guidance describes a qualitative assessment. Verify before relying on a number.",
    sourceUrl: source(rules, "Employer requirements"),
  });

  const bondRequired = securityBondRequired(input.fdw.nationality, rules);
  items.push({
    id: "security_bond",
    section: "before_arrival",
    status: !bondRequired
      ? "pass"
      : input.attestation.securityBondArranged
        ? "pass"
        : "fail",
    label: `Security bond of SGD ${rules.securityBond.amountSgd.toLocaleString("en-SG")}`,
    detail: !bondRequired
      ? "Configured exemption applies for this nationality. The helper must not be asked to pay for a bond when one is required."
      : input.attestation.securityBondArranged
        ? "Staff recorded that the bond has been arranged. It must be in force on arrival. This system does not buy the bond."
        : "Buy the security bond before arrival and have the bank or insurer send details to MOM. This system does not buy it.",
    sourceUrl: source(rules, "Security bond"),
  });

  const subLimitsRecorded =
    input.attestation.inpatientSubLimitSgd != null && input.attestation.daySurgerySubLimitSgd != null;
  const subLimits = subLimitsRecorded
    ? medicalSubLimitsMeetMinimum(
        {
          inpatientCents: (input.attestation.inpatientSubLimitSgd ?? 0) * 100,
          daySurgeryCents: (input.attestation.daySurgerySubLimitSgd ?? 0) * 100,
        },
        rules,
      )
    : null;
  items.push({
    id: "medical_insurance",
    section: "before_arrival",
    status: !input.attestation.medicalInsuranceArranged
      ? "fail"
      : subLimits && !subLimits.ok
        ? "fail"
        : "pass",
    label: `Medical insurance annual claim limit at least SGD ${rules.insurance.medicalAnnualClaimLimitSgd.toLocaleString("en-SG")}`,
    detail: subLimits
      ? `${subLimits.detail} The premium cannot be passed to the helper.`
      : `The annual limit is at least SGD ${rules.insurance.medicalAnnualClaimLimitSgd.toLocaleString("en-SG")}. Inpatient and day surgery each need their own sub-limit of at least that amount. From ${rules.insurance.coPaymentEffectiveFrom}, the insurer pays ${rules.insurance.coPaymentInsurerPercent}% and the employer pays ${rules.insurance.coPaymentEmployerPercent}% of a claim above S$${sgdFromCents(rules.insurance.coPaymentThresholdCents)}. The premium cannot be passed to the helper.`,
    sourceUrl: source(rules, "Insurance"),
  });

  items.push({
    id: "personal_accident",
    section: "before_arrival",
    status: input.attestation.personalAccidentArranged ? "pass" : "fail",
    label: `Personal accident insurance sum assured at least SGD ${rules.insurance.personalAccidentSumAssuredSgd.toLocaleString("en-SG")}`,
    detail:
      "Compensation must be payable to the helper or her beneficiaries. The employer cannot pass the premium to the helper.",
    sourceUrl: source(rules, "Insurance"),
  });

  if (rules.sip.requiredForFirstTimeFdw && input.fdw.firstTimeInSingapore) {
    const arrival = input.attestation.arrivalOn ?? null;
    const sipOn = input.attestation.sipOn ?? null;
    const clash = arrival != null && sipOn != null && !sipAttendanceAllowed(arrival, sipOn, rules);
    items.push({
      id: "sip",
      section: "after_arrival",
      status: clash ? "fail" : "reminder",
      label: "Settling-in Programme",
      detail: clash
        ? "SIP cannot be attended on the arrival day itself."
        : `First-time helper: register the SIP within ${rules.sip.deadlineDaysAfterArrivalExcludingSundayAndHolidays} days of arrival, excluding Sunday and public holidays. SIP cannot be attended on the arrival day itself. She can start work only after SIP. The employer bears the fee.`,
      sourceUrl: source(rules, "Settling-in"),
    });
  }

  items.push({
    id: "medical_exam",
    section: "after_arrival",
    status: "reminder",
    label: "Pre-employment medical examination",
    detail: `Send the helper to a Singapore-registered doctor within ${rules.medicalExam.deadlineDaysAfterArrival} days of arrival (MOM also describes this as two weeks / 14 days — verify). The Work Permit is issued only after a pass. Screen includes tuberculosis, HIV, syphilis, and malaria, plus fitness to work.`,
    sourceUrl: source(rules, "medical examination"),
  });

  if (input.employer.childrenUnder7Count > 0) {
    items.push({
      id: "measles",
      section: "after_arrival",
      status:
        input.employer.measlesVaccinatedUnder7 === false ? "reminder" : "info",
      label: "Measles immunity if children under 7 are not fully vaccinated",
      detail:
        "If children below 7 in the household are not fully vaccinated against measles, MOM says the helper must have measles immunity. Confirm vaccination status with the employer.",
      sourceUrl: source(rules, "medical examination"),
    });
  }

  const rest = assessRestDaysPerMonth(input.attestation.restDaysPerMonth, rules);
  items.push({
    id: "salary_rest",
    section: "before_submission",
    status: input.attestation.salaryAgreedSgd > 0 && rest.ok ? "pass" : "fail",
    label: "Agreed salary and rest days recorded for the staff submission",
    detail: `Salary on the helper profile is SGD ${input.fdw.salaryExpectationSgd}. Staff recorded agreed salary SGD ${input.attestation.salaryAgreedSgd}. ${rest.detail}`,
    sourceUrl: source(rules, "Rest days"),
  });

  const age = completedYears(input.fdw.dateOfBirth, on);
  const sixMe = sixMonthlyExamRequired(age, rules);
  items.push({
    id: "six_monthly_exam",
    section: "after_arrival",
    status: "reminder",
    label: "Six-monthly medical examination",
    detail: sixMe
      ? `During employment, send her for the 6ME every ${rules.sixMonthlyExam.intervalMonths} months. Completed age on the proposed date is ${age}.`
      : `Completed age is ${age}. Helpers aged ${rules.sixMonthlyExam.exemptFromAgeYears} and older are exempt from the 6ME and only need a medical examination when the Work Permit is renewed.`,
    sourceUrl: source(rules, "Six-monthly"),
  });

  const firstLevy = levyRate({ helperNumber: 1, concessionary: false }, rules);
  const nextLevy = levyRate({ helperNumber: 2, concessionary: false }, rules);
  const concession = levyRate({ helperNumber: 1, concessionary: true }, rules);
  items.push({
    id: "levy",
    section: "agency_boundary",
    status: "info",
    label: "Foreign domestic worker levy",
    detail: `First helper S$${sgdFromCents(firstLevy.monthlyCents)} a month (S$${sgdFromCents(firstLevy.dailyCents)} a day). Each subsequent helper S$${sgdFromCents(nextLevy.monthlyCents)} a month (S$${sgdFromCents(nextLevy.dailyCents)} a day). Concessionary levy S$${sgdFromCents(concession.monthlyCents)} a month (S$${sgdFromCents(concession.dailyCents)} a day), capped at ${rules.levy.concessionaryHelperCap} helpers. For a first-time helper the levy starts on day ${rules.levy.firstTimeStartDayInclusive} counting the arrival date. Otherwise it starts the day after arrival. Pay by the ${rules.levy.paymentDayOfFollowingMonth}th of the following month. Amounts are stored as integer cents.`,
    sourceUrl: source(rules, "Levy"),
  });

  const feeRecorded =
    input.attestation.workerFeeSgd != null &&
    input.attestation.contractMonths != null &&
    input.attestation.workPassMonths != null;
  const fee = feeRecorded
    ? assessWorkerAgencyFee(
        {
          monthlySalaryCents: input.attestation.salaryAgreedSgd * 100,
          contractMonths: input.attestation.contractMonths ?? 0,
          workPassMonths: input.attestation.workPassMonths ?? 0,
          feeCents: (input.attestation.workerFeeSgd ?? 0) * 100,
        },
        rules,
      )
    : null;
  items.push({
    id: "ea_fee",
    section: "before_submission",
    status: fee && !fee.ok ? "fail" : "info",
    label: "Agency fee charged to the helper",
    detail: fee
      ? fee.warning ??
        `Recorded fee S$${sgdFromCents(fee.feeCents)} is within the cap of S$${sgdFromCents(fee.capCents)} (${fee.salaryMonths} month(s) of fixed salary). If the employer terminates within ${rules.eaFee.earlyTerminationWithinMonths} months, refund ${rules.eaFee.earlyTerminationRefundPercent}% of the fee collected (S$${sgdFromCents(fee.earlyTerminationRefundCents)}).`
      : `The fee charged to the helper is at most ${rules.eaFee.maxSalaryMonthsPerYear} month of fixed salary for each year of the work pass or the contract, whichever is shorter, and not more than ${rules.eaFee.maxSalaryMonths} months. If the employer terminates within ${rules.eaFee.earlyTerminationWithinMonths} months, refund ${rules.eaFee.earlyTerminationRefundPercent}% of the agency fee collected. A billing record above the cap is refused.`,
    sourceUrl: source(rules, "Agency fee"),
  });

  items.push({
    id: "no_portal_submission",
    section: "agency_boundary",
    status: "info",
    label: "Staff submit on WP Online themselves",
    detail:
      "Do not treat this pack as lodged with MOM. Work Permit applications use Singpass or CorpPass on MOM's WP Online. This product does not automate that submission.",
    sourceUrl:
      "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker",
  });

  const blocking = items.some(
    (item) =>
      (item.section === "fdw_eligibility" ||
        item.section === "employer_eligibility" ||
        item.section === "before_submission" ||
        item.section === "before_arrival") &&
      (item.status === "fail" || item.status === "missing" || item.status === "attest"),
  );

  return { items, ready: !blocking };
}

export function reminderSeeds(items: ChecklistItem[]): {
  code: string;
  title: string;
  dueHint: string;
}[] {
  return items
    .filter((item) => item.status === "reminder" || item.id === "security_bond")
    .map((item) => ({
      code: item.id,
      title: item.label,
      dueHint: item.detail,
    }));
}
