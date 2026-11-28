import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { reminderOptInSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "reminders:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(reminderOptInSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  await prisma.reminderTypeOptIn.upsert({
    where: { code: parsed.data.code },
    create: { code: parsed.data.code, enabled: parsed.data.enabled, updatedById: guard.session!.sub },
    update: { enabled: parsed.data.enabled, updatedById: guard.session!.sub },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "reminder.opt_in",
    entityType: "ReminderTypeOptIn",
    entityId: parsed.data.code,
    metadata: { code: parsed.data.code, enabled: parsed.data.enabled },
    ip: guard.ip,
  });
  return json({
    ok: true,
    note: parsed.data.enabled
      ? "This reminder type can be sent when sending is turned on."
      : "This reminder type will not be sent unless a single reminder is approved.",
  });
}
