# Agency workspace

A white-label workspace for a Singapore employment agency that places foreign domestic workers. The public name, EA licence number, colours, logo, locales, and MOM rule values come from environment variables. **Harbourlight**, licence `00C0000`, and the seeded people are a fictional demo used when those variables are empty.

This software is not legal advice. Operators must verify Ministry of Manpower rules and comply with the Personal Data Protection Act and the Employment Agencies Act. See [the disclaimer](app/disclaimer/page.tsx).

Sample people, testimonials, and portraits in the seed are invented.

## What it does

- Public pages: home, services, care-need pages, journal, consented helper gallery, stories, FAQ, contact, helper application, employer brief, privacy notice, disclaimer
- Accounts for admin, staff, employer, and helper, with a permission check on every staff and portal API
- Status pipeline: applied, screened, available, matched, MOM submitted, approved, deployed, plus rejected and withdrawn
- Matching by skills, languages, experience, salary ceiling, and availability, with eligibility gates kept out of the score
- Marketing drafts for several channels and languages, campaign slots, UTM links, a funnel count, and testimonial requests. A compliance check blocks approval when the licence number, a personnel number, or prohibited wording is missing. Nothing is posted to a social network
- AI providers: OpenAI, Anthropic, Google, xAI, Mistral, Groq, DeepSeek, Azure OpenAI, Amazon Bedrock, OpenRouter, and an OpenAI-compatible endpoint. Each feature has an ordered fallback. Usage is logged without the prompt text
- MOM checklist, reminders, and PDF. No Singpass or CorpPass automation

Fairness rules are in [docs/matching-fairness.md](docs/matching-fairness.md). MOM citations are in [docs/mom-rules.md](docs/mom-rules.md). Personal data handling is in [docs/pdpa.md](docs/pdpa.md). The threat model is in [SECURITY.md](SECURITY.md).

## Stack

Next.js App Router, TypeScript, Tailwind, Prisma, PostgreSQL, Zod, and the Vercel AI SDK. Auth is a signed cookie so the app runs without an identity provider. The session shape is documented in [docs/auth.md](docs/auth.md) so it can be swapped for Clerk.

## Local setup

Use Node.js 22 and PostgreSQL 16.

```bash
cp .env.example .env
# Set DATABASE_URL, AUTH_SECRET (16+ characters), and FIELD_ENCRYPTION_KEY
# (32 bytes, base64). A development key is in .env.example. Generate another
# for any shared environment: openssl rand -base64 32
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000.

Every seeded account uses the password `Harbourlight-Dev-1`:

| Email | Role |
| --- | --- |
| admin@harbourlight.example | Admin |
| staff@harbourlight.example | Staff |
| employer@harbourlight.example | Employer |
| candidate@harbourlight.example | Helper |

`BCRYPT_COST=4` is acceptable for local and CI. Use 12 in a deployed environment.

AI drafts and match explanations use a labelled template until a provider key in `.env.example` is set. `AI_MARKETING_PROVIDERS`, `AI_EXPLANATION_PROVIDERS`, and `AI_EMBEDDING_PROVIDERS` are comma-separated fallback lists. The admin settings page shows which providers are configured and never shows a key.

One-command demo against the database in `.env`:

```bash
npm run demo
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests expect `DATABASE_URL`, `AUTH_SECRET`, and `FIELD_ENCRYPTION_KEY`. GitHub Actions starts PostgreSQL and runs lint, typecheck, tests, and the production build. The workflow permission is `contents: read`.

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AlanKam555/maid-agency-platform&env=DATABASE_URL,AUTH_SECRET,FIELD_ENCRYPTION_KEY,APP_URL,CRON_SECRET)

1. Create a Vercel project from this repository and a managed Postgres database (Neon, Supabase, or Vercel Postgres).
2. Set the environment variables from `.env.example`. Use a new `AUTH_SECRET`, a new `FIELD_ENCRYPTION_KEY`, and `BCRYPT_COST=12`.
3. Set `APP_URL` to the production origin. CSRF checks compare the request origin with `APP_URL` and with the host the browser requested.
4. Set `STORAGE_DRIVER=s3` and a private bucket (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). The local disk driver writes under `./storage/<STORAGE_LOCAL_DIR>` and is for development. Vercel’s filesystem is ephemeral, so uploaded passports would disappear on the next instance.
5. Build command: `npm run build` (it runs `prisma generate`). Release command or a one-off job: `npx prisma migrate deploy`.
6. Do not run the seed against production.
7. Point a daily caller at `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`. The route lists due reminders. It does not send email. Wire that to your mailer before relying on it.
8. Re-read the MOM pages cited in `config/mom-rules.ts` and update the numbers. They are flagged `verify against current MOM guidance`.

The app binds to `0.0.0.0` and the platform port. No background worker is required for the request path.

## Docker

```bash
docker compose up --build
```

That starts Postgres and the app. Set `SEED_DEMO=true` on the app service for the fictional Harbourlight accounts. Do not enable that seed on a database that holds real people. `npm run demo` is the same migrate-and-seed step on a host that already has Node and Postgres.

## Ownership

[MIT](LICENSE). Copyright (c) 2026 Alan. Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report vulnerabilities through [GitHub Security Advisories](https://github.com/AlanKam555/maid-agency-platform/security/advisories/new), not a public issue.
