import Link from "next/link";
import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUSES = ["REQUESTED", "SCHEDULED", "COMPLETED", "CANCELLED", "DECLINED"] as const;

export default async function InterviewsPage() {
  const interviews = await prisma.interviewRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { employer: true, candidate: true },
  });
  return (
    <div>
      <h1 className="text-4xl">Interviews</h1>
      <div className="mt-6 grid gap-4">
        {interviews.map((interview) => (
          <article key={interview.id} className="card p-4">
            <h2 className="text-2xl">
              {interview.employer.fullName} with{" "}
              <Link className="underline" href={`/dashboard/candidates/${interview.candidateId}`}>
                {interview.candidate.fullName}
              </Link>
            </h2>
            <p className="text-sm">
              {interview.status} · {interview.preferredWindow}
            </p>
            <div className="mt-3">
              <JsonForm action={`/api/staff/interviews/${interview.id}/feedback`} submitLabel="Save feedback">
                <label className="label">
                  Outcome
                  <select className="select" name="outcome" defaultValue="HOLD">
                    <option>PROCEED</option>
                    <option>HOLD</option>
                    <option>DECLINED</option>
                  </select>
                </label>
                <label className="label">
                  Gap to consider
                  <select className="select" name="gaps[]" defaultValue="">
                    <option value="">None</option>
                    <option value="skill">Skill</option>
                    <option value="language">Language</option>
                    <option value="care">Care need</option>
                    <option value="experience">Experience</option>
                  </select>
                </label>
                <label className="label">
                  Notes
                  <input className="field" name="notes" />
                </label>
              </JsonForm>
            </div>
            <div className="mt-3">
              <JsonForm action={`/api/staff/interviews/${interview.id}`} submitLabel="Update">
                <label className="label">
                  Status
                  <select className="select" name="status" defaultValue={interview.status}>
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Staff note
                  <input className="field" name="staffNote" defaultValue={interview.staffNote} />
                </label>
              </JsonForm>
            </div>
          </article>
        ))}
        {interviews.length === 0 ? <p>No interview requests yet.</p> : null}
      </div>
    </div>
  );
}
