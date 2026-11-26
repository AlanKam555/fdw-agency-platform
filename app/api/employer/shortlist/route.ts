import { NextRequest } from "next/server";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { addShortlist } from "@/lib/services/engagement";
import { shortlistSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, {
    permission: "employer:portal",
    limit: { key: "shortlist", max: 30, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(shortlistSchema, payload);
  if (!parsed.success) return json({ error: "Choose a profile." }, 400);
  const result = await addShortlist({
    userId: guard.session!.sub,
    candidateId: parsed.data.candidateId,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
