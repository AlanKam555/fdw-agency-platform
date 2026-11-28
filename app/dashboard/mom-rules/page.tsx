import Link from "next/link";
import { JsonForm } from "@/components/json-form";
import { requireUser } from "@/lib/auth/current";
import { momRuleRows } from "@/lib/mom/review";
import { staleAfterDays } from "@/lib/mom/rule-catalog";

export const dynamic = "force-dynamic";

export default async function MomRulesPage() {
  const { user } = await requireUser(["ADMIN", "STAFF"]);
  const rows = await momRuleRows();
  const staleDays = staleAfterDays();
  const admin = user.role === "ADMIN";
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">MOM rules</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          These are the values already in the catalog. They are not new figures. A row stays on “Needs verification” until an admin marks it re-verified. A value older than the {staleDays}-day window is marked stale. Public holiday dates are changed on the{" "}
          <Link className="underline" href="/dashboard/holidays">
            holiday page
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-4">
        {rows.map((row) => (
          <article key={row.key} className="card p-4 text-sm leading-6">
            <h2 className="text-2xl">{row.name}</h2>
            <p>
              Value {row.value} {row.unit}
              {row.override ? ` · catalog ${row.catalogValue}` : ""}
            </p>
            <p>
              Last verified {row.lastVerified}
              {row.verifiedBy ? ` by ${row.verifiedBy}` : ""}
            </p>
            <p>
              <a className="underline" href={row.sourceUrl}>
                Official MOM source
              </a>
            </p>
            {row.needsVerification ? <p>Needs verification</p> : <p>Re-verified by staff</p>}
            {row.stale ? <p>Stale: older than {staleDays} days.</p> : null}
            {row.overrideNote ? <p>Override note: {row.overrideNote}</p> : null}
            {admin && row.kind !== "dates" ? (
              <div className="mt-3 grid gap-4">
                <JsonForm action="/api/staff/mom-rules" submitLabel="Mark re-verified">
                  <input type="hidden" name="action" value="verify" />
                  <input type="hidden" name="key" value={row.key} />
                </JsonForm>
                <JsonForm action="/api/staff/mom-rules" submitLabel="Save override">
                  <input type="hidden" name="action" value="override" />
                  <input type="hidden" name="key" value={row.key} />
                  <label className="label">
                    Override value
                    <input className="field" name="value" required />
                  </label>
                  <label className="label">
                    Source URL
                    <input className="field" name="sourceUrl" type="url" required />
                  </label>
                  <label className="label">
                    Note
                    <input className="field" name="note" required />
                  </label>
                </JsonForm>
              </div>
            ) : null}
            {admin && row.override ? (
              <JsonForm action="/api/staff/mom-rules" submitLabel="Clear override">
                <input type="hidden" name="action" value="clear" />
                <input type="hidden" name="key" value={row.key} />
              </JsonForm>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
