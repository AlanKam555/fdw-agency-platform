import Link from "next/link";
import type { Role } from "@/lib/security/rbac";
import { LogoutButton } from "@/components/json-form";

const STAFF = [
  ["/dashboard", "Overview"],
  ["/dashboard/candidates", "Helpers"],
  ["/dashboard/candidates/new", "Intake"],
  ["/dashboard/employers", "Employers"],
  ["/dashboard/enquiries", "Enquiries"],
  ["/dashboard/matching", "Matching"],
  ["/dashboard/outcomes", "Outcomes"],
  ["/dashboard/interviews", "Interviews"],
  ["/dashboard/mom", "MOM packs"],
  ["/dashboard/mom-rules", "MOM rules"],
  ["/dashboard/holidays", "Holidays"],
  ["/dashboard/reminders", "Reminders"],
  ["/dashboard/marketing", "Marketing drafts"],
  ["/dashboard/campaigns", "Campaigns"],
  ["/dashboard/funnel", "Funnel"],
  ["/dashboard/photos", "Photo review"],
  ["/dashboard/audit", "Audit log"],
];

export function Shell({
  role,
  name,
  children,
}: {
  role: Role;
  name: string;
  children: React.ReactNode;
}) {
  const links =
    role === "EMPLOYER"
      ? [
          ["/employer", "Home"],
          ["/employer/requirements", "Requirements"],
          ["/employer/maids", "Helpers"],
          ["/employer/shortlist", "Shortlist"],
          ["/employer/interviews", "Interviews"],
        ]
      : role === "CANDIDATE"
        ? [
            ["/candidate", "Your application"],
            ["/apply", "Update details"],
          ]
        : role === "ADMIN"
          ? [...STAFF, ["/dashboard/users", "Users"], ["/dashboard/settings", "Settings"]]
          : STAFF;

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
      <aside className="card h-fit p-4">
        <p className="text-xs tracking-[0.14em] text-[var(--brass)] uppercase">{role.toLowerCase()}</p>
        <p className="display mt-1 text-2xl">{name}</p>
        <nav className="mt-4 grid gap-2 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-2 py-1 hover:bg-[#efe4d4]">
              {label}
            </Link>
          ))}
          <Link href="/account/security" className="rounded-lg px-2 py-1 hover:bg-[#efe4d4]">
            Security
          </Link>
          <LogoutButton />
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
