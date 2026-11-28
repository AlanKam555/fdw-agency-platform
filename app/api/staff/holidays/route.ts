import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { holidayByDate } from "@/config/public-holidays";
import { holidayAdjustmentSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "holidays:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(holidayAdjustmentSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const data = parsed.data;

  if (data.action === "remove") {
    const existing = await prisma.publicHolidayAdjustment.findUnique({ where: { id: data.id } });
    if (!existing) return json({ error: "Holiday adjustment not found." }, 404);
    await prisma.publicHolidayAdjustment.delete({ where: { id: data.id } });
    await writeAudit({
      actorId: guard.session!.sub,
      action: "holiday.remove",
      entityType: "PublicHolidayAdjustment",
      entityId: existing.date,
      metadata: { date: existing.date },
      ip: guard.ip,
    });
    return json({ ok: true, note: "Holiday adjustment removed." });
  }

  const official = holidayByDate(data.date);
  if (data.action === "suppress" && !official) {
    return json({ error: "That date is not on the official list, so there is nothing to suppress." }, 400);
  }
  const name = data.action === "add" ? data.name : official?.name ?? "Public holiday";
  await prisma.publicHolidayAdjustment.upsert({
    where: { date: data.date },
    create: {
      date: data.date,
      name,
      suppressed: data.action === "suppress",
      note: data.note,
      sourceUrl: data.sourceUrl,
      updatedById: guard.session!.sub,
    },
    update: {
      name,
      suppressed: data.action === "suppress",
      note: data.note,
      sourceUrl: data.sourceUrl,
      updatedById: guard.session!.sub,
    },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: data.action === "suppress" ? "holiday.suppress" : "holiday.add",
    entityType: "PublicHolidayAdjustment",
    entityId: data.date,
    metadata: { date: data.date, suppressed: data.action === "suppress" },
    ip: guard.ip,
  });
  return json({ ok: true, note: data.action === "suppress" ? "Holiday suppressed for deadline maths." : "Holiday added for deadline maths." });
}
