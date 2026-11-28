import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { reviewMomRule } from "@/lib/mom/review";
import { momRuleReviewSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "rules:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(momRuleReviewSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await reviewMomRule({
    ...parsed.data,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  const note =
    parsed.data.action === "verify"
      ? "Marked re-verified. The catalog number was not changed."
      : parsed.data.action === "clear"
        ? "Override removed. The catalog value is in use again."
        : "Override saved. It applies to new checklists. The catalog file is unchanged.";
  return json({ ok: true, note });
}
