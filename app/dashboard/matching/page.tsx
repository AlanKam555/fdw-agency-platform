import Link from "next/link";
import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import { matchingBiasReport } from "@/lib/services/growth";

export const dynamic = "force-dynamic";

export default async function MatchingPage() {
  const report = await matchingBiasReport();
  const requirements = await prisma.employerRequirement.findMany({
    orderBy: { createdAt: "desc" },
    include: { employer: true, _count: { select: { matches: true } } },
  });
  return (
    <div>
      <h1 className="text-4xl">Matching</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6">
        Scores use skills, languages, experience, salary fit, and availability. Age, nationality, sex, education, and medical fitness are gates. Religion, race, and pregnancy are not collected.
      </p>
      <div className="mt-6 grid gap-4">
        {requirements.map((requirement) => (
          <article key={requirement.id} className="card p-4">
            <h2 className="text-2xl">
              <Link className="underline" href={`/dashboard/matching/${requirement.id}`}>
                {requirement.title}
              </Link>
            </h2>
            <p className="text-sm">{requirement.employer.fullName}</p>
            <p className="text-sm">{requirement._count.matches} ranked rows</p>
            <div className="mt-3">
              <JsonForm action="/api/staff/matching" submitLabel="Rank available helpers">
                <input type="hidden" name="requirementId" value={requirement.id} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="hidden" name="includeScreened" value="false" />
                  <input type="checkbox" name="includeScreened" value="true" />
                  Also consider screened profiles
                </label>
              </JsonForm>
            </div>
          </article>
        ))}
        {requirements.length === 0 ? <p>No employer requirements yet.</p> : null}
      </div>
      <section className="card mt-6 p-4 text-sm leading-6">
        <h2 className="text-2xl">Fairness audit</h2>
        <p className="mt-2">{report.note}</p>
        <ul className="mt-3 grid gap-1">
          {report.groups.map((group) => (
            <li key={group.nationality}>
              {group.nationality}: {group.eligible} eligible of {group.considered}, mean {group.meanEligibleScore ?? "—"}, approved {group.approved}
              {group.review ? " — review this gap" : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
