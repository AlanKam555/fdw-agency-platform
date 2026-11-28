import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { documentReviewSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "documents:staff" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(documentReviewSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const { id } = await context.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.kind !== "PHOTO") return json({ error: "Photo not found." }, 404);
  const now = new Date();
  if (parsed.data.decision === "approve") {
    await prisma.document.update({
      where: { id },
      data: {
        reviewedAt: now,
        approvedById: guard.session!.sub,
        rejectedAt: null,
        rejectedById: null,
        rejectionReason: null,
      },
    });
    await writeAudit({
      actorId: guard.session!.sub,
      action: "document.review_approved",
      entityType: "Document",
      entityId: id,
      ip: guard.ip,
    });
    return json({ ok: true });
  }
  await prisma.document.update({
    where: { id },
    data: {
      reviewedAt: now,
      approvedById: null,
      rejectedAt: now,
      rejectedById: guard.session!.sub,
      rejectionReason: (parsed.data.reason ?? "").trim(),
    },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "document.review_rejected",
    entityType: "Document",
    entityId: id,
    metadata: { reason: (parsed.data.reason ?? "").trim() },
    ip: guard.ip,
  });
  return json({ ok: true });
}
