import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/lib/matching/weights";
import { PROTECTED_OUTCOME_FIELDS, suggestFromEvidence } from "@/lib/matching/outcomes";
import { outcomeBiasReport } from "@/lib/matching/fairness";
import { ruleReviewStatus } from "@/lib/mom/rule-catalog";

describe("placement outcomes", () => {
  it("nudges from an early ending or a low employer score and leaves helper satisfaction alone", () => {
    const unhappy = suggestFromEvidence(DEFAULT_WEIGHTS, {
      outcomes: [
        {
          completion: "EARLY_TERMINATION",
          reasonCategory: "SKILL_GAP",
          employerSatisfaction: 2,
          helperSatisfaction: 5,
        },
      ],
    });
    expect(unhappy.evidenceCount).toBe(1);
    expect(unhappy.suggestion.skills).toBe(45);
    expect(unhappy.suggestion.salary).toBe(10);

    const helperOnly = suggestFromEvidence(DEFAULT_WEIGHTS, {
      outcomes: [
        {
          completion: "COMPLETED",
          reasonCategory: "",
          employerSatisfaction: 5,
          helperSatisfaction: 1,
        },
      ],
    });
    expect(helperOnly.suggestion).toEqual(DEFAULT_WEIGHTS);
    expect(PROTECTED_OUTCOME_FIELDS).toEqual(["religion", "race", "ethnicity", "pregnancy"]);
  });

  it("warns on a small nationality sample and does not call it a gap", () => {
    const report = outcomeBiasReport([
      {
        nationality: "Philippines",
        completion: "EARLY_TERMINATION",
        employerSatisfaction: 2,
        helperSatisfaction: 4,
      },
    ]);
    expect(report.groups[0]?.smallSample).toBe(true);
    expect(report.groups[0]?.review).toBe(false);
    expect(report.smallSampleWarning).toMatch(/fewer than 5/);
    expect(report.note).toMatch(/not a score weight/i);
  });

  it("flags a catalog value once it is older than the review window", () => {
    const fresh = ruleReviewStatus({
      lastVerified: new Date("2026-11-26T00:00:00.000Z"),
      verifiedBy: null,
      now: new Date("2026-11-26T00:00:00.000Z"),
      staleDays: 90,
    });
    expect(fresh.stale).toBe(false);
    expect(fresh.needsVerification).toBe(true);
    const old = ruleReviewStatus({
      lastVerified: new Date("2026-08-01T00:00:00.000Z"),
      verifiedBy: "staff",
      now: new Date("2026-11-26T00:00:00.000Z"),
      staleDays: 90,
    });
    expect(old.stale).toBe(true);
    expect(old.needsVerification).toBe(false);
  });
});
