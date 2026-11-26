import { NextRequest } from "next/server";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { reviewMarketingDraft } from "@/lib/services/engagement";
import { draftReviewSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "marketing:review" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(draftReviewSchema, payload);
  if (!parsed.success) return json({ error: "Choose approve or reject." }, 400);
  const { id } = await context.params;
  const result = await reviewMarketingDraft({
    draftId: id,
    reviewerId: guard.session!.sub,
    decision: parsed.data.decision,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({
    ok: true,
    status: result.draft.status,
    externalPublish: false,
    note: "Approval records a staff review. This product does not post to external networks.",
  });
}
