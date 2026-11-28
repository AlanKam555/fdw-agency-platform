const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+65[\s-]?)?[3689]\d{7}\b/g;
const NRIC = /\b[STFGM]\d{7}[A-Z]\b/gi;
const PASSPORT = /\b[A-Z]{1,2}\d{7,9}\b/g;

/** On unless AI_PII_MINIMISATION is exactly "false". */
export function piiMinimisationEnabled(): boolean {
  return process.env.AI_PII_MINIMISATION !== "false";
}

/**
 * Strips emails, Singapore phone numbers, NRIC/FIN, and passport-like tokens.
 * Licence numbers such as 00C0000 and dates are left alone.
 */
export function minimisePii(input: string): string {
  if (!piiMinimisationEnabled() || !input) return input;
  return input
    .replace(EMAIL, "[redacted]")
    .replace(PHONE, "[redacted]")
    .replace(NRIC, "[redacted]")
    .replace(PASSPORT, "[redacted]");
}
