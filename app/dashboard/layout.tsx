import Link from "next/link";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/current";
import { staleMomRuleCount } from "@/lib/mom/review";
import { staleAfterDays } from "@/lib/mom/rule-catalog";
import { mfaGraceOpen } from "@/lib/security/totp";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser(["ADMIN", "STAFF"]);
  const grace = mfaGraceOpen(user);
  const stale = await staleMomRuleCount();
  const staleDays = staleAfterDays();
  return (
    <Shell role={user.role} name={user.name}>
      {grace ? (
        <p className="card mb-4 p-4 text-sm">
          Add an authenticator on the Security page before {user.totpSetupDueAt?.toISOString().slice(0, 16)} UTC.
        </p>
      ) : null}
      {stale > 0 ? (
        <p className="card mb-4 p-4 text-sm">
          {stale} MOM rule {stale === 1 ? "value is" : "values are"} older than the {staleDays}-day window.{" "}
          <Link className="underline" href="/dashboard/mom-rules">
            Review MOM rules
          </Link>
        </p>
      ) : null}
      {children}
    </Shell>
  );
}
