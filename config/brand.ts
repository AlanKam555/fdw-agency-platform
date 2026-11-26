export type Personnel = { name: string; registrationNo: string };

const DEMO_PERSONNEL: Personnel[] = [
  { name: "Amina Rahim", registrationNo: "R1100001" },
  { name: "Jun Wei Lim", registrationNo: "R1100002" },
];

function personnelFromEnv(): Personnel[] | null {
  const raw = process.env.AGENCY_PERSONNEL?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const people = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const registrationNo = typeof record.registrationNo === "string" ? record.registrationNo.trim() : "";
      if (!name || !registrationNo) return [];
      return [{ name, registrationNo }];
    });
    return people.length ? people : null;
  } catch {
    return null;
  }
}

const configuredName = process.env.AGENCY_NAME?.trim() || "";

export const brand = {
  name: configuredName || "Harbourlight",
  legalName: process.env.AGENCY_LEGAL_NAME?.trim() || "Harbourlight Agency Pte. Ltd.",
  city: process.env.AGENCY_CITY?.trim() || "Singapore",
  phone: process.env.AGENCY_PHONE?.trim() || "+65 6000 0148",
  email: process.env.AGENCY_EMAIL?.trim() || "hello@harbourlight.example",
  address: process.env.AGENCY_ADDRESS?.trim() || "18 Circular Road, Singapore 049379",
  licenceNo: process.env.AGENCY_LICENCE_NO?.trim() || "00C0000",
  personnel: personnelFromEnv() ?? DEMO_PERSONNEL,
  logoUrl: process.env.AGENCY_LOGO_URL?.trim() || "",
  primary: process.env.AGENCY_PRIMARY_COLOUR?.trim() || "#0e3b37",
  accent: process.env.AGENCY_ACCENT_COLOUR?.trim() || "#a86432",
  paper: process.env.AGENCY_PAPER_COLOUR?.trim() || "#f3ecdf",
  locales: (process.env.AGENCY_LOCALES?.split(",").map((item) => item.trim()).filter(Boolean) ?? [
    "en",
    "zh",
    "ms",
    "ta",
    "tl",
    "id",
    "my",
  ]),
  /** True when the operator has not set AGENCY_NAME. The seeded Harbourlight records are a demo. */
  fictionalDemo: configuredName.length === 0,
  voice: process.env.AGENCY_BRAND_VOICE?.trim() || "Calm, specific, and respectful. Talk about the job, not the person as a product.",
};

export const licenceLine = `EA licence ${brand.licenceNo}${brand.fictionalDemo ? " (fictional — not a real licence)" : ""}`;

export const DISCLAIMER =
  "This software is not legal advice. Operators must verify Ministry of Manpower rules against current guidance, and must comply with the Personal Data Protection Act and the Employment Agencies Act, including licence conditions on advertising. The product does not submit Work Permit applications.";
