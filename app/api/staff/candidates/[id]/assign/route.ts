import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { assignmentSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "users:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(assignmentSchema, payload);
  if (!parsed.success) return json({ error: "Enter a staff email." }, 400);
  const { id } = await context.params;
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate || candidate.redactedAt) return json({ error: "Profile not found." }, 404);
  const staff = await prisma.user.findUnique({ where: { email: parsed.data.staffEmail.toLowerCase() } });
  if (!staff || (staff.role !== "STAFF" && staff.role !== "ADMIN") || staff.disabledAt) {
    return json({ error: "That staff account was not found." }, 404);
  }
  await prisma.staffAssignment.upsert({
    where: { staffId_candidateId: { staffId: staff.id, candidateId: candidate.id } },
    create: { staffId: staff.id, candidateId: candidate.id },
    update: {},
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "candidate.assign",
    entityType: "Candidate",
    entityId: candidate.id,
    metadata: { staffId: staff.id },
    ip: guard.ip,
  });
  return json({ ok: true });
}
