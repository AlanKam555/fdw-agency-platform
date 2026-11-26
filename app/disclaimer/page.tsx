import type { Metadata } from "next";
import { AGENCY } from "@/content/site";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-5xl">Disclaimer</h1>
      <p className="mt-4 text-lg leading-8">{AGENCY.disclaimer}</p>
      <ul className="mt-6 grid gap-3 text-sm leading-6">
        <li>Rule numbers in the work-permit checklist are a starting transcription. An operator must check the Ministry of Manpower pages before relying on them.</li>
        <li>Personal data must be collected with consent, limited to the stated purpose, and deleted when the retention period ends. The Personal Data Protection Act applies to operators in Singapore.</li>
        <li>Employment agency advertising must show the EA licence number and the personnel registration numbers, and must not treat a helper as a product for sale.</li>
        <li>This software does not sign in to Singpass or CorpPass and does not submit a Work Permit application.</li>
        {AGENCY.fictionalDemo ? (
          <li>The name Harbourlight, licence 00C0000, the sample people, and the portraits are fictional. They are a demo, not a real agency.</li>
        ) : null}
      </ul>
    </article>
  );
}
