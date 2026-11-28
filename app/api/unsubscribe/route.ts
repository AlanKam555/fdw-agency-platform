import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { maskEmail, readUnsubscribeToken } from "@/lib/email/driver";
import { suppressEmail } from "@/lib/reminders/dispatch";
import { unsubscribeSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { limit: { key: "unsubscribe", max: 10, windowMs: 60 * 60 * 1000 } });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(unsubscribeSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const email = readUnsubscribeToken(parsed.data.token);
  if (!email) return json({ error: "This unsubscribe link is not valid." }, 400);
  await suppressEmail(email);
  return json({ ok: true, note: `${maskEmail(email)} will not receive further reminders.` });
}
