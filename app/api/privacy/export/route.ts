import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { verifyPassword } from "@/lib/security/passwords";
import { notifyAnomaly } from "@/lib/security/alerts";
import { buildSubjectExport, exportHtml, exportPdf } from "@/lib/privacy/export";
import { subjectExportSchema } from "@/lib/validation/schemas";

async function exportTooSoon(actorId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: { actorId, action: "privacy.export", createdAt: { gte: since } },
  });
  if (count >= 3) {
    await notifyAnomaly({ kind: "access.quota_exceeded", actorId, count });
    return true;
  }
  return false;
}

function fileResponse(format: "json" | "html" | "pdf", body: string | Uint8Array) {
  const common = { "cache-control": "private, no-store" };
  if (format === "json") {
    return new NextResponse(typeof body === "string" ? body : "", {
      headers: { ...common, "content-type": "application/json; charset=utf-8", "content-disposition": "attachment; filename=\"personal-data.json\"" },
    });
  }
  if (format === "html") {
    return new NextResponse(typeof body === "string" ? body : "", {
      headers: { ...common, "content-type": "text/html; charset=utf-8", "content-disposition": "attachment; filename=\"personal-data.html\"" },
    });
  }
  const bytes = body instanceof Uint8Array ? Buffer.from(body) : Buffer.from("");
  return new NextResponse(bytes, {
    headers: { ...common, "content-type": "application/pdf", "content-disposition": "attachment; filename=\"personal-data.pdf\"" },
  });
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, {
    roles: ["CANDIDATE", "EMPLOYER"],
    limit: { key: "privacy-export", max: 8, windowMs: 60 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(subjectExportSchema, payload);
  if (!parsed.success) return json({ error: "Enter your password and choose a format." }, 400);
  const session = guard.session!;
  if (await exportTooSoon(session.sub)) return json({ error: "Export limit reached. Try again later." }, 429);
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return json({ error: "Sign in required." }, 401);
  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordOk) return json({ error: "Password did not match." }, 403);
  const subject =
    session.role === "CANDIDATE"
      ? await prisma.candidate.findUnique({ where: { userId: user.id }, select: { id: true } })
      : await prisma.employer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!subject) return json({ error: "Profile not found." }, 404);
  const subjectType = session.role === "CANDIDATE" ? "candidate" : "employer";
  const bundle = await buildSubjectExport({ subjectType, subjectId: subject.id });
  if (!bundle) return json({ error: "Profile not found." }, 404);
  await writeAudit({
    actorId: user.id,
    action: "privacy.export",
    entityType: subjectType === "candidate" ? "Candidate" : "Employer",
    entityId: subject.id,
    metadata: { format: parsed.data.format, subjectType },
    ip: guard.ip,
  });
  if (parsed.data.format === "json") return fileResponse("json", JSON.stringify(bundle, null, 2));
  if (parsed.data.format === "html") return fileResponse("html", exportHtml(bundle));
  return fileResponse("pdf", await exportPdf(bundle));
}
