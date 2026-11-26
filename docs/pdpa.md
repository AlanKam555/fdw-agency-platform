# Personal data notes

This note describes how the product handles personal data. It is an operational summary for a Singapore employment agency demonstration. It is not legal advice under the Personal Data Protection Act 2012.

The public notice is `/privacy` and the machine-readable version is `lib/privacy/policy.ts` (`HL-PDPA-2026-11`).

## Consent and purpose

Forms that store personal data require a consent checkbox bound to the current notice version. A `ConsentRecord` stores the purpose:

- account creation
- application processing
- photo publication, only when the helper opts in
- employer requirement matching
- answering a contact enquiry

Photo consent is separate. The public gallery lists a profile only when status is available and photo consent is true. Seed portraits are generated illustrations, labelled fictional. A real upload is served only for a consented available profile.

## Purpose limitation

Data is collected to introduce helpers, arrange interviews, and prepare a Ministry of Manpower file. Marketing drafts use public profile facts. They do not receive passport numbers, FIN, NRIC, or medical notes. Matching does not receive religion, race, ethnicity, or pregnancy, because those fields do not exist.

## Retention and deletion

Defaults in `lib/privacy/policy.ts`:

- enquiries: 365 days
- rejected or withdrawn applications: 180 days
- active applications: 2 years
- deployed placements: 5 years
- audit log: 2 years

An administrator can redact a helper profile. Redaction deletes stored documents, wipes passport, FIN, and medical fields, clears contact details, and disables the linked account. The audit log records that the redaction happened without copying the wiped values.

## Security measures in the product

Passport numbers, FIN, NRIC, and medical notes are encrypted with AES-256-GCM before they are written. Document bytes are encrypted and stored in a private bucket (or a local directory in development). Downloads use a short-lived HMAC link or a staff session, and staff downloads are audited.

These controls support the PDPA security obligation. They do not replace a documented retention job, a data-protection officer, or a contract with the hosting provider. The retention windows above are policy constants. A scheduled deletion job is not included in this MVP and should be added before production use.
