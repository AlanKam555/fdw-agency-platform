import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { skillLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EmployerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employer = await prisma.employer.findUnique({
    where: { id },
    include: { requirements: { orderBy: { createdAt: "desc" } } },
  });
  if (!employer) notFound();
  return (
    <div>
      <h1 className="text-4xl">{employer.fullName}</h1>
      <p className="mt-2 text-sm">
        {employer.email} · {employer.phone} · {employer.housingType} in {employer.addressArea}
      </p>
      <p className="mt-2 text-sm">
        Household {employer.householdSize}, children {employer.childrenCount} ({employer.childrenUnder7Count} under 7), elderly{" "}
        {employer.elderlyCount}, pets {employer.hasPets ? employer.petDetails || "yes" : "no"}.
      </p>
      <p className="mt-2 text-sm">
        Skills: {employer.skillsRequired.map(skillLabel).join(", ") || "none listed"}. Languages:{" "}
        {employer.languagesPreferred.join(", ") || "none listed"}.
      </p>
      <p className="mt-2 text-sm">
        NRIC {employer.nricEnc ? "is stored encrypted" : "was not provided"}. EOP {employer.eopCompleted ? "completed" : "not recorded"}.
      </p>
      <h2 className="mt-8 text-2xl">Requirements</h2>
      <ul className="mt-3 grid gap-2 text-sm">
        {employer.requirements.map((requirement) => (
          <li key={requirement.id}>
            <Link className="underline" href={`/dashboard/matching/${requirement.id}`}>
              {requirement.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
