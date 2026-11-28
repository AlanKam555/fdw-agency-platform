import { NextRequest } from "next/server";
import { json } from "@/lib/http/api";
import { cronAuthorized } from "@/lib/http/cron";
import { dispatchReminders } from "@/lib/reminders/dispatch";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) {
    return json({ error: "Unauthorised." }, 401);
  }
  const summary = await dispatchReminders();
  return json(summary);
}
