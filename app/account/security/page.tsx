import { JsonForm } from "@/components/json-form";
import { MfaSetup } from "@/components/mfa-setup";
import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";
import { mfaGraceOpen, mfaSetupBlocks } from "@/lib/security/totp";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const { user } = await requireUser(undefined, { allowMfaSetup: true });
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabledAt: true, totpSetupDueAt: true, role: true },
  });
  const staff = row?.role === "ADMIN" || row?.role === "STAFF";
  const graceOpen = row ? mfaGraceOpen(row) : false;
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <h1 className="text-4xl">Account security</h1>
      {graceOpen && row?.totpSetupDueAt ? (
        <p className="card p-4 text-sm">
          Set up an authenticator before {row.totpSetupDueAt.toISOString().slice(0, 16)} UTC. Until then you can keep using the desk.
        </p>
      ) : null}
      {row && mfaSetupBlocks(row) ? (
        <p className="card p-4 text-sm">Two-factor setup is required before other pages will open.</p>
      ) : null}
      <MfaSetup enabled={Boolean(row?.totpEnabledAt)} staff={staff} />
      <section className="card max-w-lg p-5">
        <h2 className="text-2xl">Change password</h2>
        <p className="mt-2 text-sm">This signs you out on every device.</p>
        <div className="mt-3">
          <JsonForm action="/api/auth/password" submitLabel="Change password" refresh={false}>
            <label className="label">
              Current password
              <input className="field" name="currentPassword" type="password" autoComplete="current-password" required />
            </label>
            <label className="label">
              New password
              <input className="field" name="nextPassword" type="password" autoComplete="new-password" required minLength={10} />
            </label>
          </JsonForm>
        </div>
      </section>
    </div>
  );
}
