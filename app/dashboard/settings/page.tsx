import { providerDirectory } from "@/lib/ai/client";
import { JsonForm } from "@/components/json-form";
import { requireUser } from "@/lib/auth/current";
import { brand } from "@/config/brand";
import { retentionMode } from "@/lib/privacy/retention";
import { activeRateLimitDriver } from "@/lib/security/rate-limit";
import { agencyProfile } from "@/lib/services/agency";
import { momRules } from "@/config/mom-rules";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser(["ADMIN"]);
  const profile = await agencyProfile();
  const providers = providerDirectory();
  const retention = retentionMode();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Agency settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          {brand.name} is read from the server environment. This page shows which AI providers have a key configured. It never shows the key.
        </p>
      </div>
      <section className="card p-5 text-sm leading-6">
        <p>Name: {brand.name}</p>
        <p>Licence on file: {profile.eaLicenceNo}</p>
        <p>Personnel: {profile.personnel.map((person) => `${person.name} ${person.registrationNo}`).join("; ")}</p>
        <p>Locales: {brand.locales.join(", ")}</p>
        <p>Rate limiter: {activeRateLimitDriver()}</p>
        <p>
          Retention job: {retention.enforce ? "enforcing" : "dry run"}
          {retention.purgeAudit ? ", including aged audit rows" : ""}.
        </p>
        <p>
          MOM minimum helper age {momRules.fdw.minAgeYears}, security bond SGD {momRules.securityBond.amountSgd}.{" "}
          {momRules.meta.verificationStatus}.
        </p>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">Providers</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Provider</th>
              <th>Configured</th>
              <th>Model</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider: { id: string; configured: boolean; model: string }) => (
              <tr key={provider.id}>
                <td>{provider.id}</td>
                <td>{provider.configured ? "yes" : "no"}</td>
                <td>{provider.model}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">Brand voice</h2>
        <JsonForm action="/api/staff/settings" submitLabel="Save voice">
          <label className="label">
            EA licence number
            <input className="field" name="eaLicenceNo" defaultValue={profile.eaLicenceNo} required />
          </label>
          <label className="label">
            Voice
            <textarea className="area" name="brandVoice" defaultValue={profile.brandVoice} required />
          </label>
          <label className="label">
            Notes staff should remember
            <textarea className="area" name="voiceNotes" defaultValue={profile.voiceNotes} />
          </label>
        </JsonForm>
      </section>
    </div>
  );
}
