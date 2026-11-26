import type { Metadata } from "next";
import { JsonForm } from "@/components/json-form";

export const metadata: Metadata = { title: "Share a few words", robots: { index: false, follow: false } };

export default async function ShareTestimonialPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-4xl">A short note about the placement</h1>
      <p className="mt-3 text-sm leading-6">
        Staff read this before it can appear on the site. Do not include passport numbers, addresses, or medical details.
      </p>
      <div className="card mt-6 p-6">
        <JsonForm action="/api/testimonials" submitLabel="Send to staff" refresh={false} success="Received. It stays private until staff approve it.">
          <input type="hidden" name="token" value={token} />
          <label className="label">
            Your name
            <input className="field" name="authorName" required minLength={2} />
          </label>
          <label className="label">
            Quote
            <textarea className="area" name="quote" required minLength={10} maxLength={600} />
          </label>
        </JsonForm>
      </div>
    </div>
  );
}
