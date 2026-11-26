import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardRequest, json } from "@/lib/http/api";
import {
  detectFileType,
  MAX_UPLOAD_BYTES,
  saveEncryptedObject,
} from "@/lib/storage/files";
import type { DocumentKind } from "@prisma/client";

const KINDS: DocumentKind[] = [
  "PASSPORT",
  "EDUCATIONAL_CERTIFICATE",
  "MEDICAL",
  "PHOTO",
  "EMPLOYER_NRIC",
  "OTHER",
];

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const payload = { csrf: String(form.get("csrf") ?? "") };
  const guard = guardRequest(req, payload, {
    limit: { key: "upload", max: 20, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  if (!guard.session) return json({ error: "Sign in required." }, 401);

  const kind = String(form.get("kind") ?? "");
  if (!KINDS.includes(kind as DocumentKind)) return json({ error: "Unknown document type." }, 400);
  const candidateId = String(form.get("candidateId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a file." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "Files must be 5 MB or smaller." }, 400);

  const candidate = candidateId
    ? await prisma.candidate.findUnique({ where: { id: candidateId } })
    : null;
  if (candidateId && !candidate) return json({ error: "Profile not found." }, 404);

  const staff = guard.session.role === "ADMIN" || guard.session.role === "STAFF";
  const own =
    guard.session.role === "CANDIDATE" &&
    candidate?.userId === guard.session.sub &&
    ["PASSPORT", "EDUCATIONAL_CERTIFICATE", "PHOTO"].includes(kind);
  if (!staff && !own) return json({ error: "Forbidden." }, 403);
  if (kind === "PHOTO" && candidate && !candidate.photoConsent) {
    return json({ error: "Photo consent is required before a portrait can be stored." }, 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectFileType(bytes);
  if (!detected) return json({ error: "Upload a PDF, JPEG, or PNG." }, 400);
  const stored = await saveEncryptedObject(bytes);
  const document = await prisma.document.create({
    data: {
      candidateId: candidate?.id,
      kind: kind as DocumentKind,
      fileName: file.name.slice(0, 120),
      contentType: detected.contentType,
      byteSize: bytes.length,
      storageKey: stored.storageKey,
      sha256: stored.sha256,
      uploadedById: guard.session.sub,
    },
  });
  await writeAudit({
    actorId: guard.session.sub,
    action: "document.upload",
    entityType: "Document",
    entityId: document.id,
    metadata: { kind, candidateId: candidate?.id ?? null, contentType: detected.contentType },
    ip: guard.ip,
  });
  return json({ ok: true, id: document.id });
}
