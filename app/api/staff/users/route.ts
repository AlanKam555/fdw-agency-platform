import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/security/passwords";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { staffUserSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "users:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(staffUserSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return json({ error: "That email is already in use." }, 409);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role },
    ip: guard.ip,
  });
  return json({ ok: true, id: user.id });
}
