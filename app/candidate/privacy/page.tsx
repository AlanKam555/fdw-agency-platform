import { JsonForm } from "@/components/json-form";
import { DownloadDataForm } from "@/components/privacy-forms";
import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CandidatePrivacyPage() {
  const { user } = await requireUser(["CANDIDATE"]);
  const candidate = await prisma.candidate.findUnique({ where: { userId: user.id } });
  if (!candidate || candidate.redactedAt) {
    return (
      <div>
        <h1 className="text-4xl">Your data</h1>
        <p className="mt-3">There is no application linked to this account yet.</p>
      </div>
    );
  }
  const history = await prisma.consentRecord.findMany({
    where: { candidateId: candidate.id },
    orderBy: { grantedAt: "desc" },
    take: 12,
  });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Your data</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6">
          Withdraw photo or marketing consent and the portrait leaves the public gallery. Withdraw AI processing and new embeddings of your experience text stop. Earlier copies at a provider are outside this app.
        </p>
      </div>
      <section className="card p-5">
        <h2 className="text-2xl">Consent</h2>
        <p className="mt-2 text-sm">
          Photo {candidate.photoConsent ? "on" : "off"}. Marketing {candidate.marketingConsent ? "on" : "off"}. AI processing{" "}
          {candidate.aiProcessingConsent ? "on" : "off"}.
        </p>
        <div className="mt-4 grid gap-4">
          {(
            [
              ["photo_publication", "Photo on the public gallery"],
              ["marketing_publication", "Marketing text"],
              ["ai_processing", "AI processing of experience text"],
            ] as const
          ).map(([purpose, label]) => (
            <JsonForm key={purpose} action="/api/privacy/consent" submitLabel={`Save ${label}`}>
              <input type="hidden" name="purpose" value={purpose} />
              <label className="label">
                {label}
                <select className="field" name="granted" defaultValue="false">
                  <option value="false">Withdraw</option>
                  <option value="true">Grant</option>
                </select>
              </label>
            </JsonForm>
          ))}
        </div>
        <ul className="mt-4 grid gap-1 text-sm">
          {history.map((row) => (
            <li key={row.id}>
              {row.purpose}: {row.granted ? "granted" : "withdrawn"} {row.grantedAt.toISOString().slice(0, 10)}
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">Download a copy</h2>
        <p className="mt-2 text-sm">Enter your password again. The file is limited to a few downloads an hour.</p>
        <div className="mt-4">
          <DownloadDataForm action="/api/privacy/export" />
        </div>
      </section>
    </div>
  );
}
