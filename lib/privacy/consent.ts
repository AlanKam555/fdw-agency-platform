import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { embeddingContentHash, prepareEmbedText } from "@/lib/ai/embeddings";
import { knownEmbeddingModelNames } from "@/lib/ai/providers";
import { PDPA_VERSION } from "@/lib/validation/schemas";

export async function forgetEmbeddingText(texts: string[]) {
  const models = knownEmbeddingModelNames();
  const hashes = new Set<string>();
  for (const text of texts) {
    const prepared = prepareEmbedText(text);
    if (!prepared.text) continue;
    for (const model of models) hashes.add(embeddingContentHash(model, prepared.text));
  }
  if (!hashes.size) return;
  await prisma.embeddingCache.deleteMany({ where: { contentHash: { in: [...hashes] } } });
}

export async function changeConsent(input: {
  role: "CANDIDATE" | "EMPLOYER";
  userId: string;
  purpose: "photo_publication" | "marketing_publication" | "ai_processing";
  granted: boolean;
  ip: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (input.role === "EMPLOYER" && input.purpose === "photo_publication") {
    return { ok: false, error: "Households do not publish a portrait.", status: 400 };
  }
  if (input.role === "CANDIDATE") {
    const candidate = await prisma.candidate.findUnique({ where: { userId: input.userId } });
    if (!candidate || candidate.redactedAt) return { ok: false, error: "Profile not found.", status: 404 };
    const data: { photoConsent?: boolean; marketingConsent?: boolean; aiProcessingConsent?: boolean; publicBlurb?: string } = {};
    if (input.purpose === "photo_publication") data.photoConsent = input.granted;
    if (input.purpose === "marketing_publication") data.marketingConsent = input.granted;
    if (input.purpose === "ai_processing") data.aiProcessingConsent = input.granted;
    if (!input.granted && (input.purpose === "photo_publication" || input.purpose === "marketing_publication")) {
      data.publicBlurb = "";
    }
    await prisma.candidate.update({ where: { id: candidate.id }, data });
    if (!input.granted && (input.purpose === "photo_publication" || input.purpose === "marketing_publication")) {
      await prisma.marketingDraft.updateMany({
        where: { candidateId: candidate.id },
        data: { title: "Redacted draft", body: "Redacted.", cautions: "" },
      });
    }
    if (!input.granted && input.purpose === "ai_processing") {
      await forgetEmbeddingText([candidate.householdExperience, candidate.publicBlurb]);
    }
    await prisma.consentRecord.create({
      data: {
        subjectType: "Candidate",
        subjectId: candidate.id,
        candidateId: candidate.id,
        purpose: input.purpose,
        policyVersion: PDPA_VERSION,
        granted: input.granted,
        withdrawnAt: input.granted ? null : new Date(),
      },
    });
    await writeAudit({
      actorId: input.userId,
      action: input.granted ? "privacy.consent_grant" : "privacy.consent_withdraw",
      entityType: "Candidate",
      entityId: candidate.id,
      metadata: { purpose: input.purpose },
      ip: input.ip,
    });
    return { ok: true };
  }

  const employer = await prisma.employer.findUnique({ where: { userId: input.userId } });
  if (!employer || employer.redactedAt) return { ok: false, error: "Household not found.", status: 404 };
  await prisma.employer.update({
    where: { id: employer.id },
    data:
      input.purpose === "marketing_publication"
        ? { marketingConsent: input.granted }
        : { aiProcessingConsent: input.granted },
  });
  if (!input.granted && input.purpose === "ai_processing") {
    const requirements = await prisma.employerRequirement.findMany({
      where: { employerId: employer.id },
      select: { payload: true },
    });
    const notes = requirements.map((row) => {
      const payload = row.payload;
      if (payload && typeof payload === "object" && "householdNotes" in payload) {
        const value = (payload as { householdNotes?: unknown }).householdNotes;
        return typeof value === "string" ? value : "";
      }
      return "";
    });
    await forgetEmbeddingText([employer.notes, ...notes]);
  }
  await prisma.consentRecord.create({
    data: {
      subjectType: "Employer",
      subjectId: employer.id,
      purpose: input.purpose,
      policyVersion: PDPA_VERSION,
      granted: input.granted,
      withdrawnAt: input.granted ? null : new Date(),
    },
  });
  await writeAudit({
    actorId: input.userId,
    action: input.granted ? "privacy.consent_grant" : "privacy.consent_withdraw",
    entityType: "Employer",
    entityId: employer.id,
    metadata: { purpose: input.purpose },
    ip: input.ip,
  });
  return { ok: true };
}
