# Retention job

The windows live in `lib/privacy/policy.ts` and are repeated in the public privacy notice. They are product defaults, not a statement of what the PDPA requires for a particular agency.

| Records | Window | Clock |
| --- | --- | --- |
| Enquiries | 365 days | `createdAt` |
| Rejected or withdrawn applications | 180 days | `updatedAt` |
| Other applications that are not deployed | 2 years | `updatedAt` |
| Deployed placements | 5 years | `updatedAt` |
| Audit log | 2 years | `createdAt` |

A redacted profile is skipped. "Due" means the clock is older than the window.

## How to run it

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/retention
```

The response is counts and a note. It does not include names, emails, or document numbers.

- `RETENTION_ENFORCE` unset or `false`: dry run. Nothing is deleted.
- `RETENTION_ENFORCE=true`: each due helper profile is redacted with the same routine as the staff button (documents removed, passport, FIN, and medical fields cleared, linked account disabled). Due enquiries are deleted.
- `RETENTION_PURGE_AUDIT=true` together with enforce: audit rows older than the audit window are deleted. Leave this off until you have exported the log. The job writes its own audit row after the purge selection, so that new row stays.

Each category is capped at 50 rows per call. When `limited` is true, run the job again until the counts drop. `vercel.json` schedules this daily at 01:30 UTC, next to the reminder list at 01:00 UTC. Both routes reject a missing or wrong `CRON_SECRET`.

Vercel does not run the route by itself in local Docker. Call it from cron, a GitHub Action, or `curl`.

## What it does not do

It does not decide that a record may legally be deleted. A MOM file the agency has already submitted, or a record needed for a dispute, can sit inside these windows. Turn enforcement on only after someone who knows the agency's obligations has read the windows. The job does not send email, and it does not touch AI provider accounts.
