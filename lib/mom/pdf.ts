import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { MomRules } from "@/config/mom-rules";
import type { ChecklistItem } from "@/lib/mom/checklist";

export type PdfSummary = {
  agencyName: string;
  helperName: string;
  employerName: string;
  generatedOn: string;
  ready: boolean;
  items: ChecklistItem[];
  rules: MomRules;
};

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderMomPdf(summary: PdfSummary): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;

  const ensure = (needed: number) => {
    if (y < needed) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
  };

  const draw = (text: string, size: number, face = font, color = rgb(0.1, 0.14, 0.13)) => {
    for (const line of wrap(text, size > 12 ? 70 : 92)) {
      ensure(40);
      page.drawText(line, { x: 48, y, size, font: face, color });
      y -= size + 4;
    }
  };

  draw(summary.agencyName, 16, bold, rgb(0.05, 0.23, 0.22));
  draw("MOM work permit preparation pack — not a submission", 12, bold);
  y -= 6;
  draw(`Helper: ${summary.helperName}`, 11);
  draw(`Employer: ${summary.employerName}`, 11);
  draw(`Generated: ${summary.generatedOn}`, 11);
  draw(
    summary.ready
      ? "Pre-submission checks have no failing or outstanding attestation items. Staff still submit via WP Online."
      : "Outstanding items remain. Do not treat this pack as ready to lodge.",
    11,
    bold,
  );
  y -= 8;
  draw(
    `Rule values were transcribed ${summary.rules.meta.lastTranscribed}, catalog checked ${summary.rules.meta.verifiedOn}, and are flagged: ${summary.rules.meta.verificationStatus}.`,
    10,
  );
  y -= 8;

  for (const item of summary.items) {
    ensure(72);
    draw(`${item.status.toUpperCase()} — ${item.label}`, 11, bold);
    draw(item.detail, 10);
    draw(item.sourceUrl, 8, font, rgb(0.2, 0.3, 0.35));
    y -= 6;
  }

  y -= 8;
  draw(
    "This document was prepared by agency staff tools. It does not lodge an application with the Ministry of Manpower. Singpass and CorpPass submission stays with the employer or an authorised staff member.",
    10,
    bold,
  );

  doc.setTitle("MOM work permit preparation pack");
  doc.setAuthor(summary.agencyName);
  return doc.save();
}
