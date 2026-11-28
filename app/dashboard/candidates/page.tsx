import Link from "next/link";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const candidates = await prisma.candidate.findMany({
    where: { redactedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl">Helpers</h1>
        <Link className="btn" href="/dashboard/candidates/new">
          New intake
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="py-2">Name</th>
              <th>Status</th>
              <th>Nationality</th>
              <th>Experience</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="border-b border-[var(--line)]">
                <td className="py-2">
                  <Link className="underline" href={`/dashboard/candidates/${candidate.id}`}>
                    {candidate.fullName}
                  </Link>
                  {candidate.fictional ? <span className="ml-2 text-xs text-[var(--brass-ink)]">fictional</span> : null}
                </td>
                <td>{STATUS_LABELS[candidate.status]}</td>
                <td>{candidate.nationality}</td>
                <td>{candidate.experienceYears} years</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
