import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MomListPage() {
  const matches = await prisma.match.findMany({
    where: { decision: "STAFF_APPROVED" },
    include: { candidate: true, employer: true, momCase: true },
    orderBy: { decidedAt: "desc" },
  });
  return (
    <div>
      <h1 className="text-4xl">MOM packs</h1>
      <p className="mt-2 max-w-2xl text-sm">
        These packs prepare a checklist and a PDF. Staff lodge the work permit on MOM WP Online with Singpass or CorpPass.
      </p>
      <ul className="mt-6 grid gap-3">
        {matches.map((match) => (
          <li key={match.id} className="card p-4">
            <Link className="underline" href={`/dashboard/mom/${match.id}`}>
              {match.candidate.fullName} for {match.employer.fullName}
            </Link>
            <p className="text-sm">{match.momCase ? (match.momCase.ready ? "Checklist ready" : "Checklist has gaps") : "Not prepared"}</p>
          </li>
        ))}
        {matches.length === 0 ? <li>Approve a match before preparing a pack.</li> : null}
      </ul>
    </div>
  );
}
