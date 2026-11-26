import Link from "next/link";
import { headers } from "next/headers";
import { Portrait } from "@/components/portrait";
import { AGENCY, services, testimonials } from "@/content/site";
import { listPublicHelpers } from "@/lib/services/candidates";
import { skillLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const helpers = await listPublicHelpers({}).catch(() => []);
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-end gap-10 px-4 py-14 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-sm tracking-[0.18em] text-[var(--brass)] uppercase">Employment agency · {AGENCY.city}</p>
          <h1 className="mt-3 max-w-xl text-5xl leading-[1.05] md:text-6xl">
            Care for the household, with the paperwork kept in the open.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--ink)]/80">
            {AGENCY.name} introduces foreign domestic workers to families in Singapore, then prepares the Ministry of Manpower file for a person to submit. Staff decide every match. AI only drafts words for review.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn" href="/employers/enquire">
              Tell us about your household
            </Link>
            <Link className="btn secondary" href="/maids">
              See available helpers
            </Link>
          </div>
        </div>
        <aside className="card p-6">
          <p className="text-sm text-[var(--brass)]">How a placement moves</p>
          <ol className="mt-4 grid gap-3 text-sm">
            {[
              "Helper applies, with consent for the data we actually need.",
              "Staff screen documents and mark a profile available.",
              "An employer shortlists and requests an interview.",
              "Staff approve a match. A model can explain the score. It cannot decide.",
              "Staff download a MOM pack and lodge it themselves.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="display text-xl text-[var(--lagoon)]">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-4">
        {services.map((service) => (
          <article key={service.title} className="card p-5">
            <h2 className="text-2xl">{service.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink)]/80">{service.body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-4xl">Helpers who agreed to be introduced</h2>
          <Link href="/maids" className="text-sm underline">
            Full gallery
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {helpers.slice(0, 3).map((helper) => (
            <Link key={helper.id} href={`/maids/${helper.id}`} className="card overflow-hidden">
              <div className="h-56 bg-[var(--lagoon)]">
                {helper.hasPhoto ? (
                  // Consented portrait served only while the profile is available.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/portraits/${helper.id}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Portrait name={helper.fullName} id={helper.id} />
                )}
              </div>
              <div className="p-4">
                <h3 className="text-2xl">{helper.fullName}</h3>
                <p className="text-sm text-[var(--ink)]/70">
                  {helper.nationality} · {helper.experienceYears} years · SGD {helper.salaryExpectationSgd}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {helper.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="chip">
                      {skillLabel(skill)}
                    </span>
                  ))}
                </div>
                {helper.fictional ? <p className="mt-3 text-xs uppercase tracking-wide text-[var(--brass)]">Fictional profile</p> : null}
              </div>
            </Link>
          ))}
          {helpers.length === 0 ? <p>No consented profiles are available yet.</p> : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <blockquote className="card p-8">
          <p className="display text-3xl leading-snug">“{testimonials[0].quote}”</p>
          <footer className="mt-4 text-sm">
            {testimonials[0].name}, {testimonials[0].area} · fictional story
          </footer>
        </blockquote>
      </section>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EmploymentAgency",
            name: AGENCY.legalName,
            address: AGENCY.address,
            areaServed: "Singapore",
            description: "Fictional demonstration agency for foreign domestic worker placement.",
          }),
        }}
      />
    </div>
  );
}
