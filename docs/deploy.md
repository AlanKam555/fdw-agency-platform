# Deployment

Each adopting agency chooses its own host. Nothing in the runtime imports a hosted-vendor SDK. `vercel.json` is an optional cron example for a host that reads that file. A Singapore region is a data-residency preference, not a conclusion that hosting there satisfies the PDPA. This page is not legal advice.

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

The MOM catalog in `config/mom-rules.ts` is flagged `verify against current MOM guidance`. Each rule carries `verifiedOn` and a source URL. `MOM_RULE_STALE_DAYS` defaults to 90. Public holidays for 2027 include lunar dates that must be re-checked when they are gazetted. See [mom-rules.md](mom-rules.md).

PDPA windows in `lib/privacy/policy.ts` (`HL-PDPA-2026-11`) are product defaults, not legal advice:

| Records | Window |
| --- | --- |
| Enquiries | 365 days |
| Rejected or withdrawn applications | 180 days |
| Active applications | 2 years |
| Deployed placements | 5 years |
| Audit log | 2 years |
| Unconfirmed accounts | 14 days |
| Service contracts, invoices, and payments | 6 years (`RETENTION_FINANCIAL_YEARS`) |

Confirm them against the agency's own retention schedule and current PDPC guidance before setting `RETENTION_ENFORCE=true`.

## Choosing a host

The process binds to `0.0.0.0` and `PORT` (default 3000). The slim runtime image does not include the Prisma CLI. Run `npm run migrate` where the CLI is installed, or use the image target `migrate`. Prefer a Singapore region (`ap-southeast-1`, or the host's Singapore / `sin` region) for Postgres, the bucket, Redis, and the app.

## Docker Compose on a VPS

`docker-compose.yml` starts Postgres, MinIO, a one-shot migrate, and the app. For a VPS:

1. Put the generated secrets in a file the compose project reads, or in the host secret store and inject them as environment variables. Do not commit that file.
2. `docker compose build` and `docker compose run --rm migrate` (the compose `migrate` service uses the image's migrate target). Start the app only after migrate exits 0.
3. Postgres is the `db` service. Point the app's `DATABASE_URL` at it over the compose network.
4. For a single container, the in-memory rate limiter is enough. For several app containers, set `RATE_LIMIT_DRIVER=redis` and add a Redis service, or point at Upstash.
5. MinIO in the compose file is a private bucket on `127.0.0.1`. On a VPS, keep it off the public internet. Block public access in the bucket policy. Set `S3_ENDPOINT` to the internal MinIO URL and `S3_FORCE_PATH_STYLE=true`.
6. Cron on the VPS, for example:

```cron
0 1 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://agency.example/api/cron/reminders
30 1 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://agency.example/api/cron/retention
```

7. Behind nginx or Caddy, set `TRUSTED_PROXY_HOPS=1`. If the proxy sets `X-Real-IP`, you can set `CLIENT_IP_HEADER=x-real-ip` instead.
8. Place the VPS in Singapore when the agency wants the data to stay there.

## Railway

1. Store the output of `npm run secrets:generate` in Railway variables (the project secret store). Do not print them in build logs.
2. Add a Postgres plugin. Set `DATABASE_URL` from it. Run `npm run migrate` as a one-off command, or a release command, separate from the web process.
3. Add Redis, or use Upstash and `RATE_LIMIT_DRIVER=upstash`.
4. Create a private bucket (Railway bucket, or any S3-compatible bucket) with public access blocked. Set the `S3_*` variables. Use `S3_SSE=AES256`.
5. Railway cron, or an external cron, calls the two routes with `Authorization: Bearer $CRON_SECRET`.
6. Railway's edge is one proxy hop. Set `TRUSTED_PROXY_HOPS=1`.
7. Choose the Southeast Asia region.

## Render

1. Store the generated secrets in the Render service's environment as secret variables.
2. Create a Render Postgres instance. Set `DATABASE_URL`. Add a pre-deploy command of `npm run migrate` so migrate finishes before the new instance receives traffic. The web process itself does not migrate.
3. Use Render Key Value (Redis) with `RATE_LIMIT_DRIVER=redis`, or Upstash.
4. Create a private bucket (Render or any S3-compatible store) and block public access. Set `STORAGE_DRIVER=s3` and the `S3_*` variables.
5. Render cron jobs call `GET /api/cron/reminders` and `GET /api/cron/retention` with the bearer secret. Bind the web service to `0.0.0.0:$PORT` (the image already does).
6. Render's proxy is one hop. Set `TRUSTED_PROXY_HOPS=1`.
7. Choose the Singapore region.

## Fly.io

1. Set the generated secrets with `fly secrets set` (Fly's secret store). Do not put them in `fly.toml`.
2. Create a Postgres cluster (`fly mpg` or another Postgres you operate). Set `DATABASE_URL`. Run the image's `migrate` target as a one-off machine before shifting traffic. The slim app image does not include the Prisma CLI, and the request process does not migrate.
3. Attach Upstash (`RATE_LIMIT_DRIVER=upstash`) or a Redis you operate.
4. Create a private Tigris or other S3-compatible bucket. Block public access. Set `S3_ENDPOINT` if the store is not AWS, and `S3_SSE=AES256`.
5. Schedule two Fly machines, or an external cron, for the reminder and retention routes. Send `Authorization: Bearer $CRON_SECRET`.
6. Fly puts the client address in `Fly-Client-IP`. Set `CLIENT_IP_HEADER=fly-client-ip`.
7. Choose the `sin` region.

## AWS (ECS or App Runner, RDS, S3)

1. Store the generated secrets in AWS Secrets Manager or SSM Parameter Store. Inject them into the task or the App Runner service. Do not put them in the task definition as plain text in git.
2. RDS for PostgreSQL in `ap-southeast-1`. Set `DATABASE_URL`. Run `npm run migrate` as a one-off ECS task or a pipeline step. The app container does not migrate on start. The image's `migrate` target is that step.
3. ElastiCache for Redis (`RATE_LIMIT_DRIVER=redis` and `REDIS_URL`) or Upstash.
4. One S3 bucket in `ap-southeast-1`. Block all public access. Default encryption SSE-S3 or SSE-KMS. `STORAGE_DRIVER=s3`, `S3_REGION=ap-southeast-1`, `S3_SSE=AES256` or `aws:kms`. Leave `S3_ENDPOINT` empty.
5. EventBridge Scheduler or a small cron task calls the two HTTPS routes with `Authorization: Bearer $CRON_SECRET`.
6. Behind an Application Load Balancer, set `TRUSTED_PROXY_HOPS=1`. Behind CloudFront and then an ALB, set `TRUSTED_PROXY_HOPS=2`. App Runner on its own is one hop (`TRUSTED_PROXY_HOPS=1`).
7. Run the task, the database, and the bucket in `ap-southeast-1`.
