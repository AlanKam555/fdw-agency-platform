import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { recordPlacementOutcome } from "@/lib/services/outcomes";
import { placementOutcomeSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "outcomes:write" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(placementOutcomeSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await recordPlacementOutcome({
    matchId: parsed.data.matchId,
    startedOn: parsed.data.startedOn,
    endedOn: parsed.data.endedOn,
    checkInMonth: parsed.data.checkInMonth,
    completion: parsed.data.completion,
    reasonCategory: parsed.data.reasonCategory,
    employerSatisfaction: parsed.data.employerSatisfaction,
    helperSatisfaction: parsed.data.helperSatisfaction,
    notes: parsed.data.notes,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({
    ok: true,
    note: `Outcome saved. Duration on file: ${result.durationDays} days. Notes stay on the staff desk. Weights are not changed until someone saves them.`,
  });
}
