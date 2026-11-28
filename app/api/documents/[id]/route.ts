import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { hasPermission } from "@/lib/security/rbac";
import { clientIp } from "@/lib/security/client-ip";
import {
  assertCandidateAssignment,
  assertQuota,
  downloadQuota,
  reasonMetadata,
} from "@/lib/security/access-control";
import { signDocumentAccess, verifyDocumentAccess } from "@/lib/storage/signed-url";
import {
  attachmentFileName,
  presignObject,
  readStoredObject,
  safeDownloadUrl,
} from "@/lib/storage/files";
import { documentAccessSchema } from "@/lib/validation/schemas";

async function signerStillAllowed(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return false;
  return hasPermission(user.role, "documents:staff");
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "documents:staff" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(documentAccessSchema, payload);
  if (!parsed.success) return json({ error: "Write a reason before opening this file." }, 400);
  const { id } = await context.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return json({ error: "Document not found." }, 404);
  const session = guard.session!;
  const assigned = await assertCandidateAssignment({
    role: session.role,
    staffId: session.sub,
    candidateId: document.candidateId,
  });
  if (!assigned.ok) return json({ error: assigned.error }, 403);
  const quota = downloadQuota();
  const allowed = await assertQuota({
    actorId: session.sub,
    actions: ["document.download"],
    hourly: quota.hourly,
    daily: quota.daily,
    kind: "access.bulk_download",
  });
  if (!allowed.ok) return json({ error: allowed.error }, 429);
  await writeAudit({
    actorId: session.sub,
    action: "document.access",
    entityType: "Document",
    entityId: document.id,
    metadata: reasonMetadata(parsed.data.reasonCode, parsed.data.reasonText),
    ip: guard.ip,
  });
  const url = `/api/documents/${id}?token=${signDocumentAccess(id, 300, Date.now(), session.sub, parsed.data.reasonCode)}`;
  return json({ url });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  const signed = verifyDocumentAccess(token);
  if (!signed || signed.id !== id) {
    return json({ error: "A valid signed link is required." }, 401);
  }
  if (!signed.reasonCode) {
    return json({ error: "Ask for a download link and include a reason." }, 400);
  }
  if (!(await signerStillAllowed(signed.sub))) {
    return json({ error: "A valid signed link is required." }, 401);
  }
  const quota = downloadQuota();
  const allowed = await assertQuota({
    actorId: signed.sub,
    actions: ["document.download"],
    hourly: quota.hourly,
    daily: quota.daily,
    kind: "access.bulk_download",
  });
  if (!allowed.ok) return json({ error: allowed.error }, 429);

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return json({ error: "Document not found." }, 404);
  const assigned = await assertCandidateAssignment({
    role: (await prisma.user.findUnique({ where: { id: signed.sub }, select: { role: true } }))?.role ?? "STAFF",
    staffId: signed.sub,
    candidateId: document.candidateId,
  });
  if (!assigned.ok) return json({ error: assigned.error }, 403);
  await writeAudit({
    actorId: signed.sub,
    action: "document.download",
    entityType: "Document",
    entityId: document.id,
    metadata: { reasonCode: signed.reasonCode },
    ip: clientIp(req),
  });

  const presigned = await presignObject(document.storageKey, 300, {
    contentType: document.contentType,
    fileName: document.fileName,
  });
  if (presigned) {
    const target = safeDownloadUrl(presigned);
    if (!target) return json({ error: "The download link could not be issued." }, 500);
    return NextResponse.redirect(target, 302);
  }

  const bytes = await readStoredObject(document.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.contentType,
      "Content-Disposition": `attachment; filename="${attachmentFileName(document.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
