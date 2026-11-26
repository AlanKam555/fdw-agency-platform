import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { requestTestimonial, reviewTestimonial } from "@/lib/services/growth";

const createSchema = z.object({
  employerEmail: z.string().trim().email(),
});

const reviewSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "DECLINED"]),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "marketing:review" });
  if (!guard.ok) return guard.response;
  if (payload && typeof payload === "object" && "decision" in payload) {
    const parsed = parseBody(reviewSchema, payload);
    if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
    const result = await reviewTestimonial({
      id: parsed.data.id,
      actorId: guard.session!.sub,
      decision: parsed.data.decision,
      ip: guard.ip,
    });
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ ok: true });
  }
  const parsed = parseBody(createSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const created = await requestTestimonial({
    authorId: guard.session!.sub,
    employerEmail: parsed.data.employerEmail,
    ip: guard.ip,
  });
  return json({ ok: true, note: `Share this private link once: ${created.path}` });
}
