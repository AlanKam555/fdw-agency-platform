import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmployerRequirementsPage() {
  const { user } = await requireUser(["EMPLOYER"]);
  const employer = await prisma.employer.findUnique({
    where: { userId: user.id },
    include: { requirements: { orderBy: { createdAt: "desc" } } },
  });
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl">Your briefs</h1>
        <Link className="btn" href="/employers/enquire">
          New brief
        </Link>
      </div>
      <ul className="mt-6 grid gap-3">
        {employer?.requirements.map((requirement) => (
          <li key={requirement.id} className="card p-4">
            {requirement.title}
            <p className="text-sm">{requirement.createdAt.toISOString().slice(0, 10)}</p>
          </li>
        ))}
        {!employer?.requirements.length ? <li>No briefs yet.</li> : null}
      </ul>
    </div>
  );
}
