import { NextRequest } from "next/server";
import { z } from "zod";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { submitTestimonial } from "@/lib/services/growth";

const schema = z.object({
  token: z.string().trim().min(16).max(80),
  authorName: z.string().trim().min(2).max(80),
  quote: z.string().trim().min(10).max(600),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { limit: { key: "testimonial", max: 5, windowMs: 15 * 60 * 1000 } });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await submitTestimonial(parsed.data);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, message: "Thank you. Staff will read the quote before it appears on the site." });
}
