# Multi-tenancy

This note is a design. It is not implemented. The current deployment is one agency: one database, one set of encryption keys, one `AGENCY_*` configuration, and one staff desk.

## Today

Personal data (helpers, employers, documents, sessions, audit rows, contracts) lives in one schema with no tenant column. Authorisation is the signed-in user's role. A staff member can read every employer because there is only one agency. Public pages read `config/brand.ts`.

Do not add a client-supplied tenant header, a query parameter, or a subdomain lookup that is trusted on its own. That would be an insecure direct object reference across agencies.

## If a later version hosts more than one agency

1. Add an `Agency` row for the tenant: legal name, licence number, and the brand fields that are environment variables today.
2. Add `agencyId` on every table that holds personal data or billing records. Index it. Foreign keys stay inside the tenant.
3. Resolve the tenant on the server from the deployment or from the session, then apply `agencyId` in the same query that loads the row. Do not filter in the page after a global `findMany`.
4. Put `agencyId` in the session row when the session is issued. Read it back from the database with the role. Ignore any tenant id sent by the browser.
5. Keep encryption keys per tenant. Ciphertext already stores a key id, so a keyring can hold more than one key. Do not reuse one field key across agencies.
6. Write `agencyId` on audit rows. A staff reveal, a contract change, and a retention run are tenant-scoped.
7. Do not copy a helper profile from one agency to another. A new introduction needs a new consent from the person.
8. Each tenant keeps its own MOM licence and its own verified MOM figures. The catalog stays code, with per-tenant overrides, and the stale-warning window still applies.
9. Cron jobs iterate tenants. A failure in one tenant does not skip the audit row for the others. Retention and session purge stay per tenant.
10. Stay on one shared database with a tenant column. A schema per tenant is a later decision and needs its own migration and backup story.

Until that work is done, run one deployment per agency.
