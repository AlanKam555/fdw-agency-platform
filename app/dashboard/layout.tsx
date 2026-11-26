import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/current";
import { mfaGraceOpen } from "@/lib/security/totp";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser(["ADMIN", "STAFF"]);
  const grace = mfaGraceOpen(user);
  return (
    <Shell role={user.role} name={user.name}>
      {grace ? (
        <p className="card mb-4 p-4 text-sm">
          Add an authenticator on the Security page before {user.totpSetupDueAt?.toISOString().slice(0, 16)} UTC.
        </p>
      ) : null}
      {children}
    </Shell>
  );
}
