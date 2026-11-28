# Authentication

The app signs its own session cookie so it runs without an external identity provider. The `hl_session` cookie (`httpOnly`, `SameSite=Lax`) is an HMAC-SHA256 token that includes a random session id. The matching `Session` row stores a hash of that id. The cookie is `Secure` when `APP_URL` starts with `https://`. Roles are `ADMIN`, `STAFF`, `EMPLOYER`, and `CANDIDATE`. The role used for a request is read from the database, not trusted from the cookie alone.

A session ends at the earlier of the absolute lifetime and the idle window. `SESSION_ABSOLUTE_HOURS` defaults to 168 and is clamped between 1 and 168, so a setting cannot extend the previous seven-day cap. `SESSION_IDLE_STAFF_MINUTES` defaults to 30 for admin and staff (clamped 5–120). `SESSION_IDLE_PORTAL_MINUTES` defaults to 720 for employers and helpers (clamped 30–1440). A blank, non-integer, or zero value does not turn the limit off. An idle session is revoked, audited as `auth.session_idle` with the role only, and the cookie is cleared on the next response. Last-seen is written at most once a minute, so sign-out can be early by about that long.

A user with `disabledAt` set is rejected on the next request, including API routes, even when the session is also idle. Logout revokes that session. A password change, an admin disable, and "sign out everywhere" revoke all of them. The retention job deletes expired session rows on every run, including a personal-data dry run, and deletes revoked rows older than `SESSION_REVOKED_RETENTION_HOURS` (default 24).

Staff and admin must use TOTP (RFC 6238) after a grace period that starts on the first sign-in (`MFA_GRACE_DAYS`, default 7). The demo seed does not store a TOTP secret. Sign in with the demo password, then open Security and add an authenticator before the grace period ends. Employers can turn TOTP on, and can turn it off again. Staff cannot turn it off.

Failed passwords share one message: "Invalid email or password." After five failures in 15 minutes the next attempt is rejected immediately with `429` and `Retry-After`. The delay is not slept inside the request. After ten, the account and that IP are locked for the rest of the window and the response is `401` with the same message. Lockouts are written to the audit log. Set `RATE_LIMIT_DRIVER` to `upstash` or `redis` when more than one process serves sign-in. `LOCKOUT_DELAY_CAP_MS=0` turns the `429` step off. Leave it unset in production.

Public registration creates employer and helper accounts only. Those accounts cannot sign in until the email confirmation link is used. The link is single-use, expires after `EMAIL_VERIFY_HOURS` (default 24), and the public acknowledgement does not say whether the address was new. Staff and admin accounts created by an administrator are confirmed immediately. An administrator can reset another staff member's authenticator from the user page. That action needs the administrator's password and current code, revokes the target's sessions, and writes `auth.mfa_admin_reset`. Authenticator guesses are limited per user and IP.

Recovery codes issued by this version stay valid when `AUTH_SECRET` rotates, because the MAC uses the field encryption key. Codes issued before this version still match the previous `AUTH_SECRET` until that value changes. After a rotation, ask those users to generate new codes.

## Clerk-ready boundary

All route checks go through `requireUser` (pages) or `guardRequest` (API). Both resolve the session row and then read `sub`, `role`, and `name` from the user record. Replacing the cookie signer with Clerk means:

1. Verify the Clerk session in `lib/auth/current.ts` and `proxy.ts`.
2. Map the Clerk user id and a role claim onto that same session object.
3. Keep `hasPermission` as the only authorisation table.

Do not scatter provider-specific checks through pages or server actions. The permission names stay stable.

Passwords in this MVP are bcrypt hashes. A Clerk deployment would stop storing passwords and would keep the same role column, or the equivalent organisation role, as the source for `hasPermission`.
