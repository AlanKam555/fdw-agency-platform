import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENCY, services } from "@/content/site";

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  return { title: service?.title ?? "Service", description: service?.body };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-[var(--brass-ink)]">{AGENCY.licence}</p>
      <h1 className="mt-2 text-5xl">{service.title}</h1>
      <p className="mt-4 text-lg leading-8">{service.body}</p>
      <p className="mt-6 text-sm leading-6">{AGENCY.disclaimer}</p>
      <p className="mt-6">
        <Link className="underline" href="/employers/enquire">
          Send a household brief
        </Link>
      </p>
    </article>
  );
}
