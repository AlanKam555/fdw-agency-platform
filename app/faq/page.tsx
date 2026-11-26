import type { Metadata } from "next";
import { faqs } from "@/content/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about Harbourlight matching, privacy, and MOM work permit preparation.",
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-5xl">Questions families ask</h1>
      <div className="mt-8 grid gap-4">
        {faqs.map((faq) => (
          <article key={faq.question} className="card p-6">
            <h2 className="text-2xl">{faq.question}</h2>
            <p className="mt-2 leading-7">{faq.answer}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
