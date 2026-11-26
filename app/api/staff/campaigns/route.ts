import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { createCampaign } from "@/lib/services/growth";

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  channel: z.enum(["facebook", "instagram", "tiktok", "whatsapp", "google_business", "email"]),
  startsOn: z.string().min(8),
  endsOn: z.string().min(8),
  objective: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "marketing:draft" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const campaign = await createCampaign({
    authorId: guard.session!.sub,
    title: parsed.data.title,
    objective: parsed.data.objective,
    channel: parsed.data.channel,
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    ip: guard.ip,
  });
  return json({ ok: true, id: campaign.id });
}
