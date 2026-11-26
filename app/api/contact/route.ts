import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { contactSchema, PDPA_VERSION } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, {
    limit: { key: "contact", max: 5, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(contactSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const enquiry = await prisma.enquiry.create({
    data: {
      kind: "contact",
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone || null,
      message: parsed.data.message,
      source: parsed.data.source || "",
      utmSource: parsed.data.utmSource || "",
      utmMedium: parsed.data.utmMedium || "",
      utmCampaign: parsed.data.utmCampaign || "",
      utmContent: parsed.data.utmContent || "",
      landingPath: parsed.data.landingPath || "",
    },
  });
  await prisma.consentRecord.create({
    data: {
      subjectType: "Enquiry",
      subjectId: enquiry.id,
      purpose: "enquiry_reply",
      policyVersion: PDPA_VERSION,
      granted: true,
    },
  });
  await writeAudit({
    action: "enquiry.contact",
    entityType: "Enquiry",
    entityId: enquiry.id,
    ip: guard.ip,
  });
  return json({ ok: true });
}
