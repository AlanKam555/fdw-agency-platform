import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { saveUtmLink } from "@/lib/services/growth";

const schema = z.object({
  path: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(80),
  medium: z.string().trim().min(1).max(80),
  campaign: z.string().trim().min(1).max(80),
  content: z.string().trim().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "marketing:draft" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await saveUtmLink({
    createdById: guard.session!.sub,
    path: parsed.data.path,
    source: parsed.data.source,
    medium: parsed.data.medium,
    campaign: parsed.data.campaign,
    content: parsed.data.content,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, note: result.url });
}
