# Authentication

The app signs its own session cookie so it runs without an external identity provider. The session is an HMAC-SHA256 token in the `hl_session` cookie (`httpOnly`, `SameSite=Lax`, seven days). The cookie is `Secure` when `APP_URL` starts with `https://`. Roles are `ADMIN`, `STAFF`, `EMPLOYER`, and `CANDIDATE`.

Public registration creates employer and helper accounts only. Administrators create staff accounts.

## Clerk-ready boundary

All route checks go through `requireUser` (pages) or `guardRequest` (API). Both read a small session object: `sub`, `role`, and `name`. Replacing the cookie signer with Clerk means:

1. Verify the Clerk session in `lib/auth/current.ts` and `proxy.ts`.
2. Map the Clerk user id and a role claim onto that same session object.
3. Keep `hasPermission` as the only authorisation table.

Do not scatter provider-specific checks through pages or server actions. The permission names stay stable.

Passwords in this MVP are bcrypt hashes. A Clerk deployment would stop storing passwords and would keep the same role column, or the equivalent organisation role, as the source for `hasPermission`.
