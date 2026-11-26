export const REGISTRATION_NOTE =
  "If this email is available, the account is ready. Sign in to continue.";

export const APPLICATION_RECEIVED_NOTE =
  "If this email is new, the application is saved. If you already have an account, sign in to continue.";

export function publicRegistrationBody() {
  return { ok: true as const, note: REGISTRATION_NOTE };
}

export function publicApplicationBody(
  result: { ok: true } | { ok: false; code?: string; error: string },
): { status: number; body: { ok: true; note: string } | { error: string } } {
  if (!result.ok && result.code !== "duplicate_email") {
    return { status: 409, body: { error: result.error } };
  }
  return { status: 200, body: { ok: true, note: APPLICATION_RECEIVED_NOTE } };
}
