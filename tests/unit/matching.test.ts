import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { momRules } from "@/config/mom-rules";
import { assertFactsAreSafe, explanationFacts } from "@/lib/matching/explain";
import { rankCandidates, scoreJobFit } from "@/lib/matching/score";
import type { EmployerRequest, MatchableCandidate } from "@/lib/matching/types";

function candidate(overrides: Partial<MatchableCandidate> & { id: string }): MatchableCandidate {
  return {
    skills: ["INFANT_CARE", "COOKING"],
    languages: ["English"],
    experienceYears: 6,
    salaryExpectationSgd: 650,
    availableFrom: new Date("2026-12-01"),
    eligibility: {
      ageYears: 32,
      nationality: "Philippines",
      educationYears: 10,
      sex: "FEMALE",
      medicallyUnfit: false,
    },
    ...overrides,
    id: overrides.id,
  };
}

const request: EmployerRequest = {
  id: "req",
  skillsRequired: ["INFANT_CARE", "COOKING"],
  languagesPreferred: ["English"],
  experienceTargetYears: 4,
  budgetMinSgd: 500,
  budgetMaxSgd: 800,
  startDate: new Date("2026-12-15"),
};

describe("matching", () => {
  it("gives the same job score when only protected or gate traits differ", () => {
    const older = candidate({ id: "older" });
    const younger = candidate({
      id: "younger",
      eligibility: { ...older.eligibility, ageYears: 23, nationality: "Indonesia" },
    });
    expect(scoreJobFit(older, request).total).toBe(scoreJobFit(younger, request).total);
  });

  it("does not reward a salary below the ceiling", () => {
    const atCeiling = candidate({ id: "a", salaryExpectationSgd: 800 });
    const cheaper = candidate({ id: "b", salaryExpectationSgd: 500 });
    expect(scoreJobFit(atCeiling, request).salary).toBe(scoreJobFit(cheaper, request).salary);
  });

  it("keeps under-23 and age-50 profiles out of the ranked scores", () => {
    const ranked = rankCandidates(
      [
        candidate({ id: "b-young", eligibility: { ...candidate({ id: "x" }).eligibility, ageYears: 22 } }),
        candidate({ id: "a-fifty", eligibility: { ...candidate({ id: "x" }).eligibility, ageYears: 50 } }),
        candidate({ id: "c-ok" }),
      ],
      request,
      momRules,
    );
    expect(ranked[0].candidateId).toBe("c-ok");
    expect(ranked.find((row) => row.candidateId === "b-young")?.reasons).toContain("AGE_BELOW_MINIMUM");
    expect(ranked.find((row) => row.candidateId === "a-fifty")?.reasons).toContain("AGE_AT_OR_ABOVE_MAXIMUM");
    expect(ranked.filter((row) => !row.eligible).every((row) => row.breakdown === null)).toBe(true);
  });

  it("tie-breaks by id and never by age", () => {
    const ranked = rankCandidates(
      [candidate({ id: "m" }), candidate({ id: "a", eligibility: { ...candidate({ id: "a" }).eligibility, ageYears: 49 } })],
      request,
      momRules,
    );
    expect(ranked.map((row) => row.candidateId)).toEqual(["a", "m"]);
    expect(ranked[0].breakdown?.total).toBe(ranked[1].breakdown?.total);
  });

  it("excludes an unfit profile and a non-approved source country", () => {
    const ranked = rankCandidates(
      [
        candidate({
          id: "unfit",
          eligibility: { ...candidate({ id: "u" }).eligibility, medicallyUnfit: true },
        }),
        candidate({
          id: "other",
          eligibility: { ...candidate({ id: "o" }).eligibility, nationality: "France" },
        }),
      ],
      request,
      momRules,
    );
    expect(ranked.every((row) => !row.eligible)).toBe(true);
  });

  it("sends only pass/fail gates to the explanation", () => {
    const [row] = rankCandidates([candidate({ id: "explained" })], request, momRules);
    const facts = explanationFacts(row);
    expect(() => assertFactsAreSafe(facts)).not.toThrow();
    expect(facts.gates.ageWindow).toBe("pass");
    expect(JSON.stringify(facts)).not.toMatch(/ageYears|religion|passport/i);
  });

  it("does not store protected traits on the schema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8").toLowerCase();
    for (const word of ["religion", "race", "ethnicity", "pregnan"]) {
      expect(schema).not.toContain(word);
    }
  });
});
