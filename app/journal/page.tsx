import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AGENCY } from "@/content/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage() {
  const articles = await prisma.marketingDraft.findMany({
    where: { kind: "BLOG_ARTICLE", status: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    take: 20,
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-5xl">Journal</h1>
      <p className="mt-3 text-[var(--ink)]/80">
        Only articles a person at {AGENCY.name} approved are listed. Nothing here is posted to another site.
      </p>
      <div className="mt-8 grid gap-4">
        {articles.map((article) => (
          <article key={article.id} className="card p-5">
            <h2 className="text-3xl">
              <Link className="underline" href={`/journal/${article.id}`}>
                {article.title}
              </Link>
            </h2>
          </article>
        ))}
        {articles.length === 0 ? <p>No approved articles yet.</p> : null}
      </div>
    </div>
  );
}
