import { NextRequest } from "next/server";
import { recordWorkerFee } from "@/lib/billing/worker-fee";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { workerFeeSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "billing:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(workerFeeSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await recordWorkerFee({
    candidateId: parsed.data.candidateId,
    monthlySalaryCents: parsed.data.monthlySalarySgd * 100,
    contractMonths: parsed.data.contractMonths,
    workPassMonths: parsed.data.workPassMonths,
    feeCents: parsed.data.feeSgd * 100,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, id: result.id, note: result.note });
}
