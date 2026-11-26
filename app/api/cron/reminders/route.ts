import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http/api";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return json({ error: "Unauthorised." }, 401);
  }
  const reminders = await prisma.reminder.findMany({
    where: { done: false },
    orderBy: { id: "asc" },
    take: 50,
    select: { id: true, code: true, title: true, dueHint: true, momCaseId: true },
  });
  return json({
    ok: true,
    delivered: false,
    channel: "none",
    note: "Email delivery is not configured. This endpoint lists reminders for an external worker.",
    reminders,
  });
}
