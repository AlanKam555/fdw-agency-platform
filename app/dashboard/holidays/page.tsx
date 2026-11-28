import { JsonForm } from "@/components/json-form";
import { HOLIDAY_YEARS, PUBLIC_HOLIDAY_SOURCE } from "@/config/public-holidays";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const adjustments = await prisma.publicHolidayAdjustment.findMany({ orderBy: { date: "asc" } });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Public holidays</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          Deadline maths starts from the MOM list. A Monday marked observed is included because MOM says that Monday is a public holiday when the rest day falls on the Sunday. Staff changes are audit-logged and apply on top of the list.
        </p>
      </div>
      {HOLIDAY_YEARS.map((year) => (
        <section key={year.year} className="card p-5">
          <h2 className="text-2xl">{year.year}</h2>
          <p className="mt-2 text-sm leading-6">{year.gazetteNote}</p>
          <p className="mt-2 text-sm">
            Last verified {year.lastVerified}.{" "}
            <a className="underline" href={year.sourceUrl}>
              MOM source
            </a>
          </p>
          <ul className="mt-3 grid gap-1 text-sm">
            {year.holidays.map((holiday) => (
              <li key={holiday.date}>
                {holiday.date} · {holiday.name}
                {holiday.observed ? " · observed Monday" : ""}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="card p-5">
        <h2 className="text-2xl">Staff adjustment</h2>
        <div className="mt-3 grid gap-6">
          <JsonForm action="/api/staff/holidays" submitLabel="Add holiday">
            <input type="hidden" name="action" value="add" />
            <label className="label">
              Date
              <input className="field" type="date" name="date" required />
            </label>
            <label className="label">
              Name
              <input className="field" name="name" required />
            </label>
            <label className="label">
              Source URL
              <input className="field" name="sourceUrl" type="url" required defaultValue={PUBLIC_HOLIDAY_SOURCE} />
            </label>
            <label className="label">
              Note
              <input className="field" name="note" />
            </label>
          </JsonForm>
          <JsonForm action="/api/staff/holidays" submitLabel="Suppress official date">
            <input type="hidden" name="action" value="suppress" />
            <label className="label">
              Date
              <input className="field" type="date" name="date" required />
            </label>
            <label className="label">
              Source URL
              <input className="field" name="sourceUrl" type="url" required defaultValue={PUBLIC_HOLIDAY_SOURCE} />
            </label>
            <label className="label">
              Why this date should be ignored
              <input className="field" name="note" required />
            </label>
          </JsonForm>
        </div>
        <ul className="mt-4 grid gap-3 text-sm">
          {adjustments.map((row) => (
            <li key={row.id}>
              <JsonForm action="/api/staff/holidays" submitLabel="Remove adjustment">
                <input type="hidden" name="action" value="remove" />
                <input type="hidden" name="id" value={row.id} />
                <span>
                  {row.date} · {row.name} · {row.suppressed ? "suppressed" : "added"}
                </span>
              </JsonForm>
            </li>
          ))}
          {adjustments.length === 0 ? <li>No staff adjustments.</li> : null}
        </ul>
      </section>
    </div>
  );
}
