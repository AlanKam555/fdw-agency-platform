import { NextRequest } from "next/server";
import { guardRequest, json } from "@/lib/http/api";
import { redactCandidate } from "@/lib/services/engagement";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "candidates:delete" });
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const result = await redactCandidate({
    candidateId: id,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true });
}
