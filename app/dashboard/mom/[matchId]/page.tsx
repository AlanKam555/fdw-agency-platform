import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import type { ChecklistItem } from "@/lib/mom/checklist";

export const dynamic = "force-dynamic";

function flag(name: string, label: string) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" />
      {label}
    </label>
  );
}

export default async function MomCasePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { candidate: true, employer: true, momCase: { include: { reminders: true } } },
  });
  if (!match || match.decision !== "STAFF_APPROVED") notFound();
  const items = (match.momCase?.checklist as ChecklistItem[] | undefined) ?? [];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Work permit pack</h1>
        <p className="mt-2 text-sm">
          {match.candidate.fullName} · {match.employer.fullName}. Rule values are flagged to verify against current MOM guidance.
        </p>
      </div>
      <section className="card p-5">
        <h2 className="text-2xl">Attestations</h2>
        <div className="mt-3">
          <JsonForm action={`/api/staff/mom/${match.id}`} submitLabel="Build checklist">
            {flag("notRelated", "Employer is not a relative of the helper")}
            {flag("fdwOutsideSingapore", "Helper is outside Singapore and has not entered on a visit pass to look for work")}
            {flag("securityBondArranged", "Security bond arranged, or nationality is exempt")}
            {flag("medicalInsuranceArranged", "Medical insurance arranged")}
            {flag("personalAccidentArranged", "Personal accident insurance of at least the configured minimum")}
            {flag("addressIsNricRegistered", "Address matches the employer’s NRIC address")}
            <label className="label">
              Agreed salary (SGD)
              <input className="field" type="number" name="salaryAgreedSgd" defaultValue={match.candidate.salaryExpectationSgd} required />
            </label>
            <label className="label">
              Rest days per month
              <input className="field" type="number" name="restDaysPerMonth" defaultValue={4} required />
            </label>
            <label className="label">
              Proposed submission date
              <input className="field" type="date" name="proposedSubmissionDate" required />
            </label>
            <label className="label">
              Arrival date, if known
              <input className="field" type="date" name="arrivalOn" />
            </label>
            <label className="label">
              Work permit expiry, if known
              <input className="field" type="date" name="workPermitExpiresOn" />
            </label>
            <label className="label">
              Insurance renewal, if known
              <input className="field" type="date" name="insuranceRenewsOn" />
            </label>
            <label className="label">
              Security bond renewal, if known
              <input className="field" type="date" name="bondRenewsOn" />
            </label>
          </JsonForm>
        </div>
      </section>
      {match.momCase ? (
        <>
          <section className="card p-5">
            <h2 className="text-2xl">{match.momCase.ready ? "No blocking gaps" : "Gaps remain"}</h2>
            <a className="btn mt-3" href={`/api/staff/mom/${match.id}/pdf`}>
              Download summary PDF
            </a>
            <ul className="mt-4 grid gap-2 text-sm">
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.status}</strong> · {item.detail}{" "}
                  <a className="underline" href={item.sourceUrl}>
                    MOM source
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="text-2xl">Reminders</h2>
            <ul className="mt-3 grid gap-3">
              {match.momCase.reminders.map((reminder) => (
                <li key={reminder.id} className="grid gap-2">
                  <JsonForm action={`/api/staff/reminders/${reminder.id}`} submitLabel={reminder.done ? "Mark open" : "Mark done"}>
                    <span className="text-sm">
                      {reminder.title}
                      {reminder.dueOn ? ` · due ${reminder.dueOn.toISOString().slice(0, 10)}` : ""} — {reminder.dueHint}
                    </span>
                  </JsonForm>
                  {reminder.approvedAt ? (
                    <p className="text-sm">Approved for email.</p>
                  ) : (
                    <JsonForm action={`/api/staff/reminders/${reminder.id}/approve`} submitLabel="Approve email" refresh={false}>
                      <span className="text-sm">Approve this reminder on its own, without opting in the whole type.</span>
                    </JsonForm>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p>Build the checklist to see gaps and the PDF.</p>
      )}
      <p className="text-sm">
        <Link className="underline" href="/dashboard/mom">
          All packs
        </Link>
      </p>
    </div>
  );
}
