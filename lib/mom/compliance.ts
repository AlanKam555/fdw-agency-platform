import { momRules, type MomRules } from "@/config/mom-rules";
import { addCalendarDays, isoDate } from "@/lib/mom/dates";

export type PermitAction = "new" | "renewal";

export function fdwAgeBounds(action: PermitAction, rules: MomRules = momRules): { min: number; maxExclusive: number } {
  return {
    min: rules.fdw.minAgeYears,
    maxExclusive: action === "renewal" ? rules.fdw.renewalMaxAgeYearsExclusive : rules.fdw.maxAgeYearsExclusive,
  };
}

export function sgdFromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const text = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

/** Each sub-limit must meet the configured annual minimum. Amounts are integer cents. */
export function medicalSubLimitsMeetMinimum(
  input: { inpatientCents: number; daySurgeryCents: number },
  rules: MomRules = momRules,
): { ok: boolean; detail: string } {
  const inpatientMin = Math.max(rules.insurance.medicalAnnualClaimLimitSgd * 100, rules.insurance.inpatientSubLimitCents);
  const dayMin = Math.max(rules.insurance.medicalAnnualClaimLimitSgd * 100, rules.insurance.daySurgerySubLimitCents);
  const inpatientOk = input.inpatientCents >= inpatientMin;
  const dayOk = input.daySurgeryCents >= dayMin;
  const detail = `Inpatient sub-limit S$${sgdFromCents(input.inpatientCents)} (minimum S$${sgdFromCents(inpatientMin)}). Day surgery sub-limit S$${sgdFromCents(input.daySurgeryCents)} (minimum S$${sgdFromCents(dayMin)}). Each sub-limit must meet the annual minimum. From ${rules.insurance.coPaymentEffectiveFrom}, claims above S$${sgdFromCents(rules.insurance.coPaymentThresholdCents)} are ${rules.insurance.coPaymentInsurerPercent}% insurer and ${rules.insurance.coPaymentEmployerPercent}% employer.`;
  return { ok: inpatientOk && dayOk, detail };
}

export function coPaymentSplit(
  claimCents: number,
  on: Date,
  rules: MomRules = momRules,
): { applies: boolean; insurerCents: number; employerCents: number } {
  if (isoDate(on) < rules.insurance.coPaymentEffectiveFrom || claimCents <= rules.insurance.coPaymentThresholdCents) {
    return { applies: false, insurerCents: 0, employerCents: 0 };
  }
  const above = claimCents - rules.insurance.coPaymentThresholdCents;
  const insurerCents = Math.round((above * rules.insurance.coPaymentInsurerPercent) / 100);
  return { applies: true, insurerCents, employerCents: above - insurerCents };
}

export type LevyRate = {
  monthlyCents: number;
  dailyCents: number;
  concessionApplied: boolean;
};

/** helperNumber is 1 for the household's first helper. Concession applies to at most the configured cap. */
export function levyRate(
  input: { helperNumber: number; concessionary: boolean },
  rules: MomRules = momRules,
): LevyRate {
  const concessionApplied =
    input.concessionary && input.helperNumber >= 1 && input.helperNumber <= rules.levy.concessionaryHelperCap;
  if (concessionApplied) {
    return {
      monthlyCents: rules.levy.concessionaryMonthlyCents,
      dailyCents: rules.levy.concessionaryDailyCents,
      concessionApplied: true,
    };
  }
  if (input.helperNumber <= 1) {
    return {
      monthlyCents: rules.levy.firstHelperMonthlyCents,
      dailyCents: rules.levy.firstHelperDailyCents,
      concessionApplied: false,
    };
  }
  return {
    monthlyCents: rules.levy.subsequentHelperMonthlyCents,
    dailyCents: rules.levy.subsequentHelperDailyCents,
    concessionApplied: false,
  };
}

/** First-time helper: day 5 counting the arrival date. Otherwise the day after arrival. */
export function levyStartDate(arrival: Date, firstTime: boolean, rules: MomRules = momRules): Date {
  const offset = firstTime
    ? Math.max(0, rules.levy.firstTimeStartDayInclusive - 1)
    : rules.levy.laterHelperStartOffsetDays;
  return addCalendarDays(arrival, offset);
}

/** Levy for a month is due on the configured day of the following month. */
export function levyPaymentDue(levyMonth: Date, rules: MomRules = momRules): Date {
  return new Date(Date.UTC(levyMonth.getUTCFullYear(), levyMonth.getUTCMonth() + 1, rules.levy.paymentDayOfFollowingMonth));
}

export function assessRestDaysPerMonth(
  days: number,
  rules: MomRules = momRules,
): { ok: boolean; detail: string } {
  const floor = rules.restDays.minNonCompensablePerMonth;
  const taken = rules.restDays.nonCompensableMayBeTwoHalfDays
    ? `a full day or two half days`
    : `a full day`;
  const shared = `One rest day each week. If she agrees to work a rest day, pay at least ${rules.restDays.compensationMinExtraDaysSalary} extra day's salary. At least ${floor} rest day per month cannot be compensated away (${taken}), and that day may be deferred by up to ${rules.restDays.deferralMaxMonths} month.`;
  if (!Number.isInteger(days) || days < floor) {
    return {
      ok: false,
      detail: `${shared} ${days} rest days per month is below that minimum.`,
    };
  }
  return { ok: true, detail: `${shared} Staff recorded ${days} rest days per month.` };
}

export function sixMonthlyExamRequired(ageYears: number, rules: MomRules = momRules): boolean {
  return ageYears < rules.sixMonthlyExam.exemptFromAgeYears;
}

export function sipAttendanceAllowed(arrival: Date, sipOn: Date, rules: MomRules = momRules): boolean {
  if (!rules.sip.cannotAttendOnArrivalDay) return true;
  return isoDate(arrival) !== isoDate(sipOn);
}

/**
 * One month of fixed salary for each year of the shorter of the work pass and the contract,
 * capped at the configured maximum (transcribed as two months). A term of 1–12 months counts
 * as one year. 13–24 months counts as two. A longer term stays at the cap.
 */
export function agencyFeeSalaryMonths(
  contractMonths: number,
  workPassMonths: number,
  rules: MomRules = momRules,
): number {
  if (!Number.isInteger(contractMonths) || !Number.isInteger(workPassMonths)) return 0;
  if (contractMonths < 1 || workPassMonths < 1) return 0;
  const shorter = Math.min(contractMonths, workPassMonths);
  const years = Math.ceil(shorter / 12);
  return Math.min(rules.eaFee.maxSalaryMonths, years * rules.eaFee.maxSalaryMonthsPerYear);
}

export function agencyFeeCapCents(
  input: { monthlySalaryCents: number; contractMonths: number; workPassMonths: number },
  rules: MomRules = momRules,
): number {
  if (!Number.isInteger(input.monthlySalaryCents) || input.monthlySalaryCents < 0) return 0;
  return agencyFeeSalaryMonths(input.contractMonths, input.workPassMonths, rules) * input.monthlySalaryCents;
}

export function earlyTerminationRefundCents(feeCollectedCents: number, rules: MomRules = momRules): number {
  if (!Number.isInteger(feeCollectedCents) || feeCollectedCents <= 0) return 0;
  return Math.round((feeCollectedCents * rules.eaFee.earlyTerminationRefundPercent) / 100);
}

export type WorkerFeeAssessment = {
  ok: boolean;
  capCents: number;
  feeCents: number;
  overByCents: number;
  salaryMonths: number;
  warning: string | null;
  earlyTerminationRefundCents: number;
};

export function assessWorkerAgencyFee(
  input: {
    monthlySalaryCents: number;
    contractMonths: number;
    workPassMonths: number;
    feeCents: number;
  },
  rules: MomRules = momRules,
): WorkerFeeAssessment {
  const salaryMonths = agencyFeeSalaryMonths(input.contractMonths, input.workPassMonths, rules);
  const capCents = agencyFeeCapCents(input, rules);
  const feeCents = Number.isInteger(input.feeCents) ? input.feeCents : Number.NaN;
  const overByCents = Number.isInteger(feeCents) ? Math.max(0, feeCents - capCents) : feeCents;
  const refund = earlyTerminationRefundCents(Number.isInteger(feeCents) ? feeCents : 0, rules);
  if (!Number.isInteger(feeCents) || feeCents < 0 || overByCents > 0) {
    return {
      ok: false,
      capCents,
      feeCents: Number.isInteger(feeCents) ? feeCents : 0,
      overByCents: Number.isInteger(overByCents) ? overByCents : 0,
      salaryMonths,
      warning: `The fee charged to the helper is above the MOM cap of S$${sgdFromCents(capCents)} (${salaryMonths} month(s) of fixed salary). It was not recorded. The cap is one month of fixed salary for each year of the shorter of the work pass and the contract, and not more than ${rules.eaFee.maxSalaryMonths} months.`,
      earlyTerminationRefundCents: 0,
    };
  }
  return {
    ok: true,
    capCents,
    feeCents,
    overByCents: 0,
    salaryMonths,
    warning: null,
    earlyTerminationRefundCents: refund,
  };
}
