export type ComplianceIssue = {
  code: "missing_licence" | "missing_personnel" | "commodity_language" | "demeaning_language";
  detail: string;
};

const COMMODITY =
  /\b(discount|on sale|for sale|promo|promotion|cheap maid|maid for sale|buy a maid|package deal|special offer)\b|折扣|大减价|diskaun|diskwento|harga promo|လျှော့စျေး/i;

const DEMEANING =
  /\b(sexy|beautiful body|young and pretty|docile|obedient girl|slave|product for the home)\b/i;

export function checkAdvertisement(input: {
  body: string;
  licenceNo: string;
  personnelNumbers: string[];
}): { ok: boolean; blocking: ComplianceIssue[] } {
  const blocking: ComplianceIssue[] = [];
  const body = input.body;
  const licence = input.licenceNo.trim();
  if (!licence || !body.includes(licence)) {
    blocking.push({
      code: "missing_licence",
      detail: "The draft must show the EA licence number. MOM licence conditions require it on advertisements.",
    });
  }
  const numbers = input.personnelNumbers.map((value) => value.trim()).filter(Boolean);
  if (numbers.length === 0 || !numbers.some((number) => body.includes(number))) {
    blocking.push({
      code: "missing_personnel",
      detail: "The draft must show at least one EA personnel registration number.",
    });
  }
  if (COMMODITY.test(body)) {
    blocking.push({
      code: "commodity_language",
      detail: "Discount, sale, or promotional wording treats a helper as a product. Remove it.",
    });
  }
  if (DEMEANING.test(body)) {
    blocking.push({
      code: "demeaning_language",
      detail: "The draft uses objectifying or demeaning wording. Rewrite it around skills and the job.",
    });
  }
  return { ok: blocking.length === 0, blocking };
}

export function complianceFooter(input: {
  agencyName: string;
  licenceNo: string;
  personnel: { name: string; registrationNo: string }[];
  fictional?: boolean;
}): string {
  const people = input.personnel
    .map((person) => `${person.name} ${person.registrationNo}${input.fictional ? " (fictional registration)" : ""}`)
    .join("; ");
  const licenceNote = input.fictional ? " (fictional — not a real licence)" : "";
  return `${input.agencyName} EA licence ${input.licenceNo}${licenceNote}. Personnel: ${people}. This introduces household employment. It is not an offer to sell or discount a person.`;
}

export function withComplianceFooter(
  body: string,
  footer: string,
): string {
  if (body.includes("EA licence")) return body;
  return `${body.trim()}\n\n${footer}`;
}
