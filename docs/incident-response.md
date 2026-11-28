# PDPA incident response

This runbook is an operational checklist for a suspected personal-data breach in a deployment of this software. It is not legal advice. **Verify the timings below against current PDPC guidance before relying on them.**

The product stores helper and household data in Postgres, encrypted identifiers, and document objects. A breach can be a stolen database, a public bucket, a leaked key, or a staff account used outside its purpose.

## Roles

| Role | Job during an incident |
| --- | --- |
| Incident lead | Opens the record, decides severity, keeps the clock, and is the only person who talks to the PDPC contact path the agency has already chosen. |
| Data protection officer (or the person the agency named) | Decides whether the incident is notifiable. This software does not make that decision. |
| Engineering | Preserves evidence, rotates keys, and stops the exposure. |
| Staff lead | Tells affected helpers and employers only the facts the DPO has approved. Does not put personal data into chat or tickets. |

## Clock

Verify these timings against current PDPC guidance.

1. Assess whether the incident is notifiable within 30 days of becoming aware of it.
2. Once the assessment says it is notifiable, notify the PDPC within 3 calendar days.
3. Notify affected individuals as the current guidance requires. Do not wait for a perfect list if the exposure is ongoing. Stop the exposure first.

Record the time the agency first knew, the time the assessment finished, and the time each notice went out.

## First hour

1. Name the incident lead and write one sentence: what system, what data, what time.
2. Stop the path. Disable the account, revoke its sessions from Users, or take the bucket private. Do not delete the evidence while you do this.
3. Preserve logs, the audit hash chain, database snapshots, and object versions. Export the audit chain with `npm run audit:verify` and keep the output with the incident file. If `AUDIT_SINK` is set, do not rotate that sink until a copy exists.
4. Do not post names, NRIC, passport numbers, or document keys in Slack, email, or a GitHub issue.

## Evidence to keep

- The audit rows and their `seq`, `prevHash`, and `rowHash`. A checkpoint row is part of the chain. Do not delete a prefix to "clean up" during an incident.
- Deployment id, commit, and the environment names that were set (not the secret values).
- Storage keys of objects that were exposed, and whether deletion-outbox rows exist for them.
- Who revealed a field or downloaded a file in the window. The audit metadata has a reason code and a shortened reason, not the document contents.

## Key rotation

Do this after a copy of the database and the object store is stored somewhere the attacker cannot change.

1. Rotate `FIELD_ENCRYPTION_KEY` only with a planned re-encrypt. A new key does not decrypt old passport, FIN, NRIC, or medical ciphertext. Re-encrypt under the new key before you drop the old one. This release does not ship a keyring; treat a lost key as data loss.
2. Rotate `SESSION_SECRET` and `CRON_SECRET`. Sessions signed with the old secret stop working.
3. Rotate `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` (or the equivalent MinIO keys). Confirm the bucket still blocks public access.
4. Rotate every AI provider key that was in the same environment. Set `AI_REQUIRE_ZERO_RETENTION=true` only after the replacement provider is on `AI_ZERO_RETENTION_PROVIDERS`.
5. If `ALERT_WEBHOOK_URL` or `AUDIT_WEBHOOK_URL` might have been read, replace those endpoints.

## After the exposure is stopped

1. Decide the notification with the DPO, using the clock above and current PDPC guidance.
2. For people you will notify, staff can generate a subject-access file from the privacy export route. Do not email the file from this app. Hand it over on a channel the agency already uses for that person.
3. Redact a profile only when the person asked for erasure or the DPO says the record should go. Redaction keeps match scores and placement category codes for the fairness audit and clears notes.
4. Write what changed, what remains, and the residual risk (provider copies if zero-retention was not actually configured, objects still in the deletion outbox, audit rows that were exported to a webhook).

## What this software will not do

It will not file a PDPC notice. It will not email affected people. It will not decide that an incident is notifiable. Those steps stay with the agency.
