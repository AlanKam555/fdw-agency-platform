# Retention job

The windows live in `lib/privacy/policy.ts` and are repeated in the public privacy notice. They are product defaults, not a statement of what the PDPA requires for a particular agency.

| Records | Window | Clock |
| --- | --- | --- |
| Enquiries | 365 days | `createdAt` |
| Applications still at "applied" | 90 days | `updatedAt` |
| Rejected or withdrawn applications | 180 days | `updatedAt` |
| Other applications that are not deployed | 2 years | `updatedAt` |
| Deployed placements | 5 years | `updatedAt` |
| Households with no placement outcome | 2 years | `updatedAt` |
| Households with a placement outcome | 5 years | `updatedAt` |
| Marketing drafts | 365 days | `createdAt` |
| Testimonial requests still unanswered | 90 days | `createdAt` |
| Expired or revoked sessions | 30 days | `expiresAt` or `revokedAt` |
| Embedding cache | 7 days | `createdAt` |
| Match explanation text | deployed window | `createdAt` on the match. The score row stays |
| Outcome and interview notes | deployed window | `createdAt` |
| Audit log | 2 years | `createdAt` |
| Unconfirmed employer or helper accounts | 14 days | `createdAt` |

A redacted profile is skipped. "Due" means the clock is older than the window.

## How to run it

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/retention
```

The response is counts and a note. It does not include names, emails, or document numbers.

- `RETENTION_ENFORCE` unset or `false`: dry run for personal data. Profiles, enquiries, drafts, and unconfirmed accounts are not deleted. The job still retries queued object deletes and still drops embedding-cache rows older than seven days.
- Expired session rows are deleted on every run, including a dry run. Revoked session rows are deleted once they are older than `SESSION_REVOKED_RETENTION_HOURS` (default 24). The response field `sessions` reports those counts. They are not part of `processed`.
- `RETENTION_ENFORCE=true`: each due helper or household profile is redacted with the same routine as the staff button. Due enquiries and unanswered testimonial requests are deleted. Old match explanations and outcome notes are cleared. The score and the category code stay. Employer and helper accounts with no confirmed email, older than 14 days, are deleted when they have no file past `APPLIED`. A row that cannot be deleted is skipped and counted in the log as `privacy.retention_unverified_skipped`, without the address.
- `RETENTION_PURGE_AUDIT=true` together with enforce: a contiguous prefix of audit rows older than the audit window is deleted after a checkpoint row is written. Leave this off until you have exported the log. The job writes its own audit row after the purge selection, so that new row stays. Rows that are not a prefix are left in place so the hash chain still verifies. Deleting an account clears the `actorId` foreign key. The chain keeps a separate `actorRef` copy, so that delete does not change the row hash.

Each category is capped at 50 rows per call. When `limited` is true, run the job again until the counts drop. `vercel.json` schedules this daily at 01:30 UTC, next to the reminder list at 01:00 UTC. Both routes reject a missing or wrong `CRON_SECRET`.

Vercel does not run the route by itself in local Docker. Call it from cron, a GitHub Action, or `curl`.

## What it does not do

It does not decide that a record may legally be deleted. A MOM file the agency has already submitted, or a record needed for a dispute, can sit inside these windows. Service contracts and invoices are not deleted by this job. Turn enforcement on only after someone who knows the agency's obligations has read the windows. The job does not send email, and it does not touch AI provider accounts.
