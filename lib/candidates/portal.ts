import type { CandidateStatus, DocumentKind, InterviewStatus } from "@prisma/client";

const NEXT: Record<CandidateStatus, string> = {
  APPLIED: "Staff will screen the file. You do not need to contact the Ministry yourself at this step.",
  SCREENED: "Staff are checking documents. They will mark the profile available only if it can be introduced.",
  AVAILABLE: "Households can ask staff for an interview. Staff confirm the time.",
  MATCHED: "Staff have approved a match and will prepare the Ministry of Manpower pack. They lodge it themselves.",
  MOM_SUBMITTED: "The pack has been prepared for submission. This page does not show the permit outcome.",
  APPROVED: "Staff recorded an approval. Deployment details stay on the staff desk.",
  DEPLOYED: "The placement is recorded as started. Questions about the permit go to the agency, not to this page.",
  REJECTED: "Staff closed this file. You can ask the agency what that means for you.",
  WITHDRAWN: "This file is withdrawn. Staff can tell you which records they still have to keep.",
};

export function helperNextStep(status: CandidateStatus): string {
  return NEXT[status];
}

export function documentReviewLabel(input: { approvedById: string | null; rejectedAt: Date | null }): string {
  if (input.rejectedAt) return "Not accepted";
  if (input.approvedById) return "Accepted";
  return "Awaiting review";
}

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  PASSPORT: "Passport",
  EDUCATIONAL_CERTIFICATE: "Education certificate",
  MEDICAL: "Medical",
  PHOTO: "Portrait",
  EMPLOYER_NRIC: "Employer identity document",
  OTHER: "Other",
};

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
};
