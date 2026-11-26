import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { createCandidateApplication } from "@/lib/services/candidates";
import { candidateApplicationSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "candidates:write" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(candidateApplicationSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await createCandidateApplication(parsed.data, {
    ip: guard.ip,
    actorId: guard.session?.sub,
    fictional: false,
  });
  if (!result.ok) return json({ error: result.error }, 409);
  return json({ ok: true, id: result.candidate.id });
}
