import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { prepareMomCase } from "@/lib/services/mom";
import { momAttestationSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "mom:prepare" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(momAttestationSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const { matchId } = await context.params;
  const result = await prepareMomCase({
    matchId,
    attestation: parsed.data,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, id: result.momCase.id, ready: result.momCase.ready });
}
