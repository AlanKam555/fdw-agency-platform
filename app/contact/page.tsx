import type { Metadata } from "next";
import { JsonForm } from "@/components/json-form";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const pick = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value.slice(0, 80) : "";
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-5xl">Write to the desk</h1>
      <p className="mt-3 text-[var(--ink)]/80">We use this only to reply to your question.</p>
      <div className="card mt-6 p-6">
        <JsonForm action="/api/contact" submitLabel="Send message" refresh={false} success="Message received. Staff will see it in the enquiry list.">
          <label className="label">
            Name
            <input className="field" name="name" required minLength={2} />
          </label>
          <label className="label">
            Email
            <input className="field" name="email" type="email" required />
          </label>
          <label className="label">
            Phone
            <input className="field" name="phone" />
          </label>
          <input type="hidden" name="utmSource" value={pick("utm_source")} />
          <input type="hidden" name="utmMedium" value={pick("utm_medium")} />
          <input type="hidden" name="utmCampaign" value={pick("utm_campaign")} />
          <input type="hidden" name="utmContent" value={pick("utm_content")} />
          <input type="hidden" name="landingPath" value="/contact" />
          <label className="label">
            Message
            <textarea className="area" name="message" required minLength={10} />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="hidden" name="pdpaConsent" value="false" />
            <input type="checkbox" name="pdpaConsent" value="true" required />
            I agree to the privacy notice for the purpose of answering this enquiry.
          </label>
        </JsonForm>
      </div>
    </div>
  );
}
