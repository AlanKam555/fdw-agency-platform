# Authentication

The app signs its own session cookie so it runs without an external identity provider. The `hl_session` cookie (`httpOnly`, `SameSite=Lax`, seven days) is an HMAC-SHA256 token that includes a random session id. The matching `Session` row stores a hash of that id. The cookie is `Secure` when `APP_URL` starts with `https://`. Roles are `ADMIN`, `STAFF`, `EMPLOYER`, and `CANDIDATE`. The role used for a request is read from the database, not trusted from the cookie alone.

A user with `disabledAt` set is rejected on the next request, including API routes. Logout revokes that session. A password change, an admin disable, and "sign out everywhere" revoke all of them.

Staff and admin must use TOTP (RFC 6238) after a grace period that starts on the first sign-in (`MFA_GRACE_DAYS`, default 7). The demo seed does not store a TOTP secret. Sign in with the demo password, then open Security and add an authenticator before the grace period ends. Employers can turn TOTP on, and can turn it off again. Staff cannot turn it off.

Failed passwords share one message: "Invalid email or password." After five failures in 15 minutes the next attempt waits, doubling each time. After ten, the account and that IP are locked for the rest of the window. The message stays the same. Lockouts are written to the audit log. Set `RATE_LIMIT_DRIVER` to `upstash` or `redis` when more than one process serves sign-in. `LOCKOUT_DELAY_CAP_MS` can cap the wait. Leave it unset in production.

Public registration creates employer and helper accounts only. Administrators create staff accounts.

## Clerk-ready boundary

All route checks go through `requireUser` (pages) or `guardRequest` (API). Both resolve the session row and then read `sub`, `role`, and `name` from the user record. Replacing the cookie signer with Clerk means:

1. Verify the Clerk session in `lib/auth/current.ts` and `proxy.ts`.
2. Map the Clerk user id and a role claim onto that same session object.
3. Keep `hasPermission` as the only authorisation table.

Do not scatter provider-specific checks through pages or server actions. The permission names stay stable.

Passwords in this MVP are bcrypt hashes. A Clerk deployment would stop storing passwords and would keep the same role column, or the equivalent organisation role, as the source for `hasPermission`.
