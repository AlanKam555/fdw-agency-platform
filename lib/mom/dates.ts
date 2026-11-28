export function completedYears(dateOfBirth: Date, on: Date): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  const day = on.getUTCDate() - dateOfBirth.getUTCDate();
  if (month < 0 || (month === 0 && day < 0)) age -= 1;
  return age;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isHoliday(date: Date, holidays: readonly string[]): boolean {
  return holidays.includes(isoDate(date));
}

export function isWorkingDay(date: Date, holidays: readonly string[]): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

export function addCalendarDays(from: Date, days: number): Date {
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor;
}

/**
 * SIP counts Saturday. It skips Sunday and public holidays, and it does not count `from`.
 * This is separate from `addWorkingDays`, which also skips Saturday.
 */
export function addDaysExcludingSundayAndHolidays(
  from: Date,
  days: number,
  holidays: readonly string[],
): Date {
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0 && !isHoliday(cursor, holidays)) remaining -= 1;
  }
  return cursor;
}

/** First calendar date that is `days` working days after `from`, not counting `from`. */
export function addWorkingDays(
  from: Date,
  days: number,
  holidays: readonly string[],
): Date {
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, holidays)) remaining -= 1;
  }
  return cursor;
}

export function onOrAfter(date: Date, earliest: Date): boolean {
  return isoDate(date) >= isoDate(earliest);
}
