# Changelog

## 0.6.0 — 2026-11-28

### Added

- Idle timeout beside the absolute session lifetime. Staff and admin default to 30 minutes (`SESSION_IDLE_STAFF_MINUTES`, clamped 5–120). Employers and helpers default to 12 hours (`SESSION_IDLE_PORTAL_MINUTES`, clamped 30–1440). `SESSION_ABSOLUTE_HOURS` stays capped at 7 days. An idle session is revoked and audited as `auth.session_idle`.
- The retention job deletes expired sessions on every run, including a personal-data dry run, and deletes revoked sessions after `SESSION_REVOKED_RETENTION_HOURS` (default 24).
- Staff service contracts, invoices, and payment records. Amounts are integer cents in SGD. Card numbers are rejected. There is no payment processor. Routes require `billing:manage`.
- OpenAPI catalogue at `GET /api/staff/openapi` and `/dashboard/api`, refused to anyone who is not staff. A unit test fails when the catalogue drifts from the route files.
- Locale switch for public chrome, the home page, the helper application title, and the helper portal. Locales are English, Chinese, Malay, Indonesian, Tagalog, Burmese, and Tamil. Tamil is a structure-only catalogue. Missing strings fall back to English. Legal and MOM copy stays in English.
- Helper portal shows status, the next step, interviews without employer contact details, document review state without file names, and consent. Upload choices follow the kinds the helper is allowed to send.
- Playwright runs axe on the public pages for WCAG 2.0 and 2.1 A and AA.
- `docs/deploy.md` and `docs/multi-tenancy.md`. The multi-tenancy note is a design only.

### Changed

- Small text that used the brand accent now uses `--brass-ink` (`#6f3b12`) so it clears WCAG AA on the paper background. The accent token `--brass` is unchanged.
- The fictional Harbourlight deployment publishes no EmploymentAgency JSON-LD. A configured agency omits placeholder phone, email, address, and licence values. Open Graph no longer says that demonstration data is fictional on every deployment.
- Focus-visible outlines are 3px.
- Re-seeding clears reminder opt-ins and delivery rows, so the demo starts with every reminder type off.

## 0.5.0 — 2026-11-28

### Security

- Production refuses to boot when `AUTH_SECRET`, `CRON_SECRET`, or a field encryption key is missing, shorter than 32 bytes, or one of the published example values. `TOTP_ENCRYPTION_KEY` is required in production and must differ from the field keys. `npm run secrets:generate` prints a fresh set. Docker Compose no longer interpolates those published defaults. A dev-only init container writes random secrets, and the app loads them only when `NODE_ENV` is not production.
- Client IP comes from one helper. With `TRUSTED_PROXY_HOPS` at 0 it uses the rightmost `X-Forwarded-For` address. Set `CLIENT_IP_HEADER` when the platform puts the client address in its own header.
- The public helper application no longer accepts staff fields (`internalNotes`, `medicalFitStatus`). New employer and helper accounts stay unsigned-in until they open a single-use email link. The acknowledgement is the same for a new address and an existing one. Unconfirmed accounts older than 14 days are removed by the retention job. Public forms include a honeypot. Turnstile or hCaptcha runs only when `BOT_PROTECTION` names that provider.
- Public portraits are served only after a staff member approves them. Uploads are rejected from `Content-Length` before the body is buffered, and each helper has a cap per file and per kind.
- Session cookies, document links, unsubscribe links, reminder recipient hashes, and email confirmation tokens use HKDF purpose keys. Field ciphertext records a key id so a keyring can decrypt older rows. `npm run secrets:reencrypt` rewrites stored values to the active key. Recovery codes issued after this release stay valid when `AUTH_SECRET` rotates. They are tied to the field key id in the hash.
- GitHub Actions are pinned to commit SHAs. The gitleaks download is checked against a checksum. CI runs `npm audit --omit=dev --audit-level=high`, a Trivy image scan, and a CycloneDX SBOM. The app image is multi-stage, runs as `node`, upgrades Debian security packages at build, omits the npm CLI and the Prisma CLI, and does not migrate on start. `Strict-Transport-Security` is set when `APP_URL` is `https`. MinIO is published on `127.0.0.1` only.
- An administrator can reset another staff member's authenticator after entering their own password and current code. That revokes the target's sessions and requires enrolment again. Sign-in no longer sleeps inside the request: after five failures the next attempt is `429` with `Retry-After`. Authenticator guesses are counted per user and IP.

### Changed

- Zod is `^4.6.6`.
- Existing session cookies stop working, because the session MAC key changed. Outstanding document links expire within five minutes. Pre-release recovery codes still match until `AUTH_SECRET` itself changes. New confirmation links are required before a newly registered employer or helper can sign in. Photos already in storage stay off the public gallery until staff approve them.

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
