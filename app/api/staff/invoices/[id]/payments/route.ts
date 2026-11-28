import { NextRequest } from "next/server";
import { recordPayment } from "@/lib/billing/contracts";
import { paymentSchema } from "@/lib/billing/schemas";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "billing:manage" });
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const parsed = parseBody(paymentSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await recordPayment({
    invoiceId: id,
    amountCents: parsed.data.amount,
    paidOn: parsed.data.paidOn,
    method: parsed.data.method,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, note: "Payment recorded." });
}
