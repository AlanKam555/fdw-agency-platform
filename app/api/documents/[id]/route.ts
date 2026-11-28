import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json } from "@/lib/http/api";
import { hasPermission } from "@/lib/security/rbac";
import { clientIp } from "@/lib/security/client-ip";
import { signDocumentAccess, verifyDocumentAccess } from "@/lib/storage/signed-url";
import {
  attachmentFileName,
  presignObject,
  readStoredObject,
  safeDownloadUrl,
} from "@/lib/storage/files";

async function signerStillAllowed(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return false;
  return hasPermission(user.role, "documents:staff");
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  const issue = req.nextUrl.searchParams.get("issue") === "1";

  if (issue) {
    const guard = await guardRequest(req, {}, { permission: "documents:staff", csrf: false });
    if (!guard.ok) return guard.response;
    await writeAudit({
      actorId: guard.session!.sub,
      action: "document.sign",
      entityType: "Document",
      entityId: id,
      ip: guard.ip,
    });
    const url = `/api/documents/${id}?token=${signDocumentAccess(id, 300, Date.now(), guard.session!.sub)}`;
    return json({ url });
  }

  let actorId: string | null = null;
  if (token) {
    const signed = verifyDocumentAccess(token);
    if (!signed || signed.id !== id || !signed.sub || !(await signerStillAllowed(signed.sub))) {
      return json({ error: "A valid signed link is required." }, 401);
    }
    actorId = signed.sub;
  } else {
    const guard = await guardRequest(req, {}, { permission: "documents:staff", csrf: false });
    if (!guard.ok) return json({ error: "A valid signed link is required." }, 401);
    actorId = guard.session!.sub;
  }

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return json({ error: "Document not found." }, 404);
  await writeAudit({
    actorId,
    action: "document.download",
    entityType: "Document",
    entityId: document.id,
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
