import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json, parseBody } from "@/lib/http/api";

const schema = z.object({
  status: z.enum(["REQUESTED", "SCHEDULED", "COMPLETED", "CANCELLED", "DECLINED"]),
  staffNote: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "employers:write" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(schema, payload);
  if (!parsed.success) return json({ error: "Choose a status." }, 400);
  const { id } = await context.params;
  const interview = await prisma.interviewRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      staffNote: parsed.data.staffNote ?? undefined,
    },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "interview.update",
    entityType: "InterviewRequest",
    entityId: interview.id,
    metadata: { status: interview.status },
    ip: guard.ip,
  });
  return json({ ok: true });
}
