import { permitLeadDays, reminderKindForCode, type ReminderTypeCode } from "@/lib/reminders/catalog";
import { addCalendarDays, addDaysExcludingSundayAndHolidays, isoDate } from "@/lib/mom/dates";

export type DatedReminder = {
  code: string;
  kind: ReminderTypeCode;
  title: string;
  dueHint: string;
  dueOn: Date | null;
};

export function scheduleDatedReminders(input: {
  arrivalOn?: Date | null;
  workPermitExpiresOn?: Date | null;
  insuranceRenewsOn?: Date | null;
  bondRenewsOn?: Date | null;
  restDaysPerMonth: number;
  holidays: readonly string[];
  medicalExamDays: number;
  sipDays: number;
  firstTimeInSingapore: boolean;
  env?: NodeJS.ProcessEnv;
}): DatedReminder[] {
  const rows: DatedReminder[] = [];
  if (input.arrivalOn && input.firstTimeInSingapore) {
    const due = addDaysExcludingSundayAndHolidays(input.arrivalOn, input.sipDays, input.holidays);
    rows.push({
      code: "sip_due",
      kind: "settling_in",
      title: "Settling-in Programme deadline",
      dueHint: `Calculated as ${input.sipDays} days after arrival, excluding Sunday and the configured public holidays. Saturday counts. This is a preparation date, not a MOM filing.`,
      dueOn: due,
    });
  }
  if (input.arrivalOn) {
    rows.push({
      code: "medical_exam_due",
      kind: "medical_exam",
      title: "Medical examination deadline",
      dueHint: `Calculated as ${input.medicalExamDays} calendar days after arrival.`,
      dueOn: addCalendarDays(input.arrivalOn, input.medicalExamDays),
    });
  }
  if (input.workPermitExpiresOn) {
    const lead = permitLeadDays(input.env);
    rows.push({
      code: "work_permit_expiry",
      kind: "work_permit_expiry",
      title: "Work permit expiry",
      dueHint: "Staff follow-up for the expiry date recorded on the pack. This product does not renew a permit.",
      dueOn: input.workPermitExpiresOn,
    });
    rows.push({
      code: "work_permit_renewal",
      kind: "work_permit_renewal",
      title: "Work permit renewal follow-up",
      dueHint: `Agency follow-up ${lead} days before the recorded expiry. ${lead} is REMINDER_PERMIT_LEAD_DAYS, not a MOM rule.`,
      dueOn: addCalendarDays(input.workPermitExpiresOn, -lead),
    });
  }
  if (input.insuranceRenewsOn) {
    rows.push({
      code: "insurance_renewal",
      kind: "insurance_renewal",
      title: "Insurance renewal",
      dueHint: "Follow-up for the renewal date staff recorded. This product does not buy insurance.",
      dueOn: input.insuranceRenewsOn,
    });
  }
  if (input.bondRenewsOn) {
    rows.push({
      code: "security_bond_renewal",
      kind: "security_bond",
      title: "Security bond renewal",
      dueHint: "Follow-up for the bond date staff recorded. This product does not buy the bond.",
      dueOn: input.bondRenewsOn,
    });
  }
  if (input.arrivalOn && input.restDaysPerMonth > 0) {
    rows.push({
      code: "rest_day_follow_up",
      kind: "rest_day",
      title: "Rest-day follow-up",
      dueHint: `Staff follow-up 30 days after arrival. The household recorded ${input.restDaysPerMonth} rest days a month. 30 days is an agency check, not a MOM deadline.`,
      dueOn: addCalendarDays(input.arrivalOn, 30),
    });
  }
  return rows;
}

export function dueKey(date: Date | null): string {
  return date ? isoDate(date) : "open";
}

export function withDueDates(
  seeds: { code: string; title: string; dueHint: string }[],
  dated: DatedReminder[],
) {
  const used = new Set<string>();
  const rows = seeds.map((seed) => {
    const kind = reminderKindForCode(seed.code) ?? "";
    const match = dated.find((item) => item.kind === kind && !used.has(item.code));
    if (match) used.add(match.code);
    return {
      code: seed.code,
      kind,
      title: seed.title,
      dueHint: match ? `${seed.dueHint} ${match.dueHint}` : seed.dueHint,
      dueOn: match?.dueOn ?? null,
    };
  });
  for (const extra of dated) {
    if (used.has(extra.code)) continue;
    rows.push({
      code: extra.code,
      kind: extra.kind,
      title: extra.title,
      dueHint: extra.dueHint,
      dueOn: extra.dueOn,
    });
  }
  return rows;
}
