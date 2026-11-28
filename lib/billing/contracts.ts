import { randomBytes } from "node:crypto";
import type { ContractStatus, InvoiceStatus, RecordedPaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const reference = (prefix: string) => `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;

type Actor = { actorId: string; ip?: string | null };

export async function createContract(input: {
  employerId: string;
  title: string;
  feeCents: number;
  startsOn: Date;
  endsOn?: Date;
  notes: string;
} & Actor) {
  const employer = await prisma.employer.findUnique({
    where: { id: input.employerId },
    select: { id: true },
  });
  if (!employer) return { ok: false as const, status: 404, error: "Employer not found." };
  const row = await prisma.serviceContract.create({
    data: {
      employerId: employer.id,
      reference: reference("SC"),
      title: input.title,
      feeCents: input.feeCents,
      currency: "SGD",
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      notes: input.notes,
      createdById: input.actorId,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "billing.contract_created",
    entityType: "ServiceContract",
    entityId: row.id,
    metadata: { employerId: employer.id, feeCents: row.feeCents, reference: row.reference },
    ip: input.ip,
  });
  return { ok: true as const, contract: row };
}

export async function updateContract(input: {
  id: string;
  title?: string;
  feeCents?: number;
  status?: ContractStatus;
  endsOn?: Date;
  notes?: string;
} & Actor) {
  const row = await prisma.serviceContract.findUnique({
    where: { id: input.id },
    include: { invoices: { select: { amountCents: true, status: true } } },
  });
  if (!row) return { ok: false as const, status: 404, error: "Contract not found." };
  if (input.feeCents != null) {
    const billed = row.invoices.filter((invoice) => invoice.status !== "VOID").reduce((sum, invoice) => sum + invoice.amountCents, 0);
    if (input.feeCents < billed) {
      return { ok: false as const, status: 400, error: "The fee cannot be lower than invoices already on the contract." };
    }
  }
  const updated = await prisma.serviceContract.update({
    where: { id: row.id },
    data: {
      title: input.title,
      feeCents: input.feeCents,
      status: input.status,
      endsOn: input.endsOn,
      notes: input.notes,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "billing.contract_updated",
    entityType: "ServiceContract",
    entityId: row.id,
    metadata: {
      status: updated.status,
      feeCents: updated.feeCents,
    },
    ip: input.ip,
  });
  return { ok: true as const, contract: updated };
}

export async function createInvoice(input: {
  contractId: string;
  amountCents: number;
  issuedOn?: Date;
  dueOn?: Date;
  notes: string;
} & Actor) {
  const contract = await prisma.serviceContract.findUnique({
    where: { id: input.contractId },
    include: { invoices: { select: { amountCents: true, status: true } } },
  });
  if (!contract) return { ok: false as const, status: 404, error: "Contract not found." };
  const billed = contract.invoices.filter((invoice) => invoice.status !== "VOID").reduce((sum, invoice) => sum + invoice.amountCents, 0);
  if (billed + input.amountCents > contract.feeCents) {
    return { ok: false as const, status: 400, error: "Invoices would exceed the contract fee. Raise the fee first." };
  }
  const row = await prisma.invoice.create({
    data: {
      contractId: contract.id,
      number: reference("INV"),
      amountCents: input.amountCents,
      currency: "SGD",
      issuedOn: input.issuedOn,
      dueOn: input.dueOn,
      notes: input.notes,
      createdById: input.actorId,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "billing.invoice_created",
    entityType: "Invoice",
    entityId: row.id,
    metadata: { contractId: contract.id, amountCents: row.amountCents, number: row.number },
    ip: input.ip,
  });
  return { ok: true as const, invoice: row };
}

export async function updateInvoiceStatus(input: { id: string; status: "DRAFT" | "ISSUED" | "VOID" } & Actor) {
  const row = await prisma.invoice.findUnique({
    where: { id: input.id },
    include: { payments: { select: { id: true } } },
  });
  if (!row) return { ok: false as const, status: 404, error: "Invoice not found." };
  if (row.payments.length > 0) {
    return { ok: false as const, status: 400, error: "This invoice has payments. Leave it on file." };
  }
  if (row.status === "PAID") {
    return { ok: false as const, status: 400, error: "A paid invoice stays on file." };
  }
  const updated = await prisma.invoice.update({
    where: { id: row.id },
    data: { status: input.status },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "billing.invoice_updated",
    entityType: "Invoice",
    entityId: row.id,
    metadata: { status: updated.status, amountCents: updated.amountCents },
    ip: input.ip,
  });
  return { ok: true as const, invoice: updated };
}

export async function recordPayment(input: {
  invoiceId: string;
  amountCents: number;
  paidOn: Date;
  method: RecordedPaymentMethod;
  reference: string;
  notes: string;
} & Actor) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { payments: { select: { amountCents: true } } },
  });
  if (!invoice) return { ok: false as const, status: 404, error: "Invoice not found." };
  if (invoice.status === "DRAFT" || invoice.status === "VOID") {
    return { ok: false as const, status: 400, error: "Issue the invoice before recording a payment." };
  }
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (paid + input.amountCents > invoice.amountCents) {
    return { ok: false as const, status: 400, error: "That payment would exceed the invoice amount." };
  }
  const nextStatus: InvoiceStatus = paid + input.amountCents === invoice.amountCents ? "PAID" : "ISSUED";
  const payment = await prisma.paymentRecord.create({
    data: {
      invoiceId: invoice.id,
      amountCents: input.amountCents,
      paidOn: input.paidOn,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      recordedById: input.actorId,
    },
  });
  if (nextStatus !== invoice.status) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: nextStatus } });
  }
  await writeAudit({
    actorId: input.actorId,
    action: "billing.payment_recorded",
    entityType: "PaymentRecord",
    entityId: payment.id,
    metadata: {
      invoiceId: invoice.id,
      amountCents: payment.amountCents,
      method: payment.method,
      invoiceStatus: nextStatus,
    },
    ip: input.ip,
  });
  return { ok: true as const, payment, invoiceStatus: nextStatus };
}
