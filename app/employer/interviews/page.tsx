import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmployerInterviewsPage() {
  const { user } = await requireUser(["EMPLOYER"]);
  const employer = await prisma.employer.findUnique({
    where: { userId: user.id },
    include: { interviews: { include: { candidate: true }, orderBy: { createdAt: "desc" } } },
  });
  return (
    <div>
      <h1 className="text-4xl">Interview requests</h1>
      <ul className="mt-6 grid gap-3">
        {employer?.interviews.map((interview) => (
          <li key={interview.id} className="card p-4">
            <p className="text-2xl">{interview.candidate.fullName}</p>
            <p className="text-sm">
              {interview.status} · {interview.preferredWindow}
            </p>
          </li>
        ))}
        {!employer?.interviews.length ? <li>No requests yet. Open a helper profile to ask for a time.</li> : null}
      </ul>
    </div>
  );
}
