# fdw-agency-platform

[![CI](https://github.com/AlanKam555/fdw-agency-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/AlanKam555/fdw-agency-platform/actions/workflows/ci.yml)
[![CodeQL](https://github.com/AlanKam555/fdw-agency-platform/actions/workflows/codeql.yml/badge.svg)](https://github.com/AlanKam555/fdw-agency-platform/actions/workflows/codeql.yml)
[![Secret scan](https://github.com/AlanKam555/fdw-agency-platform/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/AlanKam555/fdw-agency-platform/actions/workflows/secret-scan.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Open-source workspace for a Singapore employment agency that places foreign domestic workers. It includes a public marketing site, helper applications, employer shortlists and interviews, explainable matching, a staff desk, and a MOM work-permit checklist with reminders and a PDF. It does not sign in to Singpass or CorpPass, and it does not submit an application.

The public name, EA licence number, colours, logo, locales, and MOM rule values come from environment variables. **Harbourlight**, licence `00C0000`, and the seeded people are a fictional demo used when those variables are empty.

This software is not legal advice. Operators must verify Ministry of Manpower rules and comply with the Personal Data Protection Act and the Employment Agencies Act. See the [disclaimer](app/disclaimer/page.tsx).

## Quick start

Use Node.js 22 and PostgreSQL 16. Every value in [`.env.example`](.env.example) is empty or a documented local placeholder.

### Docker

```bash
docker compose up --build
```

Open http://localhost:3000. Postgres keeps its data in the `pgdata` volume. Compose runs migrations in a separate `migrate` service before the app starts. The app container does not migrate on startup. See [docs/deploy.md](docs/deploy.md). Compose starts a private MinIO bucket for documents. The image is a Chainguard MinIO build, because `minio/minio` is no longer anonymously pullable. To load the fictional Harbourlight accounts as well:

```bash
SEED_DEMO=true docker compose up --build
```

Do not set `SEED_DEMO=true` on a database that holds real people. The demo password is `Harbourlight-Dev-1`.

### Local

```bash
cp .env.example .env
# Set DATABASE_URL if Postgres is not on localhost:5432.
# Generate a real AUTH_SECRET and FIELD_ENCRYPTION_KEY before any shared deploy:
#   openssl rand -base64 32
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run demo` is the same migrate-and-seed step. Open http://localhost:3000.

| Email | Role |
| --- | --- |
| admin@harbourlight.example | Admin |
| staff@harbourlight.example | Staff |
| employer@harbourlight.example | Employer |
| candidate@harbourlight.example | Helper |

`BCRYPT_COST=4` is acceptable for local and CI. Use 12 in a deployed environment.

A click-by-click tour of the demo is in [docs/demo.md](docs/demo.md). There is no hosted screenshot gallery: the theme is white-label, so run the demo and follow that tour.

## What it does

- Public pages: home, services, care-need pages, journal, consented helper gallery, stories, FAQ, contact, helper application, employer brief, privacy notice, disclaimer
- Accounts for admin, staff, employer, and helper, with a permission check on every staff and portal API
- Status pipeline: applied, screened, available, matched, MOM submitted, approved, deployed, plus rejected and withdrawn
- Explainable matching: tunable weights, what-if, comparison, care needs, transfer and returning helpers, feedback suggestions, and a nationality fairness audit. Protected traits are not collected
- Marketing drafts for several channels and seven languages, campaign slots, UTM links, a funnel count, and testimonial requests. A compliance check blocks approval when the licence number, a personnel number, or prohibited wording is missing. Nothing is posted to a social network
- AI providers: OpenAI, Anthropic, Google, xAI, Mistral, Groq, DeepSeek, Azure OpenAI, Amazon Bedrock, OpenRouter, and an OpenAI-compatible endpoint. Each feature has an ordered fallback. Usage is logged without the prompt text
- MOM checklist, reminders, and PDF. No Singpass or CorpPass automation

Fairness rules are in [docs/matching-fairness.md](docs/matching-fairness.md). MOM citations are in [docs/mom-rules.md](docs/mom-rules.md). Personal data handling is in [docs/pdpa.md](docs/pdpa.md). The threat model is in [SECURITY.md](SECURITY.md). The layout of the code is in [docs/architecture.md](docs/architecture.md).

## Stack

Next.js App Router, TypeScript, Tailwind, Prisma, PostgreSQL, Zod, and the Vercel AI SDK. Auth is a signed cookie so the app runs without an identity provider. The session shape is documented in [docs/auth.md](docs/auth.md) so it can be swapped for Clerk.

AI drafts and match explanations use a labelled template until a provider key in `.env.example` is set. `AI_MARKETING_PROVIDERS`, `AI_EXPLANATION_PROVIDERS`, and `AI_EMBEDDING_PROVIDERS` are comma-separated fallback lists. The admin settings page shows which providers are configured and never shows a key.

The rate limiter defaults to process memory. Set `RATE_LIMIT_DRIVER` to `upstash` or `redis` when you run more than one instance. See `.env.example`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests expect `DATABASE_URL`, `AUTH_SECRET`, and `FIELD_ENCRYPTION_KEY`. GitHub Actions starts PostgreSQL and runs `npm audit --omit=dev --audit-level=high`, lint, typecheck, tests, and the production build. A second job generates fresh secrets, then runs `npm run test:e2e` against that build, Postgres, and MinIO, and uploads the Playwright report if the job fails. A third job builds the image, scans it with Trivy, and uploads a CycloneDX SBOM. CodeQL and gitleaks run as separate workflows. The CI permission is `contents: read`.

`npm run test:e2e` starts the production server. Set `CRON_SECRET`, point storage at a private bucket, and seed the Harbourlight demo first. The demo accounts are not pre-enrolled in TOTP.

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AlanKam555/fdw-agency-platform&env=DATABASE_URL,AUTH_SECRET,FIELD_ENCRYPTION_KEY,APP_URL,CRON_SECRET&project-name=fdw-agency-platform&repository-name=fdw-agency-platform)

1. Create a Vercel project from this repository and a managed Postgres database (Neon, Supabase, or Vercel Postgres).
2. Set the environment variables from `.env.example`. Run `npm run secrets:generate` and set `AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET`, and `TOTP_ENCRYPTION_KEY`. Use `BCRYPT_COST=12`. Leave every AI key empty until you choose a provider. Run `npx prisma migrate deploy` before the new app, not inside the request process.
3. Set `APP_URL` to the production https origin. CSRF checks compare the request origin with `APP_URL` and with the host the browser requested. Session and CSRF cookies are marked `Secure` when `APP_URL` starts with `https://`. An `http://localhost` value keeps the local demo able to sign in.
4. Set `STORAGE_DRIVER=s3` and a private bucket (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). Optional: `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` for R2 or MinIO, `S3_SSE=AES256` or `S3_SSE=aws:kms` with `S3_KMS_KEY_ID`. The app refuses to start in production when the driver is local, unless `ALLOW_LOCAL_STORAGE=true`.
5. For more than one instance, set `RATE_LIMIT_DRIVER=upstash` (or `redis`) and the matching URL and token. Sign-in lockout uses that same store. The defaults stay in memory. `MFA_GRACE_DAYS` defaults to 7. `TOTP_ENCRYPTION_KEY` is optional and otherwise uses `FIELD_ENCRYPTION_KEY`.
6. Build command: `npm run build` (it runs `prisma generate`). Release command or a one-off job: `npx prisma migrate deploy`.
7. Do not run the seed against production.
8. `vercel.json` schedules `GET /api/cron/reminders` and `GET /api/cron/retention`. Set `CRON_SECRET`. Vercel sends it as `Authorization: Bearer <CRON_SECRET>`. Reminders are a dry run until `REMINDERS_SEND=true`, and a type must be opted in (or that reminder approved) before it is eligible. The default driver is `console`. See `.env.example` for SMTP, Resend, and SES. The retention route is a dry run until `RETENTION_ENFORCE=true`. See [docs/retention.md](docs/retention.md).
9. Re-read the MOM pages cited in `config/mom-rules.ts` and update the numbers. They are flagged `verify against current MOM guidance`.

The app binds to `0.0.0.0` and the platform port. No background worker is required for the request path. Cron routes are the only scheduled work, and an external caller has to invoke them.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Root secret. Purpose keys are derived with HKDF. Production requires 32 bytes and rejects published defaults |
| `FIELD_ENCRYPTION_KEY` | 32-byte base64 AES-256-GCM key. Blank in `.env.example`. Production rejects the old published value |
| `FIELD_ENCRYPTION_KEYS` | Optional keyring, `id:base64` entries separated by commas |
| `FIELD_ENCRYPTION_KEY_ID` | Active key id. Defaults to `v1` when only `FIELD_ENCRYPTION_KEY` is set |
| `TOTP_ENCRYPTION_KEY` | Required in production. 32-byte base64, distinct from the field keys |
| `APP_URL` | Public origin. `https` marks cookies `Secure` |
| `BCRYPT_COST` | Password hashing cost. Use 12 outside tests |
| `MFA_GRACE_DAYS` | Days before staff and admin must finish TOTP. Default 7 |
| `LOCKOUT_DELAY_CAP_MS` | Optional cap on the sign-in delay. Leave unset in production |
| `STORAGE_DRIVER` | `local` for development, `s3` for AWS S3, R2, or MinIO |
| `ALLOW_LOCAL_STORAGE` | Must be `true` to keep the local driver when `NODE_ENV=production` |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Private bucket credentials |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | Custom endpoint. Path-style defaults on when an endpoint is set |
| `S3_SSE`, `S3_KMS_KEY_ID` | `AES256` or `aws:kms`. KMS needs the key id |
| `RATE_LIMIT_DRIVER` | `memory`, `upstash`, or `redis`. Lockout uses this store |
| `CRON_SECRET` | Bearer token for cron routes. At least 32 bytes in production |
| `TRUSTED_PROXY_HOPS` | How many X-Forwarded-For hops to trust. Default 0 uses the rightmost address |
| `CLIENT_IP_HEADER` | Optional platform IP header. Used only when that header is present |
| `EMAIL_VERIFY_HOURS` | Confirmation link lifetime. Default 24 |
| `BOT_PROTECTION` | `off`, `turnstile`, or `hcaptcha`. Off does not block forms |
| `EMAIL_DRIVER` | `console` (default), `smtp`, `resend`, or `ses` |
| `EMAIL_FROM` | From address for SMTP, and the fallback for Resend and SES |
| `REMINDERS_SEND` | `true` sends. Anything else is a dry run |
| `REMINDER_PERMIT_LEAD_DAYS` | Agency follow-up before a recorded permit expiry. Default 30. Not a MOM figure |
| `REMINDER_INCLUDE_HELPER` | `true` also emails the helper. Default off |
| `EMAIL_STAFF_INBOX` | Optional extra recipient for interview reminders |
| `MOM_RULE_STALE_DAYS` | Age, in days, before a MOM rule row is marked stale. Default 90 |
| `MOM_PUBLIC_HOLIDAYS` | Optional comma-separated `YYYY-MM-DD` list. When empty, the transcribed MOM list is used |
| `AI_USER_DAILY_BUDGET_CENTS` | Per-user daily AI cap in cents. Default 100 |
| `AI_USER_MAX_CALLS_PER_DAY` | Per-user daily AI calls. Default 40 |
| `AI_FEATURE_DAILY_BUDGET_CENTS` | Per-feature daily AI cap in cents. Default 250 |
| `AI_FEATURE_MAX_CALLS_PER_DAY` | Per-feature daily AI calls. Default 80 |
| `AI_RESERVE_MICRO` | Micro-dollars reserved before a chat call. Default 100000 |
| `AI_EMBED_RESERVE_MICRO` | Micro-dollars reserved before an embedding call. Default 20000 |
| `AI_PRICE_TABLE_JSON` | Optional override of the placeholder per-model rates. Verify the numbers before relying on them |
| `AI_EMBED_MAX_CHARS` | Free-text cap before an embedding. Default 600 |
| `AI_EMBED_CONCURRENCY` | Parallel single-embedding calls when a batch call is unavailable. Default 4 |
| `AI_EMBED_TIMEOUT_MS` | Overall embedding timeout. Default 20000 |
| `AI_PII_MINIMISATION` | Default on. Set `false` to send unredacted notes to a provider |
| `AI_REQUIRE_ZERO_RETENTION` | Default false. `true` allows only providers listed in `AI_ZERO_RETENTION_PROVIDERS` |
| `AI_ZERO_RETENTION_PROVIDERS` | Comma-separated provider ids the operator asserts are configured for zero retention |
| `STAFF_ASSIGNMENT_REQUIRED` | Default false. `true` limits staff file access to assigned candidates. Admins are exempt |
| `REVEAL_HOURLY_QUOTA` / `REVEAL_DAILY_QUOTA` | Sensitive-field reveals per staff user. Defaults 15 and 40 |
| `DOWNLOAD_HOURLY_QUOTA` / `DOWNLOAD_DAILY_QUOTA` | Document downloads per staff user. Defaults 30 and 80 |
| `ALERT_WEBHOOK_URL` | Optional Slack or generic webhook for quota, MFA, and lockout anomalies |
| `MFA_FAIL_HOURLY_ALERT` / `LOCKOUT_HOURLY_ALERT` | Hourly counts that fire one anomaly alert. Defaults 10 and 8 |
| `AUDIT_SINK` | Empty, `webhook`, or `s3`. Copies each new audit row. A failure does not block the action |
| `AUDIT_WEBHOOK_URL` | Destination when `AUDIT_SINK=webhook` |
| `AUDIT_S3_BUCKET` / `AUDIT_S3_PREFIX` | Optional bucket and key prefix for the audit sink. Defaults to the document bucket and `audit` |
| `AUDIT_S3_OBJECT_LOCK` / `AUDIT_S3_LOCK_DAYS` | `true` asks for a governance lock. The bucket must already have Object Lock. Default lock 365 days |

## Security

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/AlanKam555/fdw-agency-platform/security/advisories/new) on this repository. Do not open a public issue. Details are in [SECURITY.md](SECURITY.md).

## Contributing

[MIT](LICENSE). Copyright (c) 2026 Alan. Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [ROADMAP.md](ROADMAP.md). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
