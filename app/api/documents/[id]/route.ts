import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json } from "@/lib/http/api";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { verifyDocumentAccess } from "@/lib/storage/signed-url";
import { signDocumentAccess } from "@/lib/storage/signed-url";
import { readEncryptedObject } from "@/lib/storage/files";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  const signed = verifyDocumentAccess(token);
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
    const url = `/api/documents/${id}?token=${signDocumentAccess(id)}`;
    return json({ url });
  }

  if (!signed || signed.id !== id) {
    let session = null;
    try {
      session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    } catch {
      session = null;
    }
    if (!session || (session.role !== "ADMIN" && session.role !== "STAFF")) {
      return json({ error: "A valid signed link is required." }, 401);
    }
  }

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return json({ error: "Document not found." }, 404);
  const bytes = await readEncryptedObject(document.storageKey);
  if (!signed) {
    const guard = await guardRequest(req, {}, { permission: "documents:staff", csrf: false });
    if (guard.ok) {
      await writeAudit({
        actorId: guard.session!.sub,
        action: "document.download",
        entityType: "Document",
        entityId: document.id,
        ip: guard.ip,
      });
    }
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.contentType,
      "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
