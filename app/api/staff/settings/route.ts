import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { saveAgencyVoice } from "@/lib/services/growth";

const schema = z.object({
  brandVoice: z.string().trim().min(2).max(500),
  voiceNotes: z.string().trim().max(1000).default(""),
  eaLicenceNo: z.string().trim().min(3).max(40),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, { permission: "users:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  await saveAgencyVoice({
    actorId: guard.session!.sub,
    brandVoice: parsed.data.brandVoice,
    voiceNotes: parsed.data.voiceNotes,
    eaLicenceNo: parsed.data.eaLicenceNo,
    ip: guard.ip,
  });
  return json({ ok: true, message: "Voice and licence number saved. Provider keys stay in the server environment." });
}
