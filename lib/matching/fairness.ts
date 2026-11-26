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
