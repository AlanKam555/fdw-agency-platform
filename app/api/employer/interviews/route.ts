import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { requestInterview } from "@/lib/services/engagement";
import { interviewSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, {
    permission: "employer:portal",
    limit: { key: "interview", max: 10, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(interviewSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await requestInterview({
    userId: guard.session!.sub,
    candidateId: parsed.data.candidateId,
    preferredWindow: parsed.data.preferredWindow,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, id: result.interview.id });
}
