export const PIPELINE = [
  "APPLIED",
  "SCREENED",
  "AVAILABLE",
  "MATCHED",
  "MOM_SUBMITTED",
  "APPROVED",
  "DEPLOYED",
] as const;

export type PipelineStatus =
  | (typeof PIPELINE)[number]
  | "REJECTED"
  | "WITHDRAWN";

const TRANSITIONS: Record<PipelineStatus, readonly PipelineStatus[]> = {
  APPLIED: ["SCREENED", "REJECTED", "WITHDRAWN"],
  SCREENED: ["AVAILABLE", "REJECTED", "WITHDRAWN", "APPLIED"],
  AVAILABLE: ["MATCHED", "SCREENED", "WITHDRAWN"],
  MATCHED: ["MOM_SUBMITTED", "AVAILABLE", "WITHDRAWN"],
  MOM_SUBMITTED: ["APPROVED", "MATCHED", "REJECTED"],
  APPROVED: ["DEPLOYED", "MOM_SUBMITTED"],
  DEPLOYED: [],
  REJECTED: ["APPLIED"],
  WITHDRAWN: ["APPLIED"],
};

export function canTransition(from: PipelineStatus, to: PipelineStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PipelineStatus, to: PipelineStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move a profile from ${from} to ${to}`);
  }
}
