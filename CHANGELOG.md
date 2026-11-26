# Changelog

## 0.3.0 — 2026-11-26

### Security

- A disabled account is rejected on the next API call and the next page load. Sessions are rows that can be revoked. Password changes, disablement, and "sign out everywhere" revoke every session for that account.
- Content-Security-Policy no longer allows inline style attributes. Brand colours are set in a nonce'd style element.
- Document storage can use a private S3-compatible bucket with SSE-S3 or SSE-KMS, random object keys, and five-minute download URLs. Production refuses the local disk driver unless `ALLOW_LOCAL_STORAGE=true`. Downloads are audited. Docker Compose includes MinIO.
- Sign-in uses a growing delay and then a temporary lock, with one generic error. Staff and admin must enrol TOTP after a grace period. Recovery codes are single-use. Demo accounts are not pre-enrolled. The first local sign-in opens the setup prompt.

## 0.2.0 — 2026-11-26

First public release of `fdw-agency-platform`. The application tree is published under the MIT licence with a fresh git history.

### Added

- Quick start for Docker and a local Node install, a demo walkthrough, an architecture overview, a roadmap, and this changelog
- Pluggable rate limiter: in-memory by default, Upstash REST, and Redis (`RATE_LIMIT_DRIVER`)
- Scheduled retention route at `GET /api/cron/retention`, dry-run unless `RETENTION_ENFORCE=true`
- Vercel cron entries for reminders and retention

### Changed

- Package name is `fdw-agency-platform`
- Security reports point at this repository's private vulnerability reporting form
- Public registration and the public helper application return the same acknowledgement whether or not the email already exists. Registration does not sign the browser in
- Content-Security-Policy is generated per request with a script nonce and `strict-dynamic`. The home page JSON-LD script carries the same nonce
- Session and CSRF cookies are `Secure` when `APP_URL` is https, so the documented `http://localhost` demo can still sign in
- Public copy uses the configured agency name. Harbourlight remains the fictional default

### Security

- `.env.example` contains only empty values or documented local placeholders
- Seed data remains the fictional Harbourlight agency, licence `00C0000`
