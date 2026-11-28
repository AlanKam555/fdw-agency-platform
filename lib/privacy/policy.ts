import { brand } from "@/config/brand";

export const PRIVACY_POLICY = {
  version: "HL-PDPA-2026-11",
  controller: brand.fictionalDemo
    ? `${brand.legalName} (fictional demonstration deployment)`
    : brand.legalName,
  purposes: [
    "Assessing helper applications and employer requirements",
    "Explaining job-factor matches to agency staff",
    "Preparing a Ministry of Manpower work permit pack for staff to submit themselves",
    "Publishing a helper profile only with photo and publicity consent",
    "Responding to enquiries",
  ],
  notCollected: [
    "Religion",
    "Race or ethnicity",
    "Pregnancy",
    "Marital status",
  ],
  retention: {
    activeApplicationDays: 365 * 2,
    deployedRecordDays: 365 * 5,
    enquiryDays: 365,
    auditLogDays: 365 * 2,
    rejectedApplicationDays: 180,
    unverifiedAccountDays: 14,
    pendingApplicationDays: 90,
    marketingDraftDays: 365,
    testimonialRequestDays: 90,
    sessionDays: 30,
    embeddingCacheDays: 7,
  },
  rights: [
    "Access and correction of personal data we hold",
    "Withdrawal of consent, which stops new use but may not erase records we must keep for a legal claim or MOM file already submitted by staff",
    "Redaction by an administrator, which deletes documents and replaces direct identifiers",
  ],
} as const;

export function retentionSummary(): string {
  const r = PRIVACY_POLICY.retention;
  return `Enquiries are kept for about ${r.enquiryDays} days, rejected applications for about ${r.rejectedApplicationDays} days, pending applications for about ${r.pendingApplicationDays} days, active files and households without a placement for about ${r.activeApplicationDays} days, deployed files and households with a placement for about ${r.deployedRecordDays} days, marketing drafts for about ${r.marketingDraftDays} days, and staff audit logs for about ${r.auditLogDays} days. Employer and helper accounts that never confirm their email are removed after about ${r.unverifiedAccountDays} days. These are policy defaults for this product, not legal advice.`;
}
