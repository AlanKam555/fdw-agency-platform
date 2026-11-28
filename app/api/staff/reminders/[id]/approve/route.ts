import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json } from "@/lib/http/api";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "reminders:manage" });
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const reminder = await prisma.reminder.findUnique({ where: { id } });
  if (!reminder) return json({ error: "Reminder not found." }, 404);
  if (reminder.done) return json({ error: "Reopen the reminder before approving an email." }, 400);
  await prisma.reminder.update({
    where: { id },
    data: { approvedAt: new Date(), approvedById: guard.session!.sub },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "reminder.approve",
    entityType: "Reminder",
    entityId: id,
    metadata: { kind: reminder.kind || reminder.code },
    ip: guard.ip,
  });
  return json({ ok: true, note: "Approved for email. Nothing is sent until the reminder job runs with sending turned on." });
}
