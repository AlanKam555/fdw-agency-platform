import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/content/site";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-5xl">What the agency actually does</h1>
      <p className="mt-4 text-lg text-[var(--ink)]/80">
        Placement is a staff job. The site collects a brief, keeps a consented gallery, and writes down the MOM steps so nothing important is left in a chat thread.
      </p>
      <div className="mt-8 grid gap-4">
        {services.map((service) => (
          <article key={service.title} className="card p-6">
            <h2 className="text-3xl">
              <Link className="underline" href={`/services/${service.slug}`}>{service.title}</Link>
            </h2>
            <p className="mt-2 leading-7">{service.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
