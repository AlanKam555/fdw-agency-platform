import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENCY, carePages } from "@/content/site";

export function generateStaticParams() {
  return carePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = carePages.find((item) => item.slug === slug);
  return { title: page?.title ?? "Care", description: page?.body };
}

export default async function CarePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = carePages.find((item) => item.slug === slug);
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-[var(--brass-ink)]">{AGENCY.licence}</p>
      <h1 className="mt-2 text-5xl">{page.title}</h1>
      <p className="mt-4 text-lg leading-8">{page.body}</p>
      <p className="mt-6 text-sm leading-6">{AGENCY.disclaimer}</p>
      <p className="mt-6">
        <Link className="underline" href="/employers/enquire">
          Describe this need in a brief
        </Link>
      </p>
    </article>
  );
}
