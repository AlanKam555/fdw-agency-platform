import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestSession } from "@/lib/auth/sessions";
import { clearSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { readStoredObject } from "@/lib/storage/files";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  let staff = false;
  if (cookie) {
    try {
      const resolved = await resolveRequestSession(cookie);
      if (resolved.kind === "disabled") {
        const response = new NextResponse("Sign in required.", { status: 401 });
        response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
        return response;
      }
      staff = resolved.kind === "active" && (resolved.user.role === "ADMIN" || resolved.user.role === "STAFF");
    } catch {
      staff = false;
    }
  }
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      documents: {
        where: { kind: "PHOTO", reviewedAt: { not: null }, rejectedAt: null, approvedById: { not: null } },
        orderBy: { reviewedAt: "desc" },
        take: 1,
      },
    },
  });
  const photo = candidate?.documents[0];
  if (!candidate || !photo || !candidate.photoConsent || !candidate.marketingConsent || candidate.redactedAt) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (candidate.status !== "AVAILABLE" && !staff) {
    return new NextResponse("Not found", { status: 404 });
  }
  const bytes = await readStoredObject(photo.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
