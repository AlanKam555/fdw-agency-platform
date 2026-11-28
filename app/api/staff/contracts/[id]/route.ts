import { NextRequest } from "next/server";
import { updateContract } from "@/lib/billing/contracts";
import { contractUpdateSchema } from "@/lib/billing/schemas";
import { formatSgd } from "@/lib/billing/money";
import { prisma } from "@/lib/db";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(req, {}, { permission: "billing:manage", csrf: false });
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const contract = await prisma.serviceContract.findUnique({
    where: { id },
    include: {
      employer: { select: { id: true, fullName: true } },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: { payments: { orderBy: { paidOn: "desc" }, select: { id: true, amountCents: true, paidOn: true, method: true, reference: true } } },
      },
    },
  });
  if (!contract) return json({ error: "Contract not found." }, 404);
  return json({
    contract: {
      id: contract.id,
      reference: contract.reference,
      title: contract.title,
      status: contract.status,
      feeCents: contract.feeCents,
      fee: formatSgd(contract.feeCents),
      currency: contract.currency,
      startsOn: contract.startsOn.toISOString(),
      endsOn: contract.endsOn?.toISOString() ?? null,
      notes: contract.notes,
      employerId: contract.employer.id,
      employerName: contract.employer.fullName,
      invoices: contract.invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountCents: invoice.amountCents,
        amount: formatSgd(invoice.amountCents),
        issuedOn: invoice.issuedOn?.toISOString() ?? null,
        dueOn: invoice.dueOn?.toISOString() ?? null,
        payments: invoice.payments.map((payment) => ({
          id: payment.id,
          amountCents: payment.amountCents,
          amount: formatSgd(payment.amountCents),
          paidOn: payment.paidOn.toISOString(),
          method: payment.method,
          reference: payment.reference,
        })),
      })),
    },
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "billing:manage" });
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const parsed = parseBody(contractUpdateSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await updateContract({
    id,
    title: parsed.data.title,
    feeCents: parsed.data.amount,
    status: parsed.data.status,
    endsOn: parsed.data.endsOn,
    notes: parsed.data.notes,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, note: "Contract updated." });
}
