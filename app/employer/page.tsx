import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmployerHome() {
  const { user } = await requireUser(["EMPLOYER"]);
  const employer = await prisma.employer.findUnique({
    where: { userId: user.id },
    include: { _count: { select: { shortlists: true, interviews: true, requirements: true } } },
  });
  return (
    <div>
      <h1 className="text-4xl">Your household</h1>
      {employer ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link className="card p-4" href="/employer/requirements">
            <p className="text-sm text-[var(--brass-ink)]">Briefs</p>
            <p className="display text-3xl">{employer._count.requirements}</p>
          </Link>
          <Link className="card p-4" href="/employer/shortlist">
            <p className="text-sm text-[var(--brass-ink)]">Shortlist</p>
            <p className="display text-3xl">{employer._count.shortlists}</p>
          </Link>
          <Link className="card p-4" href="/employer/interviews">
            <p className="text-sm text-[var(--brass-ink)]">Interviews</p>
            <p className="display text-3xl">{employer._count.interviews}</p>
          </Link>
        </div>
      ) : (
        <p className="mt-4">
          <Link className="underline" href="/employers/enquire">
            Send your household brief
          </Link>{" "}
          so staff can match helpers.
        </p>
      )}
    </div>
  );
}
