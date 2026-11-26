import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { publicRegistrationBody } from "@/lib/security/registration";
import { registerAccount } from "@/lib/services/accounts";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, {
    limit: { key: "register", max: 8, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(registerSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  await registerAccount({ ...parsed.data, ip: guard.ip });
  return json(publicRegistrationBody());
}
