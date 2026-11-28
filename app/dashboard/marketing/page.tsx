import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const [drafts, candidates] = await Promise.all([
    prisma.marketingDraft.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { candidate: true } }),
    prisma.candidate.findMany({
      where: { status: "AVAILABLE", photoConsent: true, marketingConsent: true, redactedAt: null },
      select: { id: true, fullName: true },
      take: 40,
    }),
  ]);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Marketing drafts</h1>
        <p className="mt-2 max-w-2xl text-sm">
          The assistant writes a draft from public facts. Staff approve or reject it here. Approval never posts to a social network.
        </p>
      </div>
      <section className="card p-5">
        <JsonForm action="/api/staff/marketing" submitLabel="Draft for review">
          <label className="label">
            Kind
            <select className="select" name="kind" defaultValue="SOCIAL_POST">
              <option value="SOCIAL_POST">Social post</option>
              <option value="AD_COPY">Ad copy</option>
              <option value="PROFILE_BLURB">Profile blurb</option>
              <option value="CAMPAIGN_COPY">Campaign copy</option>
              <option value="BLOG_ARTICLE">Blog article</option>
              <option value="NEWSLETTER">Newsletter</option>
              <option value="HEADLINE">A/B headlines</option>
              <option value="SEO_PAGE">SEO page</option>
            </select>
          </label>
          <label className="label">
            Language
            <select className="select" name="language" defaultValue="en">
              <option value="en">English</option>
              <option value="zh">Chinese</option>
              <option value="ms">Malay</option>
              <option value="ta">Tamil</option>
              <option value="tl">Tagalog</option>
              <option value="id">Bahasa Indonesia</option>
              <option value="my">Burmese</option>
            </select>
          </label>
          <label className="label">
            Channel
            <select className="select" name="channel" defaultValue="facebook">
              <option>facebook</option>
              <option>instagram</option>
              <option>tiktok</option>
              <option>whatsapp</option>
              <option>google_business</option>
              <option>email</option>
              <option>blog</option>
              <option>seo</option>
            </select>
          </label>
          <label className="label">
            Helper, for a blurb
            <select className="select" name="candidateId" defaultValue="">
              <option value="">None</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Notes for the draft
            <textarea className="area" name="notes" placeholder="Weekend availability, infant care" />
          </label>
        </JsonForm>
      </section>
      {drafts.map((draft) => (
        <article key={draft.id} className="card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--brass)]">
            {draft.kind} · {draft.status} · {draft.source}
          </p>
          <h2 className="text-2xl">{draft.title}</h2>
          {draft.candidate ? <p className="text-sm">{draft.candidate.fullName}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{draft.body}</p>
          {draft.cautions ? <p className="mt-2 text-sm text-[var(--brass)]">{draft.cautions}</p> : null}
          {draft.status === "DRAFT" ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <JsonForm action={`/api/staff/marketing/${draft.id}`} submitLabel="Approve">
                <input type="hidden" name="decision" value="APPROVED" />
              </JsonForm>
              <JsonForm action={`/api/staff/marketing/${draft.id}`} submitLabel="Reject">
                <input type="hidden" name="decision" value="REJECTED" />
              </JsonForm>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
