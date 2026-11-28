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
| Document URL is guessed or leaked | S3 objects are private, use random keys, and use SSE-S3 or SSE-KMS. A staff session or a short HMAC token is checked first. The browser then gets a presigned GET that lasts at most five minutes. Every download is audited. The local driver encrypts with AES-256-GCM and is refused in production unless `ALLOW_LOCAL_STORAGE=true`. |
| Cross-site form submission | Double-submit CSRF cookie plus an `Origin` check against `APP_URL` and the request host (http and https) when an origin is present. A browser cannot set `Host` independently of the URL it called, so an attacker page’s origin does not match. |
| Password guessing | bcrypt, one generic login error, a per-account and per-IP lockout on the configured rate-limit store, and a separate request cap on login, register, applications, and uploads. |
| A helper or employer calls a staff API | `hasPermission` on every guarded route. The role comes from the database. Page layouts call `requireUser` with an explicit role list. `proxy.ts` redirects the wrong role away from `/dashboard`, `/employer`, and `/candidate`. |
| Mass assignment of religion, internal notes, or medical status on the public application | The public schema omits staff-only fields and rejects unknown keys. The staff intake schema is separate. |
| Prompt injection in notes or blurbs | Free text is wrapped in `<untrusted_data>`, sensitive keys are rejected before a model call, `generateObject` uses a schema and no tools, and failures fall back to a labelled template. |
| Model uses a protected trait to rank someone | Those traits are absent from the schema and from the explanation payload. Ranking is deterministic code. See `docs/matching-fairness.md`. |
| Automated submission to MOM | Not implemented. The PDF says it is not a submission. |
| A stolen cookie keeps working after disablement or a password change | The cookie is checked against a `Session` row. Disablement, password change, logout, and "sign out everywhere" revoke it immediately. |
| Staff action without a record | Audit log for status changes, ranking, decisions, sensitive reveals, uploads, downloads, drafts, MOM packs, user creation, lockouts, session revocation, and redaction. Metadata is stripped of document numbers, tokens, and TOTP material. |
| Secret committed to git | `.env.example` only. CI uses dummy values. |
| Staff account without a second factor | TOTP is required for staff and admin after `MFA_GRACE_DAYS`. The secret is AES-256-GCM. Recovery codes are single-use HMAC hashes. A used time step cannot be reused. |

## Residual risk

- The default rate limiter is process memory. Lockout uses the same store. Set `RATE_LIMIT_DRIVER=upstash` or `RATE_LIMIT_DRIVER=redis` for a shared store. If that store errors, the process falls back to its own memory for that request so an outage does not remove the local limit. Restarting a process still clears its memory counters. An account lock follows the email hash, so many IPs can lock one account. An IP lock can also slow a shared network.
- Content-Security-Policy is issued per request with a script nonce. Production `script-src` is `'self'`, the nonce, and `strict-dynamic`. Style elements use the same nonce. Style attributes are `'none'`. There is no `unsafe-inline`. Development adds `unsafe-eval` for React's dev tooling. `upgrade-insecure-requests` is sent only when `APP_URL` is https.
- Login returns a generic error, including while an account is locked. `Retry-After` can still differ between a locked attempt and a wrong password. Public registration and the public helper application return the same acknowledgement whether or not the email already exists, and registration does not set a session cookie. Creating a new row still takes slightly longer than the duplicate path, so a careful timing measurement can remain. Staff APIs can still say that an email is taken, because those routes require a staff session.
- Staff and admin have `MFA_GRACE_DAYS` (default 7) before TOTP is enforced. During that window a password is enough. A five-minute presigned download URL is a bearer for anyone who obtains it before it expires. Expired session rows are ignored and are not purged on a schedule.
- The local driver encrypts files in the application. The S3 driver stores plaintext bytes protected by SSE-S3 or SSE-KMS. Those are different mechanisms. A bucket without Block Public Access, or an object ACL that makes it public, would expose the S3 copy. Leave the bucket private.
- Retention windows are in `lib/privacy/policy.ts`. `GET /api/cron/retention` reports due counts. It redacts due helper profiles and deletes due enquiries only when `RETENTION_ENFORCE=true`, and it deletes aged audit rows only when `RETENTION_PURGE_AUDIT=true` as well. Nothing runs until an external scheduler calls the route. The windows are policy defaults, not a legal determination.
- `npm run secrets:generate` replaces the old published encryption key. Production refuses that key, short secrets, and the old Compose defaults. See [docs/secrets.md](docs/secrets.md).
- CI accepts two high advisories that arrive through Prisma 6's bundled config parser (`effect` GHSA-7589-6fvf-x4pw and `deepmerge-ts` GHSA-ggr8-5vv4-36mx). The request path uses the generated client, not that parser. Moving to Prisma 7 drops them and is a separate migration. `undici` is pinned to 6.29.1 so the AI SDK's HTTP client is not on the vulnerable 5.x line.
- Public holidays for 2025, 2026, and 2027 are transcribed from the [MOM public holidays page](https://www.mom.gov.sg/employment-practices/public-holidays) on 2026-11-26. A Monday is included when MOM says that Monday is a holiday if the rest day falls on the Sunday. Deadline maths treats both days as holidays. 2027 lunar dates can move when they are gazetted and must be re-checked. Staff additions and suppressions are audit-logged.
- MOM catalog numbers are unchanged and still need a person to re-read the cited pages. The rules screen shows “Needs verification” until an admin marks a row, and it shows a stale warning after `MOM_RULE_STALE_DAYS` (default 90). An override requires a source URL and a note. Neither the catalog nor an override is a filing.
- Reminder email is a dry run unless `REMINDERS_SEND=true`. A type opt-in or a per-reminder approval is also required. Unsubscribe links are signed and expire. Opening the link does not unsubscribe; the confirmation form does. Delivery rows store a hash, not the address, and logs omit the address, subject, and body. The send cap uses the same rate-limit store as sign-in, so it is per process until a shared store is configured. Rebuilding a MOM pack creates new reminder rows, which can send again. Helper mail stays off unless `REMINDER_INCLUDE_HELPER=true`. A database error can still include row data in the process log; the application logger does not add it.
- Placement notes are staff-only. Helper satisfaction is stored for the fairness audit and does not by itself change weights. Outcome groups by nationality warn below five rows. Nationality, religion, race, and pregnancy are not score inputs.
- Seed accounts share a published development password. Do not deploy the seed to production. Demo staff sign in with that password and are asked to add an authenticator. No TOTP secret is stored in the seed.
- The AI provider sees the explanation facts and the public marketing brief. Usage rows store provider, model, token counts, and an estimated cost. They do not store the prompt. Do not point the provider at a log store that retains prompts without a contract.
- The admin settings page lists whether a provider key is present. It does not render the key. Keys are read from the server environment only.
- Advertisement compliance is a deterministic check. Text inside a draft cannot turn the check off. Staff still approve every draft, and approval does not publish it.
- Agency name, colours, and MOM numbers are configuration. A wrong number in the environment is still the operator's filing risk.

## Reporting

Report a vulnerability privately through GitHub private vulnerability reporting on this repository: [open a security advisory](https://github.com/AlanKam555/fdw-agency-platform/security/advisories/new). Do not open a public issue, and do not include exploit detail, keys, or personal data in a public place. If the advisory form is unavailable, write to the repository owner without posting the details in a commit or an issue. Enable Settings → Advanced Security → Private vulnerability reporting if the form is not shown.
