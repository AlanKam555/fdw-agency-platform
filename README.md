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

Open http://localhost:3000. Postgres keeps its data in the `pgdata` volume. The app container runs migrations on startup. To load the fictional Harbourlight accounts as well:

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

Tests expect `DATABASE_URL`, `AUTH_SECRET`, and `FIELD_ENCRYPTION_KEY`. GitHub Actions starts PostgreSQL and runs lint, typecheck, tests, and the production build. CodeQL and gitleaks run as separate workflows. The CI permission is `contents: read`.

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AlanKam555/fdw-agency-platform&env=DATABASE_URL,AUTH_SECRET,FIELD_ENCRYPTION_KEY,APP_URL,CRON_SECRET&project-name=fdw-agency-platform&repository-name=fdw-agency-platform)

1. Create a Vercel project from this repository and a managed Postgres database (Neon, Supabase, or Vercel Postgres).
2. Set the environment variables from `.env.example`. Use a new `AUTH_SECRET`, a new `FIELD_ENCRYPTION_KEY`, and `BCRYPT_COST=12`. Leave every AI key empty until you choose a provider.
3. Set `APP_URL` to the production https origin. CSRF checks compare the request origin with `APP_URL` and with the host the browser requested. Session and CSRF cookies are marked `Secure` when `APP_URL` starts with `https://`. An `http://localhost` value keeps the local demo able to sign in.
4. Set `STORAGE_DRIVER=s3` and a private bucket (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). Optional: `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` for R2 or MinIO, `S3_SSE=AES256` or `S3_SSE=aws:kms` with `S3_KMS_KEY_ID`. The app refuses to start in production when the driver is local, unless `ALLOW_LOCAL_STORAGE=true`.
5. For more than one instance, set `RATE_LIMIT_DRIVER=upstash` (or `redis`) and the matching URL and token. Sign-in lockout uses that same store. The defaults stay in memory. `MFA_GRACE_DAYS` defaults to 7. `TOTP_ENCRYPTION_KEY` is optional and otherwise uses `FIELD_ENCRYPTION_KEY`.
6. Build command: `npm run build` (it runs `prisma generate`). Release command or a one-off job: `npx prisma migrate deploy`.
7. Do not run the seed against production.
8. `vercel.json` schedules `GET /api/cron/reminders` and `GET /api/cron/retention`. Set `CRON_SECRET`. Vercel sends it as `Authorization: Bearer <CRON_SECRET>`. The reminder route lists due reminders and does not send email. The retention route is a dry run until `RETENTION_ENFORCE=true`. See [docs/retention.md](docs/retention.md).
9. Re-read the MOM pages cited in `config/mom-rules.ts` and update the numbers. They are flagged `verify against current MOM guidance`.

The app binds to `0.0.0.0` and the platform port. No background worker is required for the request path. Cron routes are the only scheduled work, and an external caller has to invoke them.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Signs session cookies and recovery-code hashes |
| `FIELD_ENCRYPTION_KEY` | 32-byte base64 AES-256-GCM key for field encryption and, by default, TOTP secrets |
| `TOTP_ENCRYPTION_KEY` | Optional separate 32-byte base64 key for TOTP secrets |
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
| `CRON_SECRET` | Bearer token for cron routes |

## Security

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/AlanKam555/fdw-agency-platform/security/advisories/new) on this repository. Do not open a public issue. Details are in [SECURITY.md](SECURITY.md).

## Contributing

[MIT](LICENSE). Copyright (c) 2026 Alan. Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [ROADMAP.md](ROADMAP.md). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
