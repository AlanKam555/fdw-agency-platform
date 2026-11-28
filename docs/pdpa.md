# Personal data notes

This note describes how the product handles personal data. It is an operational summary for a Singapore employment agency demonstration. It is not legal advice under the Personal Data Protection Act 2012.

The public notice is `/privacy` and the machine-readable version is `lib/privacy/policy.ts` (`HL-PDPA-2026-11`).

## Consent and purpose

Forms that store personal data require a consent checkbox bound to the current notice version. A `ConsentRecord` stores the purpose:

- account creation
- application processing
- photo publication, only when the helper opts in to both the portrait and marketing use
- employer requirement matching
- answering a contact enquiry
- AI processing of experience or household text, only when that person opts in

Photo consent and marketing consent are separate. The public gallery lists a profile only when status is available, photo consent is true, marketing consent is true, and the profile is not redacted. Seed portraits are generated illustrations, labelled fictional. A real upload is served only for a consented available profile.

A helper or employer can withdraw consent on their privacy page. Withdrawal writes a new consent row. It does not rewrite the old one. Photo or marketing withdrawal clears the public blurb and takes the portrait off the gallery. AI withdrawal stops new embeddings of the current text. A provider that already stored a prompt is outside this app.

The same privacy page downloads a JSON, HTML, or PDF copy after the person enters their password again. Staff can generate that file with a reason. Downloads are rate-limited and audited. The file does not include password hashes, authenticator secrets, or session tokens.

## Purpose limitation

Data is collected to introduce helpers, arrange interviews, and prepare a Ministry of Manpower file. Marketing drafts use public profile facts. They do not receive passport numbers, FIN, NRIC, or medical notes. Matching does not receive religion, race, ethnicity, or pregnancy, because those fields do not exist.

## Retention and deletion

Defaults in `lib/privacy/policy.ts`:

- enquiries: 365 days
- an application that is still only submitted: 90 days
- rejected or withdrawn applications: 180 days
- other applications that are not deployed: 2 years
- deployed placements: 5 years
- households with no placement record: 2 years
- households with a placement record: 5 years
- marketing drafts: 365 days
- unanswered testimonial requests: 90 days
- expired or revoked sessions: 30 days
- embedding cache: 7 days, including on a dry run
- audit log: 2 years

An administrator can redact a helper profile or a household. Redaction clears direct identifiers, notes, draft text, match explanations, and outcome notes. Match scores and placement category codes stay so the fairness audit still has non-identifying counts. Documents are deleted from the object store, or the key is queued when the delete fails. The audit log records that the redaction happened without copying the wiped values.

A helper or employer can download their own copy from the privacy page. See [incident-response.md](incident-response.md) for the breach clock. Verify those timings against current PDPC guidance.

## Security measures in the product

Passport numbers, FIN, NRIC, and medical notes are encrypted with AES-256-GCM before they are written. Document bytes are stored in a private bucket (or a local directory in development). Staff downloads require a reason and a short-lived link. Reveals and downloads are audited and quota-limited.

These controls support the PDPA security obligation. They do not replace a data-protection officer or a contract with the hosting provider. The retention windows above are policy constants, not legal advice.

`GET /api/cron/retention` is the scheduled job. It is a dry run until `RETENTION_ENFORCE=true`. See [retention.md](retention.md).
