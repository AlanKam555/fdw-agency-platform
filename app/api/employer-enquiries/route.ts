import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { saveEmployerRequirement } from "@/lib/services/employers";
import { employerRequirementSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, {
    limit: { key: "employer-enquiry", max: 8, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(employerRequirementSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const signedInEmployer = guard.session?.role === "EMPLOYER";
  const result = await saveEmployerRequirement(parsed.data, {
    kind: signedInEmployer ? "account" : "enquiry",
    userId: signedInEmployer ? guard.session?.sub : null,
    actorId: guard.session?.sub,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true, requirementId: result.requirementId, enquiryId: result.enquiryId });
}
