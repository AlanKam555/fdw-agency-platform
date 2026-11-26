import type { Metadata } from "next";
import Link from "next/link";
import { AGENCY, carePages } from "@/content/site";

export const metadata: Metadata = {
  title: "Care needs",
  description: "Nationality-neutral pages about the work a household can ask for.",
};

export default function CareIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-5xl">The work, not a nationality</h1>
      <p className="mt-4 text-lg leading-8">
        These pages describe tasks. {AGENCY.name} does not publish landing pages aimed at a helper&apos;s nationality.
      </p>
      <div className="mt-8 grid gap-4">
        {carePages.map((page) => (
          <article key={page.slug} className="card p-6">
            <h2 className="text-3xl">
              <Link className="underline" href={`/care/${page.slug}`}>
                {page.title}
              </Link>
            </h2>
            <p className="mt-2 leading-7">{page.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
