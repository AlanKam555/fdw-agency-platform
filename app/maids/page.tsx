import type { Metadata } from "next";
import Link from "next/link";
import { Portrait } from "@/components/portrait";
import { SKILL_LABELS, skillLabel, LANGUAGES } from "@/lib/labels";
import { AGENCY } from "@/content/site";
import { listPublicHelpers } from "@/lib/services/candidates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Available helpers",
  description: `Consented helper profiles currently marked available by ${AGENCY.name} staff.`,
};

export default async function MaidsPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; language?: string; maxSalary?: string }>;
}) {
  const query = await searchParams;
  const maxSalary = query.maxSalary ? Number(query.maxSalary) : undefined;
  const helpers = await listPublicHelpers({
    skill: query.skill,
    language: query.language,
    maxSalary: Number.isFinite(maxSalary) ? maxSalary : undefined,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-5xl">Available helpers</h1>
      <p className="mt-3 max-w-2xl text-[var(--ink)]/80">
        Only profiles with photo consent and an available status are listed. Age is not shown. Filters cover skills, language, and salary.
      </p>
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="label">
          Skill
          <select className="select w-auto" name="skill" defaultValue={query.skill ?? ""}>
            <option value="">Any skill</option>
            {Object.entries(SKILL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Language
          <select className="select w-auto" name="language" defaultValue={query.language ?? ""}>
            <option value="">Any language</option>
            {LANGUAGES.map((language) => (
              <option key={language}>{language}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Maximum salary (SGD)
          <input className="field w-36" name="maxSalary" type="number" min={0} defaultValue={query.maxSalary ?? ""} />
        </label>
        <button className="btn" type="submit">
          Filter
        </button>
      </form>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {helpers.map((helper) => (
          <Link key={helper.id} href={`/maids/${helper.id}`} className="card overflow-hidden">
            <div className="h-64 bg-[var(--lagoon)]">
              {helper.hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={`/api/portraits/${helper.id}`} className="h-full w-full object-cover" />
              ) : (
                <Portrait id={helper.id} name={helper.fullName} />
              )}
            </div>
            <div className="p-4">
              <h2 className="text-2xl">{helper.fullName}</h2>
              <p className="text-sm">
                {helper.nationality} · {helper.experienceYears} years · from {helper.availableFrom}
              </p>
              <p className="mt-1 text-sm">SGD {helper.salaryExpectationSgd} / month</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {helper.skills.map((skill) => (
                  <span className="chip" key={skill}>
                    {skillLabel(skill)}
                  </span>
                ))}
              </div>
              {helper.fictional ? <p className="mt-3 text-xs uppercase tracking-wide text-[var(--brass-ink)]">Fictional profile</p> : null}
            </div>
          </Link>
        ))}
      </div>
      {helpers.length === 0 ? <p className="mt-6">No profiles match those filters.</p> : null}
    </div>
  );
}
