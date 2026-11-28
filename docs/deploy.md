# Deployment

This is the operator checklist for a production deployment. The fictional Harbourlight values in `.env.example` are placeholders. Generate secrets, migrate, and then start the app. The app image does not migrate on startup.

## Secrets

Production refuses to boot when any of these is missing, shorter than 32 bytes, or one of the published example values:

- `AUTH_SECRET`
- `CRON_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `TOTP_ENCRYPTION_KEY` (required, and it must differ from the field encryption key)

```bash
npm run secrets:generate
```

Put the output in the host's secret store. Do not commit it. `FIELD_ENCRYPTION_KEY` encrypts passport, FIN, NRIC, and medical values. Losing it makes those rows unreadable. `npm run secrets:reencrypt` rewrites stored values after a key rotation. See [secrets.md](secrets.md).

## Database

Run migrations as their own step, before the new app version serves traffic:

```bash
npx prisma migrate deploy
```

Docker Compose already does this in the `migrate` service. The app container waits for that service. It does not run `prisma migrate` itself. A failed migration should leave the previous app version running.

Take a database backup before `migrate deploy`. The retention job deletes personal data when `RETENTION_ENFORCE=true`, and it deletes expired sessions even when that flag is false. Backups are the way back. This repository does not ship a backup schedule. Use the database host's backups and test a restore.

## Object storage

Documents and portraits go to S3-compatible storage (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).

- Turn on Block Public Access for the bucket.
- Do not add a public-read policy.
- Set default encryption. `S3_SSE` defaults to `AES256`. Use `aws:kms` with `S3_KMS_KEY_ID` when the host requires a customer key.
- The app serves files through authenticated routes or short-lived signed links. A public bucket bypasses that.

Local Compose uses MinIO on `127.0.0.1` only. That is not the production bucket.

## Sessions and client IP

See [auth.md](auth.md). Defaults:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SESSION_ABSOLUTE_HOURS` | 168 | Absolute lifetime. Clamped to 1–168 hours. |
| `SESSION_IDLE_STAFF_MINUTES` | 30 | Admin and staff idle timeout. Clamped to 5–120. |
| `SESSION_IDLE_PORTAL_MINUTES` | 720 | Employer and helper idle timeout. Clamped to 30–1440. |
| `SESSION_REVOKED_RETENTION_HOURS` | 24 | How long a revoked session row is kept. |

`TRUSTED_PROXY_HOPS` defaults to `0`. The client address is then the rightmost `X-Forwarded-For` value. Set the hop count to the number of proxies you operate. Set `CLIENT_IP_HEADER` when the platform puts the client address in its own header. A wrong hop count lets a caller pick the address used for lockout and audit.

## Lockout counters

`RATE_LIMIT_DRIVER` defaults to `memory`, which is per process. More than one app instance needs `upstash` (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) or `redis` (`REDIS_URL`). Otherwise each instance keeps its own sign-in failure count.

## Bot protection and jobs

`BOT_PROTECTION` is `off`, `turnstile`, or `hcaptcha`. When a provider is selected, the form fails closed if the provider secret is missing or the check fails.

`RETENTION_ENFORCE` defaults to false. The job then reports personal-data counts and does not redact them. Set it to `true` only after you accept the windows in [retention.md](retention.md). `RETENTION_PURGE_AUDIT` defaults to false. Expired and revoked sessions are deleted on every run, including a dry run.

`REMINDERS_SEND` defaults to false. The reminder cron lists work and does not send mail until this is `true`.

Both jobs are `GET` routes that require `Authorization: Bearer $CRON_SECRET`. `vercel.json` schedules reminders at 01:00 UTC and retention at 01:30 UTC. Another host must call those routes itself.

## Figures an operator must verify

The MOM catalog in `config/mom-rules.ts` was transcribed on 2026-11-26. `verificationStatus` is `verify against current MOM guidance`. The app does not change those numbers in this release. `MOM_RULE_STALE_DAYS` defaults to 90. Public holidays for 2027 include lunar dates that must be re-checked when they are gazetted. See [mom-rules.md](mom-rules.md).

PDPA windows in `lib/privacy/policy.ts` (`HL-PDPA-2026-11`) are product defaults, not legal advice:

| Records | Window |
| --- | --- |
| Enquiries | 365 days |
| Rejected or withdrawn applications | 180 days |
| Active applications | 2 years |
| Deployed placements | 5 years |
| Audit log | 2 years |
| Unconfirmed accounts | 14 days |

Confirm them against the agency's own retention schedule and current PDPC guidance before setting `RETENTION_ENFORCE=true`.
