export const REMINDER_TYPES = [
  { code: "work_permit_expiry", label: "Work permit expiry" },
  { code: "work_permit_renewal", label: "Work permit renewal follow-up" },
  { code: "medical_exam", label: "Medical examination" },
  { code: "security_bond", label: "Security bond or bond renewal" },
  { code: "insurance_renewal", label: "Insurance renewal" },
  { code: "settling_in", label: "Settling-in Programme" },
  { code: "rest_day", label: "Rest-day follow-up" },
  { code: "interview_request", label: "Interview request" },
] as const;

export type ReminderTypeCode = (typeof REMINDER_TYPES)[number]["code"];

const CODES = new Set<string>(REMINDER_TYPES.map((item) => item.code));

export function isReminderType(value: string): value is ReminderTypeCode {
  return CODES.has(value);
}

export function reminderKindForCode(code: string): ReminderTypeCode | null {
  if (code === "sip") return "settling_in";
  if (code === "measles" || code === "medical_exam") return "medical_exam";
  if (code === "security_bond" || code === "security_bond_renewal") return "security_bond";
  if (code === "salary_rest" || code === "rest_day" || code === "rest_day_follow_up") return "rest_day";
  if (isReminderType(code)) return code;
  return null;
}

export function reminderLabel(code: string): string {
  return REMINDER_TYPES.find((item) => item.code === code)?.label ?? code;
}

/** Agency follow-up window. This is not a MOM figure. */
export function permitLeadDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.REMINDER_PERMIT_LEAD_DAYS ?? "30");
  if (!Number.isInteger(raw) || raw < 1 || raw > 180) return 30;
  return raw;
}

export function remindersWillSend(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REMINDERS_SEND === "true";
}

export function includeHelperEmail(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REMINDER_INCLUDE_HELPER === "true";
}
