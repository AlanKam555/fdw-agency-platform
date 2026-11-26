import Link from "next/link";
import { listPublicHelpers } from "@/lib/services/candidates";
import { skillLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EmployerMaidsPage() {
  const helpers = await listPublicHelpers({});
  return (
    <div>
      <h1 className="text-4xl">Helpers you can shortlist</h1>
      <div className="mt-6 grid gap-3">
        {helpers.map((helper) => (
          <Link key={helper.id} href={`/maids/${helper.id}`} className="card p-4">
            <h2 className="text-2xl">{helper.fullName}</h2>
            <p className="text-sm">
              {helper.nationality} · SGD {helper.salaryExpectationSgd} · {helper.skills.map(skillLabel).join(", ")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
