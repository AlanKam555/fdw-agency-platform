import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { decideMatch } from "@/lib/services/matching";

const schema = z.object({
  decision: z.enum(["STAFF_APPROVED", "STAFF_REJECTED"]),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "matching:decide" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: "Choose a decision." }, 400);
  const { id } = await context.params;
  const result = await decideMatch({
    matchId: id,
    decision: parsed.data.decision,
    actorId: guard.session!.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
