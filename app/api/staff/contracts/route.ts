import { NextRequest } from "next/server";
import { createContract } from "@/lib/billing/contracts";
import { contractCreateSchema } from "@/lib/billing/schemas";
import { prisma } from "@/lib/db";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { z } from "zod";

const listQuery = z.object({
  employerId: z.string().trim().min(1).max(40).optional(),
});

export async function GET(req: NextRequest) {
  const guard = await guardRequest(req, {}, { permission: "billing:manage", csrf: false });
  if (!guard.ok) return guard.response;
  const parsed = listQuery.safeParse({
    employerId: req.nextUrl.searchParams.get("employerId") ?? undefined,
  });
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const contracts = await prisma.serviceContract.findMany({
    where: parsed.data.employerId ? { employerId: parsed.data.employerId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      feeCents: true,
      currency: true,
      startsOn: true,
      employerId: true,
      employer: { select: { fullName: true } },
      _count: { select: { invoices: true } },
    },
  });
  return json({
    contracts: contracts.map((contract) => ({
      id: contract.id,
      reference: contract.reference,
      title: contract.title,
      status: contract.status,
      feeCents: contract.feeCents,
      currency: contract.currency,
      startsOn: contract.startsOn.toISOString(),
      employerId: contract.employerId,
      employerName: contract.employer.fullName,
      invoices: contract._count.invoices,
    })),
  });
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "billing:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(contractCreateSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await createContract({
    employerId: parsed.data.employerId,
    title: parsed.data.title,
    feeCents: parsed.data.amount,
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    notes: parsed.data.notes,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, id: result.contract.id, reference: result.contract.reference, note: "Contract saved." });
}
