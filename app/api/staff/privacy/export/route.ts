import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { notifyAnomaly } from "@/lib/security/alerts";
import { reasonMetadata } from "@/lib/security/access-control";
import { buildSubjectExport, exportHtml, exportPdf } from "@/lib/privacy/export";
import { staffExportSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "privacy:export" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(staffExportSchema, payload);
  if (!parsed.success) return json({ error: "Choose a person, a reason, and a format." }, 400);
  const actorId = guard.session!.sub;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.auditLog.count({
    where: { actorId, action: "privacy.export", createdAt: { gte: since } },
  });
  if (recent >= 3) {
    await notifyAnomaly({ kind: "access.quota_exceeded", actorId, count: recent });
    return json({ error: "Export limit reached. Try again later." }, 429);
  }
  const bundle = await buildSubjectExport({
    subjectType: parsed.data.subjectType,
    subjectId: parsed.data.subjectId,
  });
  if (!bundle) return json({ error: "Profile not found." }, 404);
  await writeAudit({
    actorId,
    action: "privacy.export",
    entityType: parsed.data.subjectType === "candidate" ? "Candidate" : "Employer",
    entityId: parsed.data.subjectId,
    metadata: {
      format: parsed.data.format,
      subjectType: parsed.data.subjectType,
      ...reasonMetadata(parsed.data.reasonCode, parsed.data.reasonText),
    },
    ip: guard.ip,
  });
  if (parsed.data.format === "json") {
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": "attachment; filename=\"personal-data.json\"",
        "cache-control": "private, no-store",
      },
    });
  }
  if (parsed.data.format === "html") {
    return new NextResponse(exportHtml(bundle), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": "attachment; filename=\"personal-data.html\"",
        "cache-control": "private, no-store",
      },
    });
  }
  const pdf = await exportPdf(bundle);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=\"personal-data.pdf\"",
      "cache-control": "private, no-store",
    },
  });
}
