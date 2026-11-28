import { describe, expect, it } from "vitest";
import { momRules } from "@/config/mom-rules";
import { addWorkingDays } from "@/lib/mom/dates";
import { buildChecklist } from "@/lib/mom/checklist";
import {
  agencyFeeCapCents,
  assessRestDaysPerMonth,
  assessWorkerAgencyFee,
  coPaymentSplit,
  earlyTerminationRefundCents,
  levyPaymentDue,
  levyRate,
  levyStartDate,
  medicalSubLimitsMeetMinimum,
  sipAttendanceAllowed,
  sixMonthlyExamRequired,
} from "@/lib/mom/compliance";
import { evaluateEmployer, evaluateFdw, securityBondRequired } from "@/lib/mom/eligibility";
import { MOM_RULE_DEFINITIONS } from "@/lib/mom/rule-catalog";
import { renderMomPdf } from "@/lib/mom/pdf";

const on = new Date("2026-11-26T00:00:00.000Z");

describe("MOM eligibility", () => {
  it("flags the transcribed rules for verification", () => {
    expect(momRules.meta.verificationStatus).toBe("verify against current MOM guidance");
    expect(momRules.meta.verifiedOn).toBe("2026-11-28");
    expect(momRules.fdw.minAgeYears).toBe(23);
    expect(momRules.fdw.maxAgeYearsExclusive).toBe(50);
    expect(momRules.fdw.renewalMaxAgeYearsExclusive).toBe(60);
    expect(momRules.meta.sources.length).toBeGreaterThan(3);
    for (const definition of MOM_RULE_DEFINITIONS) {
      expect(definition.verificationStatus).toBe("verify against current MOM guidance");
      expect(definition.verifiedOn).toBe("2026-11-28");
      expect(definition.sourceUrl.startsWith("https://www.mom.gov.sg/")).toBe(true);
    }
  });

  it("passes a 23-year-old from an approved country and fails age 22 and 50", () => {
    const base = {
      nationality: "Philippines",
      educationYears: 8,
      sex: "FEMALE" as const,
      on,
    };
    expect(evaluateFdw({ ...base, dateOfBirth: new Date("2003-11-26") }, momRules).every((c) => c.status === "pass")).toBe(true);
    expect(evaluateFdw({ ...base, dateOfBirth: new Date("2004-11-27") }, momRules).find((c) => c.id === "fdw_min_age")?.status).toBe("fail");
    expect(evaluateFdw({ ...base, dateOfBirth: new Date("1976-11-26") }, momRules).find((c) => c.id === "fdw_max_age")?.status).toBe("fail");
  });

  it("requires the security bond except for the configured exemption", () => {
    expect(securityBondRequired("Malaysia", momRules)).toBe(false);
    expect(securityBondRequired("Philippines", momRules)).toBe(true);
  });

  it("counts EOP lead time in working days without the completion day", () => {
    const monday = new Date("2026-11-16T00:00:00.000Z");
    const earliest = addWorkingDays(monday, 2, []);
    expect(earliest.toISOString().slice(0, 10)).toBe("2026-11-18");
    const friday = new Date("2026-11-20T00:00:00.000Z");
    expect(addWorkingDays(friday, 2, []).toISOString().slice(0, 10)).toBe("2026-11-24");
  });

  it("fails a first-time employer who has not completed EOP", () => {
    const checks = evaluateEmployer(
      {
        dateOfBirth: new Date("1990-01-01"),
        isUndischargedBankrupt: false,
        firstTimeEmployer: true,
        eopCompleted: false,
        eopCompletedOn: null,
        proposedSubmissionDate: on,
      },
      momRules,
    );
    expect(checks.find((check) => check.id === "employer_eop")?.status).toBe("fail");
  });

  it("marks a complete pack ready and renders a PDF that is not a submission", async () => {
    const pack = buildChecklist(
      {
        fdw: {
          fullName: "Ana Reyes",
          dateOfBirth: new Date("1994-04-12"),
          nationality: "Philippines",
          educationYears: 10,
          sex: "FEMALE",
          firstTimeInSingapore: true,
          salaryExpectationSgd: 650,
        },
        employer: {
          fullName: "Priya Menon",
          dateOfBirth: new Date("1988-03-14"),
          isUndischargedBankrupt: false,
          firstTimeEmployer: true,
          eopCompleted: true,
          eopCompletedOn: new Date("2026-11-16"),
          childrenUnder7Count: 1,
          measlesVaccinatedUnder7: true,
          addressArea: "Queenstown",
        },
        attestation: {
          notRelated: true,
          fdwOutsideSingapore: true,
          securityBondArranged: true,
          medicalInsuranceArranged: true,
          personalAccidentArranged: true,
          addressIsNricRegistered: true,
          salaryAgreedSgd: 650,
          restDaysPerMonth: 4,
          proposedSubmissionDate: new Date("2026-11-26"),
        },
      },
      momRules,
    );
    expect(pack.ready).toBe(true);
    const pdf = await renderMomPdf({
      agencyName: "Harbourlight",
      helperName: "Ana Reyes",
      employerName: "Priya Menon",
      generatedOn: "2026-11-26",
      ready: true,
      items: pack.items,
      rules: momRules,
    });
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    expect(pack.items.find((item) => item.id === "levy")?.detail).toContain("integer cents");
    expect(pack.items.find((item) => item.id === "six_monthly_exam")?.detail).toContain("6");
  });

  it("allows a renewal from age 50 until below 60 and still rejects a new application at 50", () => {
    const base = {
      nationality: "Philippines",
      educationYears: 8,
      sex: "FEMALE" as const,
      on,
    };
    expect(evaluateFdw({ ...base, dateOfBirth: new Date("1976-11-26"), permitAction: "new" }).find((c) => c.id === "fdw_max_age")?.status).toBe("fail");
    expect(evaluateFdw({ ...base, dateOfBirth: new Date("1976-11-26"), permitAction: "renewal" }).find((c) => c.id === "fdw_max_age")?.status).toBe("pass");
    expect(evaluateFdw({ ...base, dateOfBirth: new Date("1971-11-26"), permitAction: "renewal" }).find((c) => c.id === "fdw_max_age")?.status).toBe("pass");
    expect(evaluateFdw({ ...base, dateOfBirth: new Date("1966-11-26"), permitAction: "renewal" }).find((c) => c.id === "fdw_max_age")?.status).toBe("fail");
  });

  it("requires each medical sub-limit to meet S$60,000 and splits co-payment above S$15,000", () => {
    expect(medicalSubLimitsMeetMinimum({ inpatientCents: 6_000_000, daySurgeryCents: 6_000_000 }).ok).toBe(true);
    expect(medicalSubLimitsMeetMinimum({ inpatientCents: 5_999_900, daySurgeryCents: 6_000_000 }).ok).toBe(false);
    expect(momRules.insurance.coPaymentInsurerPercent).toBe(75);
    expect(momRules.insurance.coPaymentEmployerPercent).toBe(25);
    expect(momRules.insurance.coPaymentThresholdCents).toBe(1_500_000);
    const split = coPaymentSplit(2_000_000, new Date("2023-07-01T00:00:00.000Z"));
    expect(split.applies).toBe(true);
    expect(split.insurerCents + split.employerCents).toBe(500_000);
    expect(split.insurerCents).toBe(375_000);
    expect(coPaymentSplit(2_000_000, new Date("2023-06-30T00:00:00.000Z")).applies).toBe(false);
  });

  it("stores levy in cents and counts the arrival day for a first-time helper", () => {
    expect(levyRate({ helperNumber: 1, concessionary: false })).toEqual({
      monthlyCents: 30000,
      dailyCents: 987,
      concessionApplied: false,
    });
    expect(levyRate({ helperNumber: 2, concessionary: false }).monthlyCents).toBe(45000);
    expect(levyRate({ helperNumber: 1, concessionary: true }).monthlyCents).toBe(6000);
    expect(levyRate({ helperNumber: 3, concessionary: true }).concessionApplied).toBe(false);
    const arrival = new Date("2026-01-01T00:00:00.000Z");
    expect(levyStartDate(arrival, true).toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(levyStartDate(arrival, false).toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(levyPaymentDue(arrival).toISOString().slice(0, 10)).toBe("2026-02-17");
  });

  it("refuses fewer than one non-compensable rest day a month", () => {
    expect(assessRestDaysPerMonth(0).ok).toBe(false);
    expect(assessRestDaysPerMonth(1).ok).toBe(true);
    expect(assessRestDaysPerMonth(1).detail).toContain("extra day's salary");
  });

  it("requires the six-monthly exam below age 50 only", () => {
    expect(sixMonthlyExamRequired(49)).toBe(true);
    expect(sixMonthlyExamRequired(50)).toBe(false);
  });

  it("refuses SIP on the arrival day", () => {
    const arrival = new Date("2026-03-02T00:00:00.000Z");
    expect(sipAttendanceAllowed(arrival, arrival)).toBe(false);
    expect(sipAttendanceAllowed(arrival, new Date("2026-03-03T00:00:00.000Z"))).toBe(true);
  });

  it("caps the helper agency fee at two months of salary and refunds half on an early employer termination", () => {
    const input = { monthlySalaryCents: 65000, contractMonths: 24, workPassMonths: 24 };
    expect(agencyFeeCapCents(input)).toBe(130000);
    expect(agencyFeeCapCents({ ...input, contractMonths: 36, workPassMonths: 36 })).toBe(130000);
    expect(agencyFeeCapCents({ ...input, contractMonths: 12, workPassMonths: 24 })).toBe(65000);
    const over = assessWorkerAgencyFee({ ...input, feeCents: 130001 });
    expect(over.ok).toBe(false);
    expect(over.warning).toContain("not recorded");
    const within = assessWorkerAgencyFee({ ...input, feeCents: 130000 });
    expect(within.ok).toBe(true);
    expect(earlyTerminationRefundCents(130000)).toBe(65000);
    expect(within.earlyTerminationRefundCents).toBe(65000);
  });

  it("fails the checklist when a recorded helper fee is over the cap or rest days are zero", () => {
    const base = {
      fdw: {
        fullName: "Ana Reyes",
        dateOfBirth: new Date("1994-04-12"),
        nationality: "Philippines",
        educationYears: 10,
        sex: "FEMALE" as const,
        firstTimeInSingapore: true,
        salaryExpectationSgd: 650,
      },
      employer: {
        fullName: "Priya Menon",
        dateOfBirth: new Date("1988-03-14"),
        isUndischargedBankrupt: false,
        firstTimeEmployer: true,
        eopCompleted: true,
        eopCompletedOn: new Date("2026-11-16"),
        childrenUnder7Count: 0,
        measlesVaccinatedUnder7: null,
        addressArea: "Queenstown",
      },
      attestation: {
        notRelated: true,
        fdwOutsideSingapore: true,
        securityBondArranged: true,
        medicalInsuranceArranged: true,
        personalAccidentArranged: true,
        addressIsNricRegistered: true,
        salaryAgreedSgd: 650,
        restDaysPerMonth: 0,
        proposedSubmissionDate: new Date("2026-11-26"),
      },
    };
    expect(buildChecklist(base).ready).toBe(false);
    const overFee = buildChecklist({
      ...base,
      attestation: {
        ...base.attestation,
        restDaysPerMonth: 4,
        workerFeeSgd: 2000,
        contractMonths: 24,
        workPassMonths: 24,
      },
    });
    expect(overFee.items.find((item) => item.id === "ea_fee")?.status).toBe("fail");
    expect(overFee.ready).toBe(false);
  });
});
