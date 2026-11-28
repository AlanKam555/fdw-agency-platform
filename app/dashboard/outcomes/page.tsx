import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import { TERMINATION_REASONS } from "@/lib/matching/outcomes";
import { placementOutcomeAudit } from "@/lib/services/growth";

export const dynamic = "force-dynamic";

export default async function OutcomesPage() {
  const [matches, outcomes, audit] = await Promise.all([
    prisma.match.findMany({
      where: { decision: "STAFF_APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { candidate: true, employer: true },
    }),
    prisma.placementOutcome.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { candidate: { select: { fullName: true, nationality: true } }, employer: { select: { fullName: true } } },
    }),
    placementOutcomeAudit(),
  ]);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Placement outcomes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          Staff record how a placement went. Helper satisfaction is collected by staff and is not shown to the employer. Notes stay on this desk. Religion, race, and pregnancy are not fields.
        </p>
      </div>
      <section className="card p-5">
        <h2 className="text-2xl">Record an outcome</h2>
        <div className="mt-3">
          <JsonForm action="/api/staff/outcomes" submitLabel="Save outcome" refresh={false}>
            <label className="label">
              Approved match
              <select className="select" name="matchId" required>
                <option value="">Choose</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.candidate.fullName} · {match.employer.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Started
              <input className="field" type="date" name="startedOn" required />
            </label>
            <label className="label">
              Ended
              <input className="field" type="date" name="endedOn" />
            </label>
            <label className="label">
              What happened
              <select className="select" name="completion" defaultValue="CHECK_IN">
                <option value="CHECK_IN">Check-in</option>
                <option value="COMPLETED">Completed</option>
                <option value="EARLY_TERMINATION">Early termination</option>
              </select>
            </label>
            <label className="label">
              Check-in month
              <select className="select" name="checkInMonth" defaultValue="">
                <option value="">Not a check-in</option>
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
              </select>
            </label>
            <label className="label">
              Reason, if it ended early
              <select className="select" name="reasonCategory" defaultValue="">
                <option value="">None</option>
                {TERMINATION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Employer satisfaction (1–5)
              <input className="field" type="number" name="employerSatisfaction" min={1} max={5} required />
            </label>
            <label className="label">
              Helper satisfaction, collected by staff (1–5)
              <input className="field" type="number" name="helperSatisfaction" min={1} max={5} required />
            </label>
            <label className="label">
              Staff-only notes
              <textarea className="area" name="notes" />
            </label>
          </JsonForm>
        </div>
      </section>
      <section className="card p-5 text-sm leading-6">
        <h2 className="text-2xl">Recorded</h2>
        <ul className="mt-3 grid gap-2">
          {outcomes.map((row) => (
            <li key={row.id}>
              {row.candidate.fullName} · {row.employer.fullName} · {row.completion} · {row.durationDays} days · employer {row.employerSatisfaction} · helper {row.helperSatisfaction}
              {row.reasonCategory ? ` · ${row.reasonCategory}` : ""}
              {row.notes ? <span className="block">Staff note: {row.notes}</span> : null}
            </li>
          ))}
          {outcomes.length === 0 ? <li>No outcomes yet.</li> : null}
        </ul>
      </section>
      <section className="card p-5 text-sm leading-6">
        <h2 className="text-2xl">Outcomes by nationality</h2>
        <p className="mt-2">{audit.note}</p>
        <p>{audit.smallSampleWarning}</p>
        <ul className="mt-3 grid gap-1">
          {audit.groups.map((group) => (
            <li key={group.nationality}>
              {group.nationality}: {group.outcomes} outcomes, {group.earlyTerminations} early, employer mean {group.meanEmployerSatisfaction ?? "—"}
              {group.smallSample ? " — small sample" : ""}
              {group.review ? " — review this gap" : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
