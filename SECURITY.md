# Security

Harbourlight stores identity documents and household details for a fictional Singapore foreign domestic worker agency. This file is the threat model for the MVP and the controls that are actually implemented.

## Assets

- Helper identity: name, contact, nationality, date of birth, passport number, FIN, education, medical notes, documents
- Employer identity: contact, household composition, optional NRIC, address area
- Session cookies and the field-encryption key
- Audit history of staff access

## Actors

- Visitors and applicants
- Employers with accounts
- Agency staff and administrators
- A hosting or database operator
- An attacker who can send HTTP requests, upload files, or paste text into an AI prompt

## Trust boundaries

The browser is untrusted. Applicant and employer free text is untrusted, including when a staff member pastes it into the marketing assistant. The language model is untrusted output: drafts stay in review until a person approves them, and approval does not publish to an external network. MOM portals are outside the product. Staff submit there themselves with Singpass or CorpPass.

## Threats and controls

| Threat | Control |
| --- | --- |
| Stolen database backup exposes passport, FIN, NRIC, or medical notes | AES-256-GCM before write (`lib/crypto/field-encryption.ts`). Key is `FIELD_ENCRYPTION_KEY`, 32 bytes, base64, only in the environment. |
| Document URL is guessed or leaked | Bytes are encrypted. Local or S3 objects are private. Access uses a short HMAC token or a staff session. Staff downloads are audited. |
| Cross-site form submission | Double-submit CSRF cookie plus an `Origin` check against `APP_URL` and the request host (http and https) when an origin is present. A browser cannot set `Host` independently of the URL it called, so an attacker page’s origin does not match. |
| Password guessing | bcrypt, generic login error, in-memory rate limit on login, register, applications, and uploads. |
| A helper or employer calls a staff API | `hasPermission` on every guarded route. Page layouts call `requireUser` with an explicit role list. `proxy.ts` redirects the wrong role away from `/dashboard`, `/employer`, and `/candidate`. |
| Mass assignment of religion or other undeclared fields | Zod `.strict()` on application and employer payloads. |
| Prompt injection in notes or blurbs | Free text is wrapped in `<untrusted_data>`, sensitive keys are rejected before a model call, `generateObject` uses a schema and no tools, and failures fall back to a labelled template. |
| Model uses a protected trait to rank someone | Those traits are absent from the schema and from the explanation payload. Ranking is deterministic code. See `docs/matching-fairness.md`. |
| Automated submission to MOM | Not implemented. The PDF says it is not a submission. |
| Staff action without a record | Audit log for status changes, ranking, decisions, sensitive reveals, uploads, drafts, MOM packs, user creation, and redaction. Metadata is stripped of document numbers. |
| Secret committed to git | `.env.example` only. CI uses dummy values. |

## Residual risk

- The rate limiter is process memory. A multi-instance deployment needs a shared store such as Redis. Restarting the server clears buckets.
- Content-Security-Policy allows inline scripts so the Next.js runtime can boot. Development also allows `unsafe-eval`, which React's dev tooling needs. Production does not. A nonce-based policy is the production follow-up.
- Login does not reveal whether an email exists. Registration does, so an attacker can probe addresses on the public register form.
- Retention windows are documented and redaction is manual. There is no scheduled deletion job yet.
- S3 is required for durable documents on Vercel. The local driver writes to disk, which disappears on a serverless restart.
- Public holiday dates for the Settling-in Programme are an empty operator list.
- MOM rule numbers must be re-checked against the pages cited in `docs/mom-rules.md` before a real filing.
- Seed accounts share a published development password. Do not deploy the seed to production.
- In-memory sessions are signed but not revocable individually, except by disabling the user, which `requireUser` checks on the next page load. API routes trust the signed cookie until it expires, so a disabled user can still call an API until the cookie expires. Disablement should be checked in `guardRequest` before production.
- The AI provider sees the explanation facts and the public marketing brief. Usage rows store provider, model, token counts, and an estimated cost. They do not store the prompt. Do not point the provider at a log store that retains prompts without a contract.
- The admin settings page lists whether a provider key is present. It does not render the key. Keys are read from the server environment only.
- Advertisement compliance is a deterministic check. Text inside a draft cannot turn the check off. Staff still approve every draft, and approval does not publish it.
- Agency name, colours, and MOM numbers are configuration. A wrong number in the environment is still the operator's filing risk.

## Reporting

Please report a vulnerability privately through [GitHub Security Advisories](https://github.com/AlanKam555/maid-agency-platform/security/advisories/new). Do not open a public issue, and do not include exploit detail, keys, or personal data in a public place. If the advisory form is unavailable, write to the repository owner without posting the details in a commit or an issue.
