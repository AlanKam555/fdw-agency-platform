import type { Metadata } from "next";
import { testimonials } from "@/content/site";

export const metadata: Metadata = { title: "Stories" };

export default function TestimonialsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-5xl">Stories from households</h1>
      <p className="mt-3 text-[var(--ink)]/80">These quotations are fictional copy for the demonstration.</p>
      <div className="mt-8 grid gap-4">
        {testimonials.map((item) => (
          <blockquote key={item.name} className="card p-6">
            <p className="display text-2xl leading-snug">“{item.quote}”</p>
            <footer className="mt-3 text-sm">
              {item.name} · {item.area}
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
