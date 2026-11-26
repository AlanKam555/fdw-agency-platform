import { NextRequest } from "next/server";
import { json } from "@/lib/http/api";
import { cronAuthorized } from "@/lib/http/cron";
import { runRetention } from "@/lib/privacy/retention";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) {
    return json({ error: "Unauthorised." }, 401);
  }
  const report = await runRetention({ ip: "cron" });
  return json({ ok: true, ...report });
}
