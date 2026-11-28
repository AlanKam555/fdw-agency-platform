import { notFound } from "next/navigation";
import { JsonForm, UploadForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import { PIPELINE, canTransition, type PipelineStatus } from "@/lib/candidates/status";
import { STATUS_LABELS, skillLabel } from "@/lib/labels";
import { requireUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireUser(["ADMIN", "STAFF"]);
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!candidate || candidate.redactedAt) notFound();
  const nextStatuses = [...PIPELINE, "REJECTED", "WITHDRAWN"].filter((status) =>
    canTransition(candidate.status as PipelineStatus, status as PipelineStatus),
  );

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-[var(--brass-ink)]">{STATUS_LABELS[candidate.status]}</p>
        <h1 className="text-4xl">{candidate.fullName}</h1>
        {candidate.fictional ? <p className="text-xs uppercase tracking-wide text-[var(--brass-ink)]">Fictional profile</p> : null}
        <p className="mt-2 text-sm">
          {candidate.nationality} · {candidate.experienceYears} years · SGD {candidate.salaryExpectationSgd} ·{" "}
          {candidate.languages.join(", ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidate.skills.map((skill) => (
            <span className="chip" key={skill}>
              {skillLabel(skill)}
            </span>
          ))}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="text-2xl">Pipeline</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {nextStatuses.map((status) => (
            <JsonForm key={status} action={`/api/staff/candidates/${candidate.id}/status`} submitLabel={STATUS_LABELS[status]}>
              <input type="hidden" name="status" value={status} />
            </JsonForm>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-2xl">Sensitive fields</h2>
        <p className="mt-2 text-sm">
          Passport {candidate.passportNumberEnc ? "is stored encrypted" : "was not provided"}. Medical notes{" "}
          {candidate.medicalNotesEnc ? "are stored encrypted" : "were not provided"}. Fit status: {candidate.medicalFitStatus}.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(["passport", "medical"] as const).map((field) => (
            <JsonForm key={field} action={`/api/staff/candidates/${candidate.id}/sensitive`} submitLabel={`Reveal ${field}`} refresh={false}>
              <input type="hidden" name="field" value={field} />
              <label className="label">
                Reason
                <select className="field" name="reasonCode" defaultValue="IDENTITY_CHECK">
                  <option value="MOM_FILING">MOM filing</option>
                  <option value="IDENTITY_CHECK">Identity check</option>
                  <option value="INTERVIEW_PREP">Interview preparation</option>
                  <option value="SUBJECT_ACCESS">Subject access</option>
                  <option value="INCIDENT_RESPONSE">Incident response</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="label">
                Why this is needed
                <textarea className="area" name="reasonText" minLength={12} required placeholder="At least a short sentence" />
              </label>
            </JsonForm>
          ))}
        </div>
        <p className="mt-3 text-xs">Each reveal is written to the audit log with the reason. The value is returned once and is not stored in the page. Hourly and daily quotas apply.</p>
      </section>

      <section className="card p-5">
        <h2 className="text-2xl">Documents</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {candidate.documents.map((document) => (
            <li key={document.id}>
              <JsonForm action={`/api/documents/${document.id}`} submitLabel={`Open ${document.fileName}`} refresh={false}>
                <input type="hidden" name="fileLabel" value={`${document.kind}: ${document.fileName}`} />
                <label className="label">
                  Reason
                  <select className="field" name="reasonCode" defaultValue="MOM_FILING">
                    <option value="MOM_FILING">MOM filing</option>
                    <option value="IDENTITY_CHECK">Identity check</option>
                    <option value="INTERVIEW_PREP">Interview preparation</option>
                    <option value="SUBJECT_ACCESS">Subject access</option>
                    <option value="INCIDENT_RESPONSE">Incident response</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="label">
                  Why this file is needed
                  <textarea className="area" name="reasonText" minLength={12} required />
                </label>
              </JsonForm>
            </li>
          ))}
          {candidate.documents.length === 0 ? <li>No files yet.</li> : null}
        </ul>
        <div className="mt-4">
          <UploadForm candidateId={candidate.id} />
        </div>
      </section>

      {user.role === "ADMIN" ? (
        <section className="card p-5">
          <h2 className="text-2xl">Redact this profile</h2>
          <p className="mt-2 text-sm">
            Erases direct identifiers, household narrative, passport and medical fields, and linked draft text. Match scores and placement category codes stay for the fairness audit. A failed file delete is queued instead of dropping the storage key.
          </p>
          <JsonForm action={`/api/staff/candidates/${candidate.id}/redact`} submitLabel="Redact personal data">
            <input type="hidden" name="confirm" value="yes" />
          </JsonForm>
        </section>
      ) : null}
      {user.role === "ADMIN" ? (
        <section className="card p-5">
          <h2 className="text-2xl">Assign a staff member</h2>
          <p className="mt-2 text-sm">
            Used only when STAFF_ASSIGNMENT_REQUIRED is on. Admins can still open every file.
          </p>
          <JsonForm action={`/api/staff/candidates/${candidate.id}/assign`} submitLabel="Assign">
            <label className="label">
              Staff email
              <input className="field" name="staffEmail" type="email" required />
            </label>
          </JsonForm>
        </section>
      ) : null}
    </div>
  );
}
