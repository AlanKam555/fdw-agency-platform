import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaigns, links, quotes] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { startsOn: "desc" }, include: { slots: true }, take: 30 }),
    prisma.utmLink.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.testimonialRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Campaigns</h1>
        <p className="mt-2 max-w-2xl text-sm">
          Plan a channel and dates. Drafts stay in the marketing queue. This desk copies text. It does not publish it.
        </p>
      </div>
      <section className="card p-5">
        <JsonForm action="/api/staff/campaigns" submitLabel="Add campaign">
          <label className="label">
            Title
            <input className="field" name="title" required minLength={2} />
          </label>
          <label className="label">
            Channel
            <select className="select" name="channel" defaultValue="facebook">
              {["facebook", "instagram", "tiktok", "whatsapp", "google_business", "email"].map((channel) => (
                <option key={channel}>{channel}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Starts
            <input className="field" type="date" name="startsOn" required />
          </label>
          <label className="label">
            Ends
            <input className="field" type="date" name="endsOn" required />
          </label>
          <label className="label">
            Objective
            <input className="field" name="objective" />
          </label>
        </JsonForm>
      </section>
      {campaigns.map((campaign) => (
        <article key={campaign.id} className="card p-4 text-sm">
          <h2 className="text-2xl">{campaign.title}</h2>
          <p>
            {campaign.startsOn.toISOString().slice(0, 10)} to {campaign.endsOn.toISOString().slice(0, 10)} ·{" "}
            {campaign.slots.map((slot) => slot.channel).join(", ") || "no channel"}
          </p>
          {campaign.objective ? <p>{campaign.objective}</p> : null}
        </article>
      ))}
      <section className="card p-5">
        <h2 className="text-2xl">UTM link</h2>
        <JsonForm action="/api/staff/utm" submitLabel="Build link">
          <label className="label">
            Path
            <input className="field" name="path" defaultValue="/contact" required />
          </label>
          <label className="label">
            Source
            <input className="field" name="source" required />
          </label>
          <label className="label">
            Medium
            <input className="field" name="medium" required />
          </label>
          <label className="label">
            Campaign
            <input className="field" name="campaign" required />
          </label>
        </JsonForm>
        <ul className="mt-4 grid gap-1 text-sm">
          {links.map((link) => (
            <li key={link.id}>
              {link.destinationPath}?utm_source={link.source}&utm_medium={link.medium}&utm_campaign={link.campaign}
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">Testimonial requests</h2>
        <JsonForm action="/api/staff/testimonials" submitLabel="Create a private link">
          <label className="label">
            Employer email
            <input className="field" type="email" name="employerEmail" required />
          </label>
        </JsonForm>
        {quotes.map((quote) => (
          <article key={quote.id} className="mt-4 border-t border-[var(--line)] pt-3 text-sm">
            <p>
              {quote.name} · {quote.status}
            </p>
            {quote.submittedText ? <p className="mt-1">{quote.submittedText}</p> : null}
            {quote.status === "SUBMITTED" ? (
              <div className="mt-2 flex gap-3">
                <JsonForm action="/api/staff/testimonials" submitLabel="Approve">
                  <input type="hidden" name="id" value={quote.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                </JsonForm>
                <JsonForm action="/api/staff/testimonials" submitLabel="Decline">
                  <input type="hidden" name="id" value={quote.id} />
                  <input type="hidden" name="decision" value="DECLINED" />
                </JsonForm>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
