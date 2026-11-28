import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { decryptString } from "@/lib/crypto/field-encryption";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { assertQuota, reasonMetadata, revealQuota } from "@/lib/security/access-control";
import { sensitiveRevealSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "employers:read" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(sensitiveRevealSchema, payload);
  if (!parsed.success) return json({ error: "Choose a field and write a short reason." }, 400);
  if (parsed.data.field !== "nric") return json({ error: "This record only reveals NRIC." }, 400);
  const session = guard.session!;
  const quota = revealQuota();
  const allowed = await assertQuota({
    actorId: session.sub,
    actions: ["candidate.view_sensitive", "employer.view_sensitive"],
    hourly: quota.hourly,
    daily: quota.daily,
    kind: "access.bulk_reveal",
  });
  if (!allowed.ok) return json({ error: allowed.error }, 429);
  const { id } = await context.params;
  const employer = await prisma.employer.findUnique({ where: { id } });
  if (!employer || employer.redactedAt) return json({ error: "Household not found." }, 404);
  await writeAudit({
    actorId: session.sub,
    action: "employer.view_sensitive",
    entityType: "Employer",
    entityId: employer.id,
    metadata: { field: "nric", ...reasonMetadata(parsed.data.reasonCode, parsed.data.reasonText) },
    ip: guard.ip,
  });
  if (!employer.nricEnc) return json({ value: "" });
  return json({ value: decryptString(employer.nricEnc) });
}
