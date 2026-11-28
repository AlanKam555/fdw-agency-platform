/**
 * Singapore public holidays transcribed from MOM on 2026-11-26.
 * Source: https://www.mom.gov.sg/employment-practices/public-holidays
 *
 * A Monday marked `observed` is included because MOM says that Monday is a
 * public holiday when the worker's rest day falls on the Sunday holiday.
 * Deadline maths treats that Monday as a holiday. 2027 lunar dates are listed
 * by MOM and must be re-checked when the holidays are gazetted.
 */

export const PUBLIC_HOLIDAY_SOURCE = "https://www.mom.gov.sg/employment-practices/public-holidays";
export const HOLIDAYS_LAST_VERIFIED = "2026-11-26";

export type HolidayEntry = {
  date: string;
  name: string;
  observed: boolean;
  note: string;
};

export type HolidayYear = {
  year: number;
  sourceUrl: string;
  lastVerified: string;
  gazetteNote: string;
  holidays: HolidayEntry[];
};

const OBSERVED =
  "MOM lists the following Monday as a public holiday when the rest day falls on this Sunday.";

function day(date: string, name: string, note = ""): HolidayEntry {
  return { date, name, observed: false, note };
}

function observedMonday(date: string, name: string): HolidayEntry {
  return { date, name, observed: true, note: OBSERVED };
}

export const HOLIDAY_YEARS: HolidayYear[] = [
  {
    year: 2025,
    sourceUrl: PUBLIC_HOLIDAY_SOURCE,
    lastVerified: HOLIDAYS_LAST_VERIFIED,
    gazetteNote: "2025 dates are the days MOM lists for that year, including Polling Day.",
    holidays: [
      day("2025-01-01", "New Year's Day"),
      day("2025-01-29", "Chinese New Year"),
      day("2025-01-30", "Chinese New Year"),
      day("2025-03-31", "Hari Raya Puasa"),
      day("2025-04-18", "Good Friday"),
      day("2025-05-01", "Labour Day"),
      day("2025-05-03", "Polling Day"),
      day("2025-05-12", "Vesak Day"),
      day("2025-06-07", "Hari Raya Haji"),
      day("2025-08-09", "National Day"),
      day("2025-10-20", "Deepavali"),
      day("2025-12-25", "Christmas Day"),
    ],
  },
  {
    year: 2026,
    sourceUrl: PUBLIC_HOLIDAY_SOURCE,
    lastVerified: HOLIDAYS_LAST_VERIFIED,
    gazetteNote:
      "2026 dates are the days MOM lists. Vesak Day, National Day, and Deepavali fall on Sunday. The following Monday is included because MOM says it is a public holiday when the rest day is that Sunday.",
    holidays: [
      day("2026-01-01", "New Year's Day"),
      day("2026-02-17", "Chinese New Year"),
      day("2026-02-18", "Chinese New Year"),
      day("2026-03-21", "Hari Raya Puasa"),
      day("2026-04-03", "Good Friday"),
      day("2026-05-01", "Labour Day"),
      day("2026-05-27", "Hari Raya Haji"),
      day("2026-05-31", "Vesak Day"),
      observedMonday("2026-06-01", "Vesak Day (observed Monday)"),
      day("2026-08-09", "National Day"),
      observedMonday("2026-08-10", "National Day (observed Monday)"),
      day("2026-11-08", "Deepavali"),
      observedMonday("2026-11-09", "Deepavali (observed Monday)"),
      day("2026-12-25", "Christmas Day"),
    ],
  },
  {
    year: 2027,
    sourceUrl: PUBLIC_HOLIDAY_SOURCE,
    lastVerified: HOLIDAYS_LAST_VERIFIED,
    gazetteNote:
      "MOM lists these 2027 dates on the public holidays page. Lunar holidays (Chinese New Year, Hari Raya Puasa, Hari Raya Haji, Vesak Day, and Deepavali) can move when the holiday is gazetted. Re-check 2027 against MOM before using the dates operationally.",
    holidays: [
      day("2027-01-01", "New Year's Day"),
      day("2027-02-06", "Chinese New Year"),
      day("2027-02-07", "Chinese New Year"),
      observedMonday("2027-02-08", "Chinese New Year (observed Monday)"),
      day("2027-03-10", "Hari Raya Puasa"),
      day("2027-03-26", "Good Friday"),
      day("2027-05-01", "Labour Day"),
      day("2027-05-17", "Hari Raya Haji"),
      day("2027-05-20", "Vesak Day"),
      day("2027-08-09", "National Day"),
      day("2027-10-28", "Deepavali"),
      day("2027-12-25", "Christmas Day"),
    ],
  },
];

export function officialHolidayDates(years: readonly HolidayYear[] = HOLIDAY_YEARS): string[] {
  return [...new Set(years.flatMap((year) => year.holidays.map((holiday) => holiday.date)))].sort();
}

export function holidayByDate(date: string, years: readonly HolidayYear[] = HOLIDAY_YEARS): HolidayEntry | null {
  for (const year of years) {
    const found = year.holidays.find((holiday) => holiday.date === date);
    if (found) return found;
  }
  return null;
}
