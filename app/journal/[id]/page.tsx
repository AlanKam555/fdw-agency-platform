import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AGENCY } from "@/content/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await prisma.marketingDraft.findFirst({
    where: { id, kind: "BLOG_ARTICLE", status: "APPROVED" },
  });
  return { title: article?.title ?? "Journal" };
}

export default async function JournalArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await prisma.marketingDraft.findFirst({
    where: { id, kind: "BLOG_ARTICLE", status: "APPROVED" },
  });
  if (!article) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-[var(--brass-ink)]">{AGENCY.licence}</p>
      <h1 className="mt-2 text-5xl">{article.title}</h1>
      <p className="mt-6 whitespace-pre-wrap leading-8">{article.body}</p>
    </article>
  );
}
