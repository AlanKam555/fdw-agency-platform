# Roadmap

This is a working MVP for agencies and for people who want to improve it. The items below are the ones that still need a human. "Good first issue" means a small change with a test, and no new secret, no real personal data, and no change to who is allowed to call a staff API.

## Good first issues

1. **Static page smoke.** The desk walkthrough in `e2e/desk.spec.ts` covers the public home, helper application, employer registration, staff TOTP, matching, the MOM pack, reminders, rules, and outcomes. A smaller follow-up can load `/faq`, `/disclaimer`, and `/care` against `next start` and assert each page has one `h1` and no console error. Keep the test offline from AI providers.
2. **Retention index.** Add a Prisma index on `Candidate.updatedAt` so the retention queries do not scan the table as the file grows. Include a migration and a note in `docs/retention.md`.
3. **Retry-After on the staff UI.** `429` responses already send `Retry-After`. Show that wait on the form that received it, in `components/json-form.tsx`, with a unit-free component test or a small pure formatter.
4. **Empty helpers page.** When `listPublicHelpers` returns no rows, the gallery should say that staff have not marked a consented profile available, instead of an empty grid.
5. **Second locale pass.** The marketing assistant knows seven language codes. Pick one public page, write a static translation next to the English, and link it from the footer. Do not machine-translate passport or medical text.
6. **Docker healthcheck.** Add an app-service healthcheck that calls `GET /api/health` after migrate, and document the compose command in the README only if the command changes.

## Larger work

- Re-check the 2027 public holidays when MOM gazettes them. Lunar dates on the MOM page can move. The transcribed list says so, and the holiday page records the source and the last verified date.
- Have an admin open each MOM catalog value, read the cited page, and mark it re-verified. This release did not change the numbers.
- Point reminder sends at a shared rate-limit store when more than one app instance runs the cron. The default store is process memory.

Protected traits stay out of the schema. Matching stays deterministic. Marketing drafts stay in review. MOM submission stays manual. Weight suggestions stay unapplied until staff save them.
