const DEMO_LICENCE = "00C0000";
const DEMO_PHONE = "+65 6000 0148";
const DEMO_EMAIL = "hello@harbourlight.example";
const DEMO_ADDRESS = "18 Circular Road, Singapore 049379";

export type AgencyStructuredInput = {
  fictionalDemo: boolean;
  name: string;
  legalName: string;
  url: string;
  phone: string;
  email: string;
  address: string;
  licenceNo: string;
};

/**
 * EmploymentAgency JSON-LD for a configured operator.
 * The fictional Harbourlight deployment publishes nothing: the address, phone,
 * email, and licence on that deployment are placeholders.
 */
export function employmentAgencyJsonLd(input: AgencyStructuredInput): Record<string, unknown> | null {
  if (input.fictionalDemo) return null;
  const name = input.legalName.trim() || input.name.trim();
  if (!name) return null;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "EmploymentAgency",
    name,
    areaServed: "Singapore",
  };
  const url = input.url.trim();
  if (url.startsWith("https://") || url.startsWith("http://")) data.url = url;
  if (input.address.trim() && input.address.trim() !== DEMO_ADDRESS) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: input.address.trim(),
      addressCountry: "SG",
    };
  }
  if (input.phone.trim() && input.phone.trim() !== DEMO_PHONE) data.telephone = input.phone.trim();
  if (input.email.trim() && input.email.trim() !== DEMO_EMAIL) data.email = input.email.trim();
  if (input.licenceNo.trim() && input.licenceNo.trim() !== DEMO_LICENCE) {
    data.identifier = input.licenceNo.trim();
  }
  return data;
}
