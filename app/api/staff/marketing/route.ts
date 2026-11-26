import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { createMarketingDraft } from "@/lib/services/engagement";
import { marketingRequestSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "marketing:draft" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(marketingRequestSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await createMarketingDraft({
    authorId: guard.session!.sub,
    kind: parsed.data.kind,
    candidateId: parsed.data.candidateId || undefined,
    notes: parsed.data.notes,
    language: parsed.data.language,
    channel: parsed.data.channel,
    campaignId: parsed.data.campaignId || undefined,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, id: result.draft.id, source: result.draft.source });
}
