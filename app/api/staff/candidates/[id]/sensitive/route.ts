import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { decryptString } from "@/lib/crypto/field-encryption";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { sensitiveRevealSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "candidates:sensitive" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(sensitiveRevealSchema, payload);
  if (!parsed.success) return json({ error: "Choose a field." }, 400);
  const { id } = await context.params;
  if (parsed.data.field === "nric") {
    return json({ error: "Employer NRIC is revealed from the employer record." }, 400);
  }
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return json({ error: "Profile not found." }, 404);
  const encrypted =
    parsed.data.field === "passport"
      ? candidate.passportNumberEnc
      : parsed.data.field === "fin"
        ? candidate.finEnc
        : candidate.medicalNotesEnc;
  if (!encrypted) return json({ value: "" });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "candidate.view_sensitive",
    entityType: "Candidate",
    entityId: candidate.id,
    metadata: { field: parsed.data.field },
    ip: guard.ip,
  });
  return json({ value: decryptString(encrypted) });
}
