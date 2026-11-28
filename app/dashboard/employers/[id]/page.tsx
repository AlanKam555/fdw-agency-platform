import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import { skillLabel } from "@/lib/labels";
import { requireUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function EmployerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employer = await prisma.employer.findUnique({
    where: { id },
    include: { requirements: { orderBy: { createdAt: "desc" } } },
  });
  if (!employer || employer.redactedAt) notFound();
  const { user } = await requireUser(["ADMIN", "STAFF"]);
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
      <p className="mt-2 text-sm">EOP {employer.eopCompleted ? "completed" : "not recorded"}.</p>
      <p className="mt-2 text-sm">
        NRIC {employer.nricEnc ? "is stored encrypted" : "was not provided"}. A reason is stored with the audit row.
      </p>
      <p className="mt-2 text-sm">
        <Link className="underline" href={`/dashboard/contracts?employer=${employer.id}`}>
          Contracts
        </Link>
      </p>
      <JsonForm action={`/api/staff/employers/${employer.id}/sensitive`} submitLabel="Reveal NRIC" refresh={false}>
        <input type="hidden" name="field" value="nric" />
        <label className="label">
          Reason
          <select className="field" name="reasonCode" defaultValue="IDENTITY_CHECK">
            <option value="IDENTITY_CHECK">Identity check</option>
            <option value="MOM_FILING">MOM filing</option>
            <option value="SUBJECT_ACCESS">Subject access</option>
            <option value="INCIDENT_RESPONSE">Incident response</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="label">
          Why this is needed
          <textarea className="area" name="reasonText" minLength={12} required />
        </label>
      </JsonForm>
      {user.role === "ADMIN" ? (
        <section className="card mt-6 p-5">
          <h2 className="text-2xl">Redact this household</h2>
          <p className="mt-2 text-sm">Clears household notes, the encrypted NRIC, and related draft text. Placement category codes stay.</p>
          <JsonForm action={`/api/staff/employers/${employer.id}/redact`} submitLabel="Redact household data">
            <input type="hidden" name="confirm" value="yes" />
          </JsonForm>
        </section>
      ) : null}
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
