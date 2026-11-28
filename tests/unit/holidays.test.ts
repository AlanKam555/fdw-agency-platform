import { describe, expect, it } from "vitest";
import { HOLIDAY_YEARS, officialHolidayDates, PUBLIC_HOLIDAY_SOURCE } from "@/config/public-holidays";
import { addCalendarDays, addDaysExcludingSundayAndHolidays } from "@/lib/mom/dates";
import { loadMomRules } from "@/config/mom-rules";

describe("Singapore public holidays", () => {
  it("keeps the MOM source, the verification date, and the 2027 gazette warning", () => {
    expect(HOLIDAY_YEARS.map((year) => year.year)).toEqual([2025, 2026, 2027]);
    for (const year of HOLIDAY_YEARS) {
      expect(year.sourceUrl).toBe(PUBLIC_HOLIDAY_SOURCE);
      expect(year.lastVerified).toBe("2026-11-26");
      expect(year.holidays.length).toBeGreaterThan(10);
    }
    const note = HOLIDAY_YEARS.find((year) => year.year === 2027)?.gazetteNote ?? "";
    expect(note).toMatch(/gazetted/i);
    expect(note).toMatch(/Re-check 2027/);
  });

  it("includes the Mondays MOM lists when a holiday falls on Sunday", () => {
    const dates = officialHolidayDates();
    expect(dates).toContain("2025-05-03");
    expect(dates).toContain("2026-05-31");
    expect(dates).toContain("2026-06-01");
    expect(dates).toContain("2026-08-09");
    expect(dates).toContain("2026-08-10");
    expect(dates).toContain("2026-11-08");
    expect(dates).toContain("2026-11-09");
    expect(dates).toContain("2027-02-07");
    expect(dates).toContain("2027-02-08");
    const observed = HOLIDAY_YEARS.flatMap((year) => year.holidays).filter((holiday) => holiday.observed);
    expect(observed.every((holiday) => holiday.note.includes("rest day"))).toBe(true);
  });

  it("counts Saturday for the settling-in programme and skips Sunday and public holidays", () => {
    const holidays = officialHolidayDates();
    const friday = new Date("2026-05-29T00:00:00.000Z");
    expect(addDaysExcludingSundayAndHolidays(friday, 1, holidays).toISOString().slice(0, 10)).toBe("2026-05-30");
    expect(addDaysExcludingSundayAndHolidays(friday, 2, holidays).toISOString().slice(0, 10)).toBe("2026-06-02");
    expect(addCalendarDays(friday, 14).toISOString().slice(0, 10)).toBe("2026-06-12");
  });

  it("uses the official list when no holiday override is set", () => {
    const previous = process.env.MOM_PUBLIC_HOLIDAYS;
    delete process.env.MOM_PUBLIC_HOLIDAYS;
    expect(loadMomRules().publicHolidays).toEqual(officialHolidayDates());
    process.env.MOM_PUBLIC_HOLIDAYS = "2026-01-01";
    expect(loadMomRules().publicHolidays).toEqual(["2026-01-01"]);
    if (previous === undefined) delete process.env.MOM_PUBLIC_HOLIDAYS;
    else process.env.MOM_PUBLIC_HOLIDAYS = previous;
  });
});
