import Link from "next/link";
import { headers } from "next/headers";
import { Portrait } from "@/components/portrait";
import { brand } from "@/config/brand";
import { AGENCY, services, testimonials } from "@/content/site";
import { t, type MessageKey } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { employmentAgencyJsonLd } from "@/lib/seo/structured-data";
import { listPublicHelpers } from "@/lib/services/candidates";
import { skillLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = await getLocale();
  const helpers = await listPublicHelpers({}).catch(() => []);
  const jsonLd = employmentAgencyJsonLd({
    fictionalDemo: brand.fictionalDemo,
    name: brand.name,
    legalName: brand.legalName,
    url: process.env.APP_URL || "",
    phone: brand.phone,
    email: brand.email,
    address: brand.address,
    licenceNo: brand.licenceNo,
  });
  const steps: MessageKey[] = ["home.step1", "home.step2", "home.step3", "home.step4", "home.step5"];
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-end gap-10 px-4 py-14 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-sm tracking-[0.18em] text-[var(--brass-ink)] uppercase">{t(locale, "home.kicker")} · {AGENCY.city}</p>
          <h1 className="mt-3 max-w-xl text-5xl leading-[1.05] md:text-6xl">
            {t(locale, "home.title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--ink)]/80">
            {AGENCY.name} {t(locale, "home.lede")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn" href="/employers/enquire">
              {t(locale, "home.household")}
            </Link>
            <Link className="btn secondary" href="/maids">
              {t(locale, "home.galleryLink")}
            </Link>
          </div>
        </div>
        <aside className="card p-6">
          <p className="text-sm text-[var(--brass-ink)]">{t(locale, "home.stepsTitle")}</p>
          <ol className="mt-4 grid gap-3 text-sm">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="display text-xl text-[var(--lagoon)]">{index + 1}</span>
                <span>{t(locale, step)}</span>
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
          <h2 className="text-4xl">{t(locale, "home.helpersTitle")}</h2>
          <Link href="/maids" className="text-sm underline">
            {t(locale, "home.fullGallery")}
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
                {helper.fictional ? <p className="mt-3 text-xs uppercase tracking-wide text-[var(--brass-ink)]">{t(locale, "home.fictional")}</p> : null}
              </div>
            </Link>
          ))}
          {helpers.length === 0 ? <p>{t(locale, "home.empty")}</p> : null}
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
      {jsonLd ? (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </div>
  );
}
