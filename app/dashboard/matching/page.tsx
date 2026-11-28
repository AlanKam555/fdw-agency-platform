import Link from "next/link";
import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import { matchingBiasReport, placementOutcomeAudit } from "@/lib/services/growth";
import { outcomeSuggestion } from "@/lib/services/outcomes";
import { DEFAULT_WEIGHTS, coerceWeights } from "@/lib/matching/weights";

export const dynamic = "force-dynamic";

export default async function MatchingPage() {
  const report = await matchingBiasReport();
  const outcomes = await placementOutcomeAudit();
  const requirements = await prisma.employerRequirement.findMany({
    orderBy: { createdAt: "desc" },
    include: { employer: true, _count: { select: { matches: true } } },
  });
  const profiles = await prisma.matchWeightProfile.findMany({
    where: { requirementId: { in: requirements.map((requirement) => requirement.id) } },
  });
  const weightByRequirement = new Map(profiles.map((profile) => [profile.requirementId, coerceWeights(profile.weights)]));
  const adviceByEmployer = new Map<string, Awaited<ReturnType<typeof outcomeSuggestion>>>();
  for (const requirement of requirements) {
    if (!adviceByEmployer.has(requirement.employerId)) {
      adviceByEmployer.set(
        requirement.employerId,
        await outcomeSuggestion(requirement.employerId, weightByRequirement.get(requirement.id) ?? DEFAULT_WEIGHTS),
      );
    }
  }
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
            <p className="text-sm">
              Outcome evidence: {adviceByEmployer.get(requirement.employerId)?.evidenceCount ?? 0}. Suggested skills{" "}
              {adviceByEmployer.get(requirement.employerId)?.suggestion.skills ?? DEFAULT_WEIGHTS.skills}. Weights are not applied until you save them.
            </p>
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
      <section className="card mt-6 p-4 text-sm leading-6">
        <h2 className="text-2xl">Outcome fairness</h2>
        <p className="mt-2">{outcomes.note}</p>
        <p>{outcomes.smallSampleWarning}</p>
        <ul className="mt-3 grid gap-1">
          {outcomes.groups.map((group) => (
            <li key={group.nationality}>
              {group.nationality}: {group.outcomes} outcomes, employer mean {group.meanEmployerSatisfaction ?? "—"}
              {group.smallSample ? " — small sample" : ""}
              {group.review ? " — review this gap" : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
