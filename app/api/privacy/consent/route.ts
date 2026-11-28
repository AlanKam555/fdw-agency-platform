import { NextRequest } from "next/server";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { changeConsent } from "@/lib/privacy/consent";
import { consentChangeSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { roles: ["CANDIDATE", "EMPLOYER"] });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(consentChangeSchema, payload);
  if (!parsed.success) return json({ error: "Choose a consent purpose." }, 400);
  const session = guard.session!;
  if (session.role !== "CANDIDATE" && session.role !== "EMPLOYER") {
    return json({ error: "Forbidden." }, 403);
  }
  const result = await changeConsent({
    role: session.role,
    userId: session.sub,
    purpose: parsed.data.purpose,
    granted: parsed.data.granted,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true });
}
