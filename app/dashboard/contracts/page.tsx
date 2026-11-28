import Link from "next/link";
import { JsonForm } from "@/components/json-form";
import { formatSgd } from "@/lib/billing/money";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ employer?: string }>;
}) {
  const { employer } = await searchParams;
  const employerId = employer && employer.length <= 40 ? employer : undefined;
  const [contracts, employers] = await Promise.all([
    prisma.serviceContract.findMany({
      where: employerId ? { employerId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { employer: { select: { fullName: true } }, _count: { select: { invoices: true } } },
    }),
    prisma.employer.findMany({ orderBy: { fullName: "asc" }, take: 200, select: { id: true, fullName: true } }),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Contracts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          Staff record of an agreed fee, invoices, and payments received. Amounts are Singapore dollars. This page does not take a card payment.
        </p>
      </div>
      <section className="card p-5">
        <h2 className="text-2xl">New contract</h2>
        <JsonForm action="/api/staff/contracts" submitLabel="Save contract">
          <label className="label">
            Employer
            <select className="select" name="employerId" required defaultValue={employerId ?? ""}>
              <option value="" disabled>
                Choose an employer
              </option>
              {employers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Title
            <input className="field" name="title" required minLength={2} maxLength={120} />
          </label>
          <label className="label">
            Fee (SGD)
            <input className="field" name="amount" required inputMode="decimal" placeholder="1500.00" />
          </label>
          <label className="label">
            Starts
            <input className="field" name="startsOn" type="date" required />
          </label>
          <label className="label">
            Ends
            <input className="field" name="endsOn" type="date" />
          </label>
          <label className="label">
            Notes
            <textarea className="area" name="notes" maxLength={2000} />
          </label>
        </JsonForm>
      </section>
      <ul className="grid gap-3">
        {contracts.map((contract) => (
          <li key={contract.id} className="card p-4">
            <Link className="text-2xl underline" href={`/dashboard/contracts/${contract.id}`}>
              {contract.title}
            </Link>
            <p className="mt-1 text-sm">
              {contract.reference} · {contract.employer.fullName} · {contract.status} · {formatSgd(contract.feeCents)} ·{" "}
              {contract._count.invoices} invoices
            </p>
          </li>
        ))}
        {contracts.length === 0 ? <li>No contracts on file.</li> : null}
      </ul>
    </div>
  );
}
