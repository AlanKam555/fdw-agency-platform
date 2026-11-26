import Link from "next/link";
import { prisma } from "@/lib/db";
import { PIPELINE } from "@/lib/candidates/status";
import { STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [counts, enquiries, drafts] = await Promise.all([
    prisma.candidate.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.enquiry.count(),
    prisma.marketingDraft.count({ where: { status: "DRAFT" } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row._count._all]));
  return (
    <div>
      <h1 className="text-4xl">Staff desk</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6">
        AI drafts and match explanations wait here until a person approves them. Nothing on this desk is sent to MOM.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {PIPELINE.map((status) => (
          <Link key={status} href="/dashboard/candidates" className="card p-4">
            <p className="text-sm text-[var(--brass)]">{STATUS_LABELS[status]}</p>
            <p className="display text-3xl">{byStatus[status] ?? 0}</p>
          </Link>
        ))}
        <Link href="/dashboard/enquiries" className="card p-4">
          <p className="text-sm text-[var(--brass)]">Enquiries</p>
          <p className="display text-3xl">{enquiries}</p>
        </Link>
        <Link href="/dashboard/marketing" className="card p-4">
          <p className="text-sm text-[var(--brass)]">Drafts awaiting review</p>
          <p className="display text-3xl">{drafts}</p>
        </Link>
      </div>
    </div>
  );
}
