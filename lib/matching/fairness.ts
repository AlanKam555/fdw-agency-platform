export type BiasRow = {
  nationality: string;
  eligible: boolean;
  score: number | null;
  approved: boolean;
};

export type BiasGroup = {
  nationality: string;
  considered: number;
  eligible: number;
  meanEligibleScore: number | null;
  approved: number;
  review: boolean;
};

export function biasReport(rows: BiasRow[]): {
  groups: BiasGroup[];
  overallEligibleMean: number | null;
  note: string;
} {
  const buckets = new Map<string, BiasRow[]>();
  for (const row of rows) {
    const key = row.nationality.trim() || "Unspecified";
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  const eligibleScores = rows.filter((row) => row.eligible && row.score !== null).map((row) => row.score as number);
  const overall =
    eligibleScores.length === 0
      ? null
      : eligibleScores.reduce((sum, score) => sum + score, 0) / eligibleScores.length;

  const groups = [...buckets.entries()]
    .map(([nationality, list]) => {
      const scores = list.filter((row) => row.eligible && row.score !== null).map((row) => row.score as number);
      const mean = scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return {
        nationality,
        considered: list.length,
        eligible: list.filter((row) => row.eligible).length,
        meanEligibleScore: mean === null ? null : Math.round(mean),
        approved: list.filter((row) => row.approved).length,
        review: mean !== null && overall !== null && scores.length >= 2 && Math.abs(mean - overall) >= 15,
      };
    })
    .sort((a, b) => a.nationality.localeCompare(b.nationality));

  return {
    groups,
    overallEligibleMean: overall === null ? null : Math.round(overall),
    note: "Nationality is grouped here only so staff can audit outcomes. It is not a score weight. A gap is a reason to re-read skills, languages, and household fit, not a reason to prefer a source country.",
  };
}

export const OUTCOME_SMALL_SAMPLE = 5;

export type OutcomeAuditRow = {
  nationality: string;
  completion: "COMPLETED" | "EARLY_TERMINATION" | "CHECK_IN";
  employerSatisfaction: number | null;
  helperSatisfaction: number | null;
};

export type OutcomeAuditGroup = {
  nationality: string;
  outcomes: number;
  completed: number;
  earlyTerminations: number;
  meanEmployerSatisfaction: number | null;
  meanHelperSatisfaction: number | null;
  smallSample: boolean;
  review: boolean;
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function outcomeBiasReport(rows: OutcomeAuditRow[]): {
  groups: OutcomeAuditGroup[];
  overallEmployerMean: number | null;
  smallSampleWarning: string;
  note: string;
} {
  const buckets = new Map<string, OutcomeAuditRow[]>();
  for (const row of rows) {
    const key = row.nationality.trim() || "Unspecified";
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  const overallEmployerMean = mean(
    rows.map((row) => row.employerSatisfaction).filter((value): value is number => value !== null),
  );
  const groups = [...buckets.entries()]
    .map(([nationality, list]) => {
      const employerMean = mean(
        list.map((row) => row.employerSatisfaction).filter((value): value is number => value !== null),
      );
      const smallSample = list.length < OUTCOME_SMALL_SAMPLE;
      const review =
        !smallSample &&
        employerMean !== null &&
        overallEmployerMean !== null &&
        Math.abs(employerMean - overallEmployerMean) >= 1.5;
      return {
        nationality,
        outcomes: list.length,
        completed: list.filter((row) => row.completion === "COMPLETED").length,
        earlyTerminations: list.filter((row) => row.completion === "EARLY_TERMINATION").length,
        meanEmployerSatisfaction: employerMean,
        meanHelperSatisfaction: mean(
          list.map((row) => row.helperSatisfaction).filter((value): value is number => value !== null),
        ),
        smallSample,
        review,
      };
    })
    .sort((a, b) => a.nationality.localeCompare(b.nationality));

  return {
    groups,
    overallEmployerMean,
    smallSampleWarning: `A nationality group with fewer than ${OUTCOME_SMALL_SAMPLE} outcomes is too small to read as a pattern.`,
    note: "Placement outcomes are grouped by nationality for audit only. Nationality is not a score weight. Religion, race, and pregnancy are not collected. A small group is marked so it is not treated as a gap.",
  };
}
