import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { changeCandidateStatus } from "@/lib/services/candidates";
import { statusSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "candidates:write" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(statusSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const { id } = await context.params;
  const result = await changeCandidateStatus({
    candidateId: id,
    status: parsed.data.status,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, status: result.candidate.status });
}
