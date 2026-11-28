import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardRequest, json } from "@/lib/http/api";
import { confirmEmailVerification, issueEmailVerification } from "@/lib/security/email-verification";
import { publicRegistrationBody } from "@/lib/security/registration";

export async function GET(req: NextRequest) {
  const guard = await guardRequest(req, {}, {
    limit: { key: "verify-email", max: 20, windowMs: 15 * 60 * 1000 },
    csrf: false,
  });
  if (!guard.ok) return guard.response;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const ok = token ? await confirmEmailVerification(token) : false;
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = ok ? "verified=1" : "verified=0";
  return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, {
    limit: { key: "verify-email-resend", max: 5, windowMs: 60 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (email.includes("@")) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt && (user.role === "EMPLOYER" || user.role === "CANDIDATE")) {
      await issueEmailVerification(user.id, email);
    }
  }
  return json(publicRegistrationBody());
}
