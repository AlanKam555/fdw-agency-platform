import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { recordInterviewFeedback } from "@/lib/services/growth";

const schema = z.object({
  outcome: z.enum(["PROCEED", "HOLD", "DECLINED"]),
  gaps: z.array(z.enum(["skill", "language", "care", "experience"])).default([]),
  notes: z.string().trim().max(1000).default(""),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "matching:decide" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await recordInterviewFeedback({
    interviewId: id,
    actorId: guard.session!.sub,
    outcome: parsed.data.outcome,
    gaps: parsed.data.gaps,
    notes: parsed.data.notes,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  const bits = Object.entries(result.suggestion)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
  return json({
    ok: true,
    note: `Feedback saved. Suggested weights (not applied): ${bits}. Outcome evidence: ${result.evidenceCount}. Save them on the requirement page if you agree.`,
  });
}
