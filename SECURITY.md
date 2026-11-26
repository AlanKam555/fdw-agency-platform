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

- The default rate limiter is process memory. Set `RATE_LIMIT_DRIVER=upstash` or `RATE_LIMIT_DRIVER=redis` for a shared store. If that store errors, the process falls back to its own memory for that request so an outage does not remove the local limit. Restarting a process still clears its memory buckets.
- Content-Security-Policy is issued per request with a script nonce. Production `script-src` is `'self'`, the nonce, and `strict-dynamic`. It does not allow `unsafe-inline` or `unsafe-eval`. Browsers that understand `strict-dynamic` ignore `'self'` and trust scripts loaded by a nonced script. `style-src-elem` uses the same nonce. `style-src-attr` still allows inline style attributes for the brand colour variables. Development adds `unsafe-eval` for React's dev tooling. `upgrade-insecure-requests` is sent only when `APP_URL` is https.
- Login returns a generic error. Public registration and the public helper application return the same acknowledgement whether or not the email already exists, and registration does not set a session cookie. Creating a new row still takes slightly longer than the duplicate path, so a careful timing measurement can remain. Staff APIs can still say that an email is taken, because those routes require a staff session.
- Retention windows are in `lib/privacy/policy.ts`. `GET /api/cron/retention` reports due counts. It redacts due helper profiles and deletes due enquiries only when `RETENTION_ENFORCE=true`, and it deletes aged audit rows only when `RETENTION_PURGE_AUDIT=true` as well. Nothing runs until an external scheduler calls the route. The windows are policy defaults, not a legal determination.
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

Report a vulnerability privately through GitHub private vulnerability reporting on this repository: [open a security advisory](https://github.com/AlanKam555/fdw-agency-platform/security/advisories/new). Do not open a public issue, and do not include exploit detail, keys, or personal data in a public place. If the advisory form is unavailable, write to the repository owner without posting the details in a commit or an issue. Enable Settings → Advanced Security → Private vulnerability reporting if the form is not shown.
