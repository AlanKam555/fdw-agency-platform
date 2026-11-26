import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmployersPage() {
  const employers = await prisma.employer.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { requirements: true, shortlists: true } } },
  });
  return (
    <div>
      <h1 className="text-4xl">Employers</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)]">
            <th className="py-2">Name</th>
            <th>Household</th>
            <th>Budget</th>
            <th>Briefs</th>
          </tr>
        </thead>
        <tbody>
          {employers.map((employer) => (
            <tr key={employer.id} className="border-b border-[var(--line)]">
              <td className="py-2">
                <Link className="underline" href={`/dashboard/employers/${employer.id}`}>
                  {employer.fullName}
                </Link>
              </td>
              <td>
                {employer.householdSize} people · {employer.addressArea}
              </td>
              <td>
                {employer.budgetMinSgd}–{employer.budgetMaxSgd}
              </td>
              <td>{employer._count.requirements}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
