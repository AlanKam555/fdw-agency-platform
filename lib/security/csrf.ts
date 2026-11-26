import { secretsEqual } from "@/lib/crypto/field-encryption";

export const CSRF_COOKIE = "hl_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function csrfFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${CSRF_COOKIE}=`)) {
      return decodeURIComponent(part.slice(CSRF_COOKIE.length + 1));
    }
  }
  return null;
}

export function csrfIsValid(cookieToken: string | null, provided: string | null): boolean {
  if (!cookieToken || !provided) return false;
  if (cookieToken.length < 16 || provided.length < 16) return false;
  return secretsEqual(cookieToken, provided);
}

export function originAllowed(
  origin: string | null,
  expectedOrigin: string | readonly string[],
): boolean {
  if (!origin) return true;
  const expectedList = typeof expectedOrigin === "string" ? [expectedOrigin] : expectedOrigin;
  let actual: string;
  try {
    actual = new URL(origin).origin;
  } catch {
    return false;
  }
  return expectedList.some((expected) => {
    try {
      return new URL(expected).origin === actual;
    } catch {
      return false;
    }
  });
}

export function appOrigin(fallbackHost?: string | null): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (fallbackHost) return `http://${fallbackHost}`;
  return "http://localhost:3000";
}
