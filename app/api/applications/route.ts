import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { assertHuman, honeypotTripped } from "@/lib/security/bot-protection";
import { publicApplicationBody } from "@/lib/security/registration";
import { createCandidateApplication } from "@/lib/services/candidates";
import { publicCandidateApplicationSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, {
    limit: { key: "apply", max: 5, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  if (honeypotTripped(payload)) return json(publicApplicationBody({ ok: true }).body);
  if (!(await assertHuman(payload, guard.ip))) return json({ error: "The form could not be confirmed." }, 400);
  const parsed = parseBody(publicCandidateApplicationSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const actorId = guard.session?.role === "CANDIDATE" ? guard.session.sub : null;
  const result = await createCandidateApplication(parsed.data, {
    ip: guard.ip,
    userId: actorId,
    actorId,
    fictional: false,
  });
  const ack = publicApplicationBody(result);
  return json(ack.body, ack.status);
}
