import { z } from "zod";
import { sipAttendanceAllowed } from "@/lib/mom/compliance";
import { REMINDER_TYPES } from "@/lib/reminders/catalog";
import { OUTCOME_COMPLETIONS, TERMINATION_REASONS } from "@/lib/matching/outcomes";

export const PDPA_VERSION = "HL-PDPA-2026-11";

function asBoolean(value: unknown): boolean {
  if (value === true || value === "true" || value === "on" || value === "1") return true;
  return false;
}

const formBoolean = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  return asBoolean(value);
}, z.boolean());
const requiredConsent = z.preprocess(asBoolean, z.literal(true));
const optionalBoolean = z.preprocess((value) => {
  if (value == null || value === "") return null;
  return asBoolean(value);
}, z.boolean().nullable());

export const SKILLS = [
  "INFANT_CARE",
  "CHILD_CARE",
  "ELDERLY_CARE",
  "COOKING",
  "HOUSEKEEPING",
  "PET_CARE",
  "SPECIAL_NEEDS",
  "DRIVING",
] as const;

export const skillSchema = z.enum(SKILLS);

export const languageSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[\p{L}\s'-]+$/u, "Use letters only");

const personName = z.string().trim().min(2).max(80);
const email = z.string().trim().email().max(160);
const phone = z.string().trim().min(8).max(20);
const money = z.coerce.number().int().min(0).max(20000);
const dateField = z.coerce.date();
const optionalDate = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  return value;
}, z.coerce.date().optional());

export const passwordSchema = z
  .string()
  .min(10)
  .max(72)
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number");

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
  code: z.string().regex(/^\d{6}$/).optional().or(z.literal("")),
  recoveryCode: z.string().min(8).max(32).optional().or(z.literal("")),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  nextPassword: passwordSchema,
});

export const staffActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("disable"), userId: z.string().min(1).max(40) }),
  z.object({ action: z.literal("sign_out_everywhere"), userId: z.string().min(1).max(40) }),
  z.object({
    action: z.literal("set_password"),
    userId: z.string().min(1).max(40),
    password: passwordSchema,
  }),
  z.object({ action: z.literal("revoke_session"), sessionId: z.string().min(1).max(40) }),
  z.object({
    action: z.literal("reset_totp"),
    userId: z.string().min(1).max(40),
    password: z.string().min(1).max(200),
    code: z.string().regex(/^\d{6}$/),
  }),
]);

export const registerSchema = z.object({
  role: z.enum(["EMPLOYER", "CANDIDATE"]),
  name: personName,
  email,
  password: passwordSchema,
  pdpaConsent: requiredConsent,
});

const utmField = z.string().trim().max(80).optional().or(z.literal(""));

export const contactSchema = z.object({
  name: personName,
  email,
  phone: phone.optional().or(z.literal("")),
  message: z.string().trim().min(10).max(2000),
  pdpaConsent: requiredConsent,
  source: utmField,
  utmSource: utmField,
  utmMedium: utmField,
  utmCampaign: utmField,
  utmContent: utmField,
  landingPath: z.string().trim().max(200).optional().or(z.literal("")),
});

export const candidateApplicationSchema = z
  .object({
    fullName: personName,
    email,
    phone,
    password: passwordSchema.optional().or(z.literal("")),
    nationality: z.string().trim().min(2).max(60),
    dateOfBirth: dateField,
    sex: z.enum(["FEMALE", "MALE", "UNSPECIFIED"]),
    educationYears: z.coerce.number().int().min(0).max(30),
    experienceYears: z.coerce.number().int().min(0).max(50),
    skills: z.array(skillSchema).min(1).max(8),
    languages: z.array(languageSchema).min(1).max(8),
    salaryExpectationSgd: money,
    availableFrom: dateField,
    householdExperience: z.string().trim().max(2000).default(""),
    passportNumber: z
      .string()
      .trim()
      .max(20)
      .regex(/^[A-Za-z0-9]*$/)
      .optional()
      .or(z.literal("")),
    medicalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
    medicalFitStatus: z.enum(["PENDING", "FIT", "UNFIT"]).default("PENDING"),
    firstTimeInSingapore: formBoolean.default(true),
    photoConsent: formBoolean.default(false),
    marketingConsent: formBoolean.optional(),
    aiProcessingConsent: formBoolean.optional(),
    pdpaConsent: requiredConsent,
    internalNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const publicCandidateApplicationSchema = candidateApplicationSchema
  .omit({ internalNotes: true, medicalFitStatus: true })
  .strict();

export const documentReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === "reject" && (value.reason ?? "").trim().length < 3) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Give a short reason." });
    }
  });

export const employerRequirementSchema = z
  .object({
    fullName: personName,
    email,
    phone,
    householdSize: z.coerce.number().int().min(1).max(20),
    childrenCount: z.coerce.number().int().min(0).max(12).default(0),
    youngestChildAge: z.coerce.number().int().min(0).max(18).optional().nullable(),
    childrenUnder7Count: z.coerce.number().int().min(0).max(12).default(0),
    measlesVaccinatedUnder7: optionalBoolean,
    elderlyCount: z.coerce.number().int().min(0).max(8),
    hasPets: formBoolean.default(false),
    petDetails: z.string().trim().max(300).optional().or(z.literal("")),
    languagesPreferred: z.array(languageSchema).max(8).default([]),
    skillsRequired: z.array(skillSchema).min(1).max(8),
    budgetMinSgd: money,
    budgetMaxSgd: money,
    startDate: dateField,
    housingType: z.enum(["HDB", "CONDO", "LANDED", "OTHER"]),
    addressArea: z.string().trim().min(2).max(80),
    dateOfBirth: dateField.optional().nullable(),
    nric: z
      .string()
      .trim()
      .max(9)
      .regex(/^[A-Za-z0-9]*$/)
      .optional()
      .or(z.literal("")),
    isUndischargedBankrupt: optionalBoolean,
    firstTimeEmployer: formBoolean.default(true),
    eopCompleted: formBoolean.default(false),
    eopCompletedOn: dateField.optional().nullable(),
    notes: z.string().trim().max(2000).default(""),
    pdpaConsent: requiredConsent,
    title: z.string().trim().min(3).max(120).optional(),
  })
  .strict()
  .refine((value) => value.budgetMaxSgd >= value.budgetMinSgd, {
    message: "Budget maximum must be at least the minimum",
    path: ["budgetMaxSgd"],
  });

export const statusSchema = z.object({
  status: z.enum([
    "APPLIED",
    "SCREENED",
    "AVAILABLE",
    "MATCHED",
    "MOM_SUBMITTED",
    "APPROVED",
    "DEPLOYED",
    "REJECTED",
    "WITHDRAWN",
  ]),
});

export const interviewSchema = z.object({
  candidateId: z.string().min(1),
  preferredWindow: z.string().trim().min(3).max(200),
});

export const shortlistSchema = z.object({
  candidateId: z.string().min(1),
});

export const marketingRequestSchema = z.object({
  kind: z.enum([
    "SOCIAL_POST",
    "AD_COPY",
    "PROFILE_BLURB",
    "CAMPAIGN_COPY",
    "BLOG_ARTICLE",
    "NEWSLETTER",
    "HEADLINE",
    "SEO_PAGE",
  ]),
  candidateId: z.string().optional(),
  notes: z.string().trim().max(1000).default(""),
  language: z.enum(["en", "zh", "ms", "ta", "tl", "id", "my"]).default("en"),
  channel: z
    .enum(["facebook", "instagram", "tiktok", "whatsapp", "google_business", "email", "blog", "seo"])
    .optional(),
  campaignId: z.string().optional(),
});

export const draftReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const momAttestationSchema = z
  .object({
    notRelated: formBoolean,
    fdwOutsideSingapore: formBoolean,
    securityBondArranged: formBoolean,
    medicalInsuranceArranged: formBoolean,
    personalAccidentArranged: formBoolean,
    addressIsNricRegistered: formBoolean,
    salaryAgreedSgd: z.coerce.number().int().min(0).max(20000),
    restDaysPerMonth: z.coerce.number().int().min(1).max(8),
    proposedSubmissionDate: dateField,
    permitAction: z.enum(["new", "renewal"]).optional(),
    arrivalOn: optionalDate,
    sipOn: optionalDate,
    workPermitExpiresOn: optionalDate,
    insuranceRenewsOn: optionalDate,
    bondRenewsOn: optionalDate,
    inpatientSubLimitSgd: z.coerce.number().int().min(0).max(10_000_000).optional(),
    daySurgerySubLimitSgd: z.coerce.number().int().min(0).max(10_000_000).optional(),
    workerFeeSgd: z.coerce.number().int().min(0).max(200_000).optional(),
    contractMonths: z.coerce.number().int().min(1).max(120).optional(),
    workPassMonths: z.coerce.number().int().min(1).max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.arrivalOn && value.sipOn && !sipAttendanceAllowed(value.arrivalOn, value.sipOn)) {
      ctx.addIssue({
        code: "custom",
        message: "SIP cannot be attended on the arrival day.",
        path: ["sipOn"],
      });
    }
  });

export const workerFeeSchema = z.object({
  candidateId: z.string().min(1).max(40),
  monthlySalarySgd: z.coerce.number().int().min(0).max(20000),
  contractMonths: z.coerce.number().int().min(1).max(120),
  workPassMonths: z.coerce.number().int().min(1).max(120),
  feeSgd: z.coerce.number().int().min(0).max(200_000),
});

export const reminderOptInSchema = z.object({
  code: z.enum(REMINDER_TYPES.map((item) => item.code) as [string, ...string[]]),
  enabled: formBoolean.default(false),
});

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const sourceUrl = z.string().trim().url().max(300);

export const holidayAdjustmentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    date: isoDay,
    name: z.string().trim().min(2).max(80),
    sourceUrl,
    note: z.string().trim().max(500).default(""),
  }),
  z.object({
    action: z.literal("suppress"),
    date: isoDay,
    sourceUrl,
    note: z.string().trim().min(2).max(500),
  }),
  z.object({
    action: z.literal("remove"),
    id: z.string().min(1).max(40),
  }),
]);

export const momRuleReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), key: z.string().trim().min(1).max(80) }),
  z.object({
    action: z.literal("override"),
    key: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(500),
    sourceUrl,
    note: z.string().trim().min(2).max(500),
  }),
  z.object({ action: z.literal("clear"), key: z.string().trim().min(1).max(80) }),
]);

export const placementOutcomeSchema = z
  .object({
    matchId: z.string().trim().min(1).max(40),
    startedOn: dateField,
    endedOn: optionalDate,
    checkInMonth: z.preprocess((value) => {
      if (value == null || value === "") return undefined;
      return value;
    }, z.coerce.number().int().optional()),
    completion: z.enum(OUTCOME_COMPLETIONS),
    reasonCategory: z.string().trim().max(40).default(""),
    employerSatisfaction: z.coerce.number().int().min(1).max(5),
    helperSatisfaction: z.coerce.number().int().min(1).max(5),
    notes: z.string().trim().max(2000).default(""),
  })
  .superRefine((value, ctx) => {
    if (value.completion === "EARLY_TERMINATION" && !TERMINATION_REASONS.includes(value.reasonCategory as (typeof TERMINATION_REASONS)[number])) {
      ctx.addIssue({ code: "custom", path: ["reasonCategory"], message: "Choose a reason category." });
    }
    if (value.completion === "CHECK_IN" && value.checkInMonth !== 1 && value.checkInMonth !== 3 && value.checkInMonth !== 6) {
      ctx.addIssue({ code: "custom", path: ["checkInMonth"], message: "Check-ins are at 1, 3, or 6 months." });
    }
    if (value.completion !== "CHECK_IN" && !value.endedOn) {
      ctx.addIssue({ code: "custom", path: ["endedOn"], message: "Record the end date." });
    }
    if (value.endedOn && value.endedOn < value.startedOn) {
      ctx.addIssue({ code: "custom", path: ["endedOn"], message: "The end date is before the start date." });
    }
  });

export const unsubscribeSchema = z.object({
  token: z.string().trim().min(20).max(4000),
});

export const staffUserSchema = z.object({
  name: personName,
  email,
  password: passwordSchema,
  role: z.enum(["ADMIN", "STAFF"]),
});

export const sensitiveRevealSchema = z.object({
  field: z.enum(["passport", "fin", "medical", "nric"]),
  reasonCode: z.enum([
    "MOM_FILING",
    "IDENTITY_CHECK",
    "INTERVIEW_PREP",
    "SUBJECT_ACCESS",
    "INCIDENT_RESPONSE",
    "OTHER",
  ]),
  reasonText: z.string().trim().min(12).max(500),
});

export const documentAccessSchema = sensitiveRevealSchema.pick({ reasonCode: true, reasonText: true });

export const consentChangeSchema = z.object({
  purpose: z.enum(["photo_publication", "marketing_publication", "ai_processing"]),
  granted: formBoolean,
});

export const subjectExportSchema = z.object({
  password: z.string().min(8).max(200),
  format: z.enum(["json", "html", "pdf"]),
});

export const staffExportSchema = z.object({
  subjectType: z.enum(["candidate", "employer"]),
  subjectId: z.string().trim().min(5).max(40),
  reasonCode: sensitiveRevealSchema.shape.reasonCode,
  reasonText: z.string().trim().min(12).max(500),
  format: z.enum(["json", "html", "pdf"]),
});

export const assignmentSchema = z.object({
  staffEmail: z.string().trim().email().max(200),
});
