import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { formatSgd } from "@/lib/billing/money";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await prisma.serviceContract.findUnique({
    where: { id },
    include: {
      employer: { select: { id: true, fullName: true } },
      invoices: { orderBy: { createdAt: "desc" }, include: { payments: { orderBy: { paidOn: "desc" } } } },
    },
  });
  if (!contract) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm">
          <Link className="underline" href="/dashboard/contracts">
            Contracts
          </Link>
        </p>
        <h1 className="mt-2 text-4xl">{contract.title}</h1>
        <p className="mt-2 text-sm">
          {contract.reference} · {contract.status} · {formatSgd(contract.feeCents)} ·{" "}
          <Link className="underline" href={`/dashboard/employers/${contract.employer.id}`}>
            {contract.employer.fullName}
          </Link>
        </p>
        {contract.notes ? <p className="mt-2 max-w-2xl text-sm">{contract.notes}</p> : null}
      </div>

      <section className="card p-5">
        <h2 className="text-2xl">Update</h2>
        <JsonForm action={`/api/staff/contracts/${contract.id}`} submitLabel="Save changes">
          <label className="label">
            Title
            <input className="field" name="title" defaultValue={contract.title} />
          </label>
          <label className="label">
            Fee (SGD)
            <input className="field" name="amount" defaultValue={(contract.feeCents / 100).toFixed(2)} />
          </label>
          <label className="label">
            Status
            <select className="select" name="status" defaultValue={contract.status}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </JsonForm>
      </section>

      <section className="card p-5">
        <h2 className="text-2xl">New invoice</h2>
        <JsonForm action={`/api/staff/contracts/${contract.id}/invoices`} submitLabel="Save invoice">
          <label className="label">
            Amount (SGD)
            <input className="field" name="amount" required inputMode="decimal" placeholder="500.00" />
          </label>
          <label className="label">
            Issued
            <input className="field" name="issuedOn" type="date" />
          </label>
          <label className="label">
            Due
            <input className="field" name="dueOn" type="date" />
          </label>
          <label className="label">
            Notes
            <textarea className="area" name="notes" maxLength={2000} />
          </label>
        </JsonForm>
      </section>

      {contract.invoices.map((invoice) => {
        const paid = invoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
        return (
          <section key={invoice.id} className="card p-5">
            <h2 className="text-2xl">{invoice.number}</h2>
            <p className="mt-1 text-sm">
              {invoice.status} · {formatSgd(invoice.amountCents)} · received {formatSgd(paid)}
            </p>
            <ul className="mt-3 grid gap-1 text-sm">
              {invoice.payments.map((payment) => (
                <li key={payment.id}>
                  {formatSgd(payment.amountCents)} · {payment.method} · {payment.paidOn.toISOString().slice(0, 10)}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </li>
              ))}
            </ul>
            {invoice.payments.length === 0 ? (
              <JsonForm action={`/api/staff/invoices/${invoice.id}`} submitLabel="Update status">
                <label className="label">
                  Status
                  <select className="select" name="status" defaultValue={invoice.status === "PAID" ? "ISSUED" : invoice.status}>
                    <option value="DRAFT">Draft</option>
                    <option value="ISSUED">Issued</option>
                    <option value="VOID">Void</option>
                  </select>
                </label>
              </JsonForm>
            ) : null}
            {invoice.status === "ISSUED" ? (
              <JsonForm action={`/api/staff/invoices/${invoice.id}/payments`} submitLabel="Record payment">
                <label className="label">
                  Amount (SGD)
                  <input className="field" name="amount" required inputMode="decimal" />
                </label>
                <label className="label">
                  Paid on
                  <input className="field" name="paidOn" type="date" required />
                </label>
                <label className="label">
                  Method
                  <select className="select" name="method" defaultValue="PAYNOW">
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="PAYNOW">PayNow</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="label">
                  Transfer reference
                  <input className="field" name="reference" maxLength={80} />
                </label>
              </JsonForm>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
