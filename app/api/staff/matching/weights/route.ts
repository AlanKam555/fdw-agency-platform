import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { saveMatchWeights } from "@/lib/services/growth";
import { WEIGHT_KEYS, coerceWeights } from "@/lib/matching/weights";

const fields = Object.fromEntries(WEIGHT_KEYS.map((key) => [key, z.coerce.number().int().min(0).max(100)]));

const schema = z.object({
  requirementId: z.string().min(1),
  ...fields,
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "matching:run" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const weights = coerceWeights(parsed.data);
  const result = await saveMatchWeights({
    requirementId: parsed.data.requirementId,
    actorId: guard.session!.sub,
    weights,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, message: "Weights saved. Re-rank to apply them. Nothing changes until you do." });
}
