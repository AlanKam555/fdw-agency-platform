import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardRequest } from "@/lib/http/api";
import { momPdf } from "@/lib/services/mom";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  const guard = guardRequest(req, {}, { permission: "mom:prepare", csrf: false });
  if (!guard.ok) return guard.response;
  const { matchId } = await context.params;
  const pdf = await momPdf(matchId);
  if (!pdf) return NextResponse.json({ error: "Pack not found." }, { status: 404 });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "mom.pdf_download",
    entityType: "Match",
    entityId: matchId,
    ip: guard.ip,
  });
  return new NextResponse(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
