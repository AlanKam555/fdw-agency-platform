import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/field-encryption";

function reveal(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decryptString(value);
  } catch {
    return "";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type ExportBundle = {
  exportedAt: string;
  subjectType: "candidate" | "employer";
  profile: Record<string, unknown>;
  consents: unknown[];
  documents: unknown[];
  matches: unknown[];
  interviews: unknown[];
  outcomes: unknown[];
};

export async function buildSubjectExport(input: {
  subjectType: "candidate" | "employer";
  subjectId: string;
}): Promise<ExportBundle | null> {
  const exportedAt = new Date().toISOString();
  if (input.subjectType === "candidate") {
    const candidate = await prisma.candidate.findUnique({
      where: { id: input.subjectId },
      include: {
        documents: { select: { id: true, kind: true, fileName: true, createdAt: true } },
        consents: true,
        matches: { select: { id: true, score: true, eligible: true, decision: true, explanation: true, createdAt: true } },
        interviews: { select: { id: true, status: true, preferredWindow: true, createdAt: true } },
        placementOutcomes: {
          select: {
            id: true,
            completion: true,
            reasonCategory: true,
            durationDays: true,
            notes: true,
            createdAt: true,
          },
        },
      },
    });
    if (!candidate) return null;
    return {
      exportedAt,
      subjectType: "candidate",
      profile: {
        id: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        nationality: candidate.nationality,
        dateOfBirth: candidate.dateOfBirth.toISOString(),
        sex: candidate.sex,
        skills: candidate.skills,
        languages: candidate.languages,
        salaryExpectationSgd: candidate.salaryExpectationSgd,
        householdExperience: candidate.householdExperience,
        publicBlurb: candidate.publicBlurb,
        photoConsent: candidate.photoConsent,
        marketingConsent: candidate.marketingConsent,
        aiProcessingConsent: candidate.aiProcessingConsent,
        status: candidate.status,
        passportNumber: reveal(candidate.passportNumberEnc),
        fin: reveal(candidate.finEnc),
        medicalNotes: reveal(candidate.medicalNotesEnc),
      },
      consents: candidate.consents,
      documents: candidate.documents,
      matches: candidate.matches,
      interviews: candidate.interviews,
      outcomes: candidate.placementOutcomes,
    };
  }
  const employer = await prisma.employer.findUnique({
    where: { id: input.subjectId },
    include: {
      requirements: { select: { id: true, title: true, payload: true, createdAt: true } },
      interviews: { select: { id: true, status: true, preferredWindow: true, createdAt: true } },
      matches: { select: { id: true, score: true, eligible: true, decision: true, explanation: true, createdAt: true } },
      placementOutcomes: {
        select: { id: true, completion: true, reasonCategory: true, durationDays: true, notes: true, createdAt: true },
      },
    },
  });
  if (!employer) return null;
  const documents = await prisma.document.findMany({
    where: { employerId: employer.id },
    select: { id: true, kind: true, fileName: true, createdAt: true },
  });
  const consents = await prisma.consentRecord.findMany({
    where: { subjectType: "Employer", subjectId: employer.id },
  });
  return {
    exportedAt,
    subjectType: "employer",
    profile: {
      id: employer.id,
      fullName: employer.fullName,
      email: employer.email,
      phone: employer.phone,
      householdSize: employer.householdSize,
      childrenCount: employer.childrenCount,
      elderlyCount: employer.elderlyCount,
      addressArea: employer.addressArea,
      housingType: employer.housingType,
      notes: employer.notes,
      marketingConsent: employer.marketingConsent,
      aiProcessingConsent: employer.aiProcessingConsent,
      nric: reveal(employer.nricEnc),
    },
    consents,
    documents,
    matches: employer.matches,
    interviews: employer.interviews,
    outcomes: employer.placementOutcomes,
  };
}

export function exportHtml(bundle: ExportBundle): string {
  const lines = JSON.stringify(bundle, null, 2);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Personal data export</title></head><body><h1>Personal data export</h1><p>This file is your copy of the data Harbourlight holds for this account. It is not legal advice.</p><pre>${escapeHtml(lines)}</pre></body></html>`;
}

export async function exportPdf(bundle: ExportBundle): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const text = JSON.stringify(bundle, null, 2);
  const chunks = text.match(/[\s\S]{1,1400}/g) ?? [text];
  for (const chunk of chunks.slice(0, 40)) {
    const page = pdf.addPage([595, 842]);
    const lines = chunk.split("\n").slice(0, 48);
    lines.forEach((line, index) => {
      const safe = line.replace(/[^\x20-\x7E]/g, "?");
      page.drawText(safe.slice(0, 90), { x: 40, y: 800 - index * 14, size: 9, font });
    });
  }
  return pdf.save();
}
