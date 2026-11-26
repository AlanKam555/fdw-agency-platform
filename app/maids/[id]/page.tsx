import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/portrait";
import { JsonForm } from "@/components/json-form";
import { getSession } from "@/lib/auth/current";
import { skillLabel } from "@/lib/labels";
import { getPublicHelper } from "@/lib/services/candidates";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const helper = await getPublicHelper(id);
  if (!helper) return { title: "Helper" };
  return {
    title: helper.fullName,
    description: `${helper.experienceYears} years of experience. Languages: ${helper.languages.join(", ")}.`,
  };
}

export default async function MaidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const helper = await getPublicHelper(id);
  if (!helper) notFound();
  const session = await getSession();

  return (
    <article className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-[280px_1fr]">
      <div className="card overflow-hidden">
        {helper.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`Consented portrait of ${helper.fullName}`} src={`/api/portraits/${helper.id}`} />
        ) : (
          <Portrait id={helper.id} name={helper.fullName} />
        )}
      </div>
      <div>
        {helper.fictional ? (
          <p className="text-xs tracking-[0.16em] text-[var(--brass)] uppercase">Fictional demonstration profile</p>
        ) : null}
        <h1 className="text-5xl">{helper.fullName}</h1>
        <p className="mt-2 text-lg">
          {helper.nationality} · {helper.experienceYears} years · {helper.educationYears} years of formal education
        </p>
        <p className="mt-1">Expected salary SGD {helper.salaryExpectationSgd} · available {helper.availableFrom}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {helper.skills.map((skill) => (
            <span key={skill} className="chip">
              {skillLabel(skill)}
            </span>
          ))}
        </div>
        <p className="mt-4">Languages: {helper.languages.join(", ")}</p>
        <p className="mt-4 leading-7">{helper.publicBlurb || "Staff have not published a blurb yet."}</p>
        {helper.householdExperience ? <p className="mt-4 leading-7">{helper.householdExperience}</p> : null}
        <div className="card mt-6 p-5">
          {session?.role === "EMPLOYER" ? (
            <div className="grid gap-6">
              <JsonForm action="/api/employer/shortlist" submitLabel="Add to shortlist" success="Shortlisted.">
                <input type="hidden" name="candidateId" value={helper.id} />
              </JsonForm>
              <JsonForm action="/api/employer/interviews" submitLabel="Request an interview">
                <input type="hidden" name="candidateId" value={helper.id} />
                <label className="label">
                  Preferred window
                  <input className="field" name="preferredWindow" placeholder="Weekday evenings next week" required />
                </label>
              </JsonForm>
            </div>
          ) : (
            <p>
              <Link className="underline" href="/register">
                Create an employer account
              </Link>{" "}
              to shortlist this profile and request an interview. Direct phone numbers are not published.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
