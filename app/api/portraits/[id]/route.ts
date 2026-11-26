import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { readEncryptedObject } from "@/lib/storage/files";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { documents: { where: { kind: "PHOTO" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const photo = candidate?.documents[0];
  if (!candidate || !photo || !candidate.photoConsent || candidate.redactedAt) {
    return new NextResponse("Not found", { status: 404 });
  }
  let staff = false;
  try {
    const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    staff = session?.role === "ADMIN" || session?.role === "STAFF";
  } catch {
    staff = false;
  }
  if (candidate.status !== "AVAILABLE" && !staff) {
    return new NextResponse("Not found", { status: 404 });
  }
  const bytes = await readEncryptedObject(photo.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
