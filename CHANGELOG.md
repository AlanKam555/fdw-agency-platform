# Changelog

## 0.4.0 — 2026-11-26

### Added

- Reminder email with a pluggable driver: `console` (default), SMTP, Resend, or Amazon SES. The cron stays a dry run unless `REMINDERS_SEND=true`. A reminder type must be opted in, or that one reminder approved, before a row is eligible. Each send is stored once per reminder, recipient, and due date. Recipients can unsubscribe with a signed link. The job is rate-limited and audit-logged. Addresses and message text are not logged.
- Singapore public holidays for 2025, 2026, and 2027, transcribed from the MOM public holidays page on 2026-11-26, including the Mondays MOM lists when a holiday falls on Sunday. Staff can add or suppress a date. 2027 lunar dates must be re-checked when they are gazetted.
- An admin and staff MOM rules page. It lists every catalog value, the MOM source, and the last verified date. Values older than `MOM_RULE_STALE_DAYS` (default 90) are marked stale on that page and on the staff desk. An admin can mark a rule re-verified or save an override with a source URL and a note. The catalog numbers were not changed.
- Placement outcomes at 1, 3, and 6 months, or when a placement ends. Staff record duration, completion, a reason category, employer and helper satisfaction, and a staff-only note. Outcomes feed weight suggestions. The suggestion shows its evidence count and is not applied until staff save it. The fairness audit groups outcomes by nationality and warns when a group has fewer than five rows.
- Playwright coverage for the public site, helper application, employer registration, staff TOTP setup, matching, interview request, MOM pack PDF, reminder dry run, rules review, and outcome capture. CI runs it against Postgres, a production build, and MinIO.

### Security

- Existing session revocation, `style-src-attr 'none'`, private storage, sign-in lockout, and staff TOTP are unchanged.
- Reminder delivery rows store a hash of the address. Unsubscribe confirmation is a POST, so opening the link does not opt anyone out. Helper addresses are excluded unless `REMINDER_INCLUDE_HELPER=true`.
- Docker Compose and CI use a Chainguard MinIO build. The old `minio/minio` image on Docker Hub is no longer anonymously pullable. The bucket stays private.

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
