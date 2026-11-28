import { NextRequest, NextResponse } from "next/server";
import { cookiesAreSecure } from "@/lib/auth/session";
import { isLocale, safeNextPath } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/request";

function isPrefetch(req: NextRequest): boolean {
  const purpose = (req.headers.get("purpose") ?? req.headers.get("sec-purpose") ?? "").toLowerCase();
  return req.headers.get("next-router-prefetch") === "1" || purpose === "prefetch";
}

export async function GET(req: NextRequest) {
  if (isPrefetch(req)) return new NextResponse(null, { status: 204 });
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const lang = req.nextUrl.searchParams.get("lang");
  // Relative Location stays on the browser's host. req.url uses the bind
  // address (0.0.0.0) and would send the browser off-origin.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: next, "Cache-Control": "private, no-store" },
  });
  if (isLocale(lang)) {
    response.cookies.set(LOCALE_COOKIE, lang, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookiesAreSecure(),
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
