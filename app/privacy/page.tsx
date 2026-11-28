import type { Metadata } from "next";
import { PRIVACY_POLICY, retentionSummary } from "@/lib/privacy/policy";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-5xl">Privacy notice</h1>
      <p className="mt-3 text-sm text-[var(--brass-ink)]">Version {PRIVACY_POLICY.version}</p>
      <p className="mt-4 leading-7">
        {PRIVACY_POLICY.controller} handles personal data for the purposes below. This notice is an operational summary for the product, not legal advice under the Personal Data Protection Act 2012.
      </p>
      <h2 className="mt-8 text-3xl">Why we collect it</h2>
      <ul className="mt-3 list-disc pl-5 leading-7">
        {PRIVACY_POLICY.purposes.map((purpose) => (
          <li key={purpose}>{purpose}</li>
        ))}
      </ul>
      <h2 className="mt-8 text-3xl">What we do not ask</h2>
      <p className="mt-3 leading-7">
        Application and employer forms do not ask for {PRIVACY_POLICY.notCollected.join(", ").toLowerCase()}. Those traits are not stored and cannot be used in matching.
      </p>
      <h2 className="mt-8 text-3xl">Consent, access, and deletion</h2>
      <p className="mt-3 leading-7">
        Withdrawal of photo or marketing consent removes the portrait and the public blurb. You can download a copy of your data from the privacy page after signing in again with your password. An administrator can redact a helper or household file: documents are deleted or queued for deletion, identifiers are wiped, and the account is disabled. Match scores and placement category codes can remain for a fairness audit.
      </p>
      <h2 className="mt-8 text-3xl">How long we keep it</h2>
      <p className="mt-3 leading-7">
        {retentionSummary()} A scheduled job can apply these windows. It reports counts only until the agency turns enforcement on.
      </p>
      <h2 className="mt-8 text-3xl">Protection</h2>
      <p className="mt-3 leading-7">
        Passport numbers, FIN, NRIC, and medical notes are encrypted with AES-256-GCM before they are written. Documents sit in private storage and are downloaded with a short-lived signed link or a staff session. Staff reveals of those fields are audited.
      </p>
    </div>
  );
}
