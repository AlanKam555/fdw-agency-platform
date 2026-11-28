import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { decryptString } from "@/lib/crypto/field-encryption";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import {
  assertCandidateAssignment,
  assertQuota,
  reasonMetadata,
  revealQuota,
} from "@/lib/security/access-control";
import { sensitiveRevealSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "candidates:sensitive" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(sensitiveRevealSchema, payload);
  if (!parsed.success) return json({ error: "Choose a field and write a short reason." }, 400);
  const { id } = await context.params;
  if (parsed.data.field === "nric") {
    return json({ error: "Employer NRIC is revealed from the employer record." }, 400);
  }
  const session = guard.session!;
  const assigned = await assertCandidateAssignment({
    role: session.role,
    staffId: session.sub,
    candidateId: id,
  });
  if (!assigned.ok) return json({ error: assigned.error }, 403);
  const quota = revealQuota();
  const allowed = await assertQuota({
    actorId: session.sub,
    actions: ["candidate.view_sensitive", "employer.view_sensitive"],
    hourly: quota.hourly,
    daily: quota.daily,
    kind: "access.bulk_reveal",
  });
  if (!allowed.ok) return json({ error: allowed.error }, 429);
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return json({ error: "Profile not found." }, 404);
  const encrypted =
    parsed.data.field === "passport"
      ? candidate.passportNumberEnc
      : parsed.data.field === "fin"
        ? candidate.finEnc
        : candidate.medicalNotesEnc;
  await writeAudit({
    actorId: session.sub,
    action: "candidate.view_sensitive",
    entityType: "Candidate",
    entityId: candidate.id,
    metadata: { field: parsed.data.field, ...reasonMetadata(parsed.data.reasonCode, parsed.data.reasonText) },
    ip: guard.ip,
  });
  if (!encrypted) return json({ value: "" });
  return json({ value: decryptString(encrypted) });
}
