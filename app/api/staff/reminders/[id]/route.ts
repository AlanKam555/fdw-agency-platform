import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json } from "@/lib/http/api";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "mom:prepare" });
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const reminder = await prisma.reminder.findUnique({ where: { id } });
  if (!reminder) return json({ error: "Reminder not found." }, 404);
  const updated = await prisma.reminder.update({
    where: { id },
    data: reminder.done
      ? { done: false, doneAt: null }
      : { done: true, doneAt: new Date() },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "mom.reminder_toggle",
    entityType: "Reminder",
    entityId: id,
    metadata: { done: updated.done },
    ip: guard.ip,
  });
  return json({ ok: true, done: updated.done });
}
