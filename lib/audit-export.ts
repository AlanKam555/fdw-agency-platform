import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { logEvent } from "@/lib/log";

export type AuditSinkRow = {
  seq: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  prevHash: string;
  rowHash: string;
  createdAt: string;
};

function sinks(): string[] {
  return (process.env.AUDIT_SINK ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function payload(row: AuditSinkRow): string {
  return JSON.stringify({
    seq: row.seq,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    prevHash: row.prevHash,
    rowHash: row.rowHash,
    createdAt: row.createdAt,
  });
}

async function postWebhook(url: string, body: string) {
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(2_000),
  });
}

async function putObject(row: AuditSinkRow, body: string) {
  const bucket = process.env.AUDIT_S3_BUCKET || process.env.S3_BUCKET;
  if (!bucket) {
    logEvent("warn", "audit.sink_skipped", { sink: "s3", reason: "no_bucket" });
    return;
  }
  const region = process.env.S3_REGION || "ap-southeast-1";
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE
      ? process.env.S3_FORCE_PATH_STYLE === "true"
      : Boolean(endpoint),
  });
  const prefix = (process.env.AUDIT_S3_PREFIX || "audit").replace(/^\/+|\/+$/g, "");
  const lock = process.env.AUDIT_S3_OBJECT_LOCK === "true";
  const days = Number(process.env.AUDIT_S3_LOCK_DAYS ?? 365);
  const retainDays = Number.isFinite(days) && days > 0 ? days : 365;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${prefix}/${row.seq}.json`,
      Body: body,
      ContentType: "application/json",
      ...(lock
        ? {
            ObjectLockMode: "GOVERNANCE",
            ObjectLockRetainUntilDate: new Date(Date.now() + retainDays * 24 * 60 * 60 * 1000),
          }
        : {}),
    }),
  );
}

/** Best-effort. A sink failure does not undo the audit row. */
export async function shipAuditRow(row: AuditSinkRow): Promise<void> {
  const selected = sinks();
  if (selected.length === 0) return;
  const body = payload(row);
  const jobs: Promise<void>[] = [];
  if (selected.includes("webhook") && process.env.AUDIT_WEBHOOK_URL) {
    jobs.push(postWebhook(process.env.AUDIT_WEBHOOK_URL, body));
  }
  if (selected.includes("s3")) jobs.push(putObject(row, body));
  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === "rejected") {
      const name = result.reason instanceof Error ? result.reason.name : "Error";
      logEvent("warn", "audit.sink_failed", { error: name });
    }
  }
}
