import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ShortlistPage() {
  const { user } = await requireUser(["EMPLOYER"]);
  const employer = await prisma.employer.findUnique({
    where: { userId: user.id },
    include: { shortlists: { include: { candidate: true }, orderBy: { createdAt: "desc" } } },
  });
  return (
    <div>
      <h1 className="text-4xl">Shortlist</h1>
      <ul className="mt-6 grid gap-3">
        {employer?.shortlists.map((item) => (
          <li key={item.id} className="card p-4">
            <Link className="underline" href={`/maids/${item.candidateId}`}>
              {item.candidate.fullName}
            </Link>
            <p className="text-sm">SGD {item.candidate.salaryExpectationSgd}</p>
          </li>
        ))}
        {!employer?.shortlists.length ? <li>Your shortlist is empty.</li> : null}
      </ul>
    </div>
  );
}
