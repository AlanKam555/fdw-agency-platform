import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/current";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";

export const dynamic = "force-dynamic";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser(["CANDIDATE"]);
  const locale = await getLocale();
  return (
    <Shell
      role={user.role}
      name={user.name}
      items={[
        ["/candidate", t(locale, "candidate.nav")],
        ["/apply", t(locale, "candidate.update")],
      ]}
    >
      {children}
    </Shell>
  );
}
