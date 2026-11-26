import { describe, expect, it } from "vitest";
import { momRules } from "@/config/mom-rules";
import { addWorkingDays } from "@/lib/mom/dates";
import { buildChecklist } from "@/lib/mom/checklist";
import { evaluateEmployer, evaluateFdw, securityBondRequired } from "@/lib/mom/eligibility";
import { renderMomPdf } from "@/lib/mom/pdf";

const on = new Date("2026-11-26T00:00:00.000Z");

describe("MOM eligibility", () => {
  it("flags the transcribed rules for verification", () => {
    expect(momRules.meta.verificationStatus).toBe("verify against current MOM guidance");
    expect(momRules.fdw.minAgeYears).toBe(23);
    expect(momRules.fdw.maxAgeYearsExclusive).toBe(50);
    expect(momRules.meta.sources.length).toBeGreaterThan(3);
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
  });
});
