import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser(["ADMIN", "STAFF"]);
  return (
    <Shell role={user.role} name={user.name}>
      {children}
    </Shell>
  );
}
