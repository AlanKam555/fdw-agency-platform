import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function hashAuditRow(row: {
  seq: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  ip: string | null;
  prevHash: string;
}): string {
  const payload = canonicalJson({
    action: row.action,
    actorId: row.actorId,
    entityId: row.entityId,
    entityType: row.entityType,
    ip: row.ip,
    metadata: row.metadata ?? null,
    prevHash: row.prevHash,
    seq: row.seq,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function verifyAuditChain(): Promise<{ ok: boolean; checked: number; problems: string[] }> {
  const checkpoint = await prisma.auditCheckpoint.findFirst({ orderBy: { throughSeq: "desc" } });
  const start = checkpoint?.throughSeq ?? 0;
  const rows = await prisma.auditLog.findMany({
    where: { seq: { not: null, gt: start } },
    orderBy: { seq: "asc" },
  });
  const problems: string[] = [];
  let prev = checkpoint?.rowHash ?? "";
  let expected = start;
  for (const row of rows) {
    if (row.seq == null) continue;
    expected += 1;
    if (row.seq !== expected) {
      problems.push(`gap at seq ${expected}`);
      break;
    }
    if ((row.prevHash ?? "") !== prev) problems.push(`prev_hash mismatch at seq ${row.seq}`);
    const recomputed = hashAuditRow({
      seq: row.seq,
      actorId: row.actorRef ?? row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata ?? null,
      ip: row.ip,
      prevHash: row.prevHash ?? "",
    });
    if (row.rowHash !== recomputed) problems.push(`row_hash mismatch at seq ${row.seq}`);
    prev = row.rowHash ?? "";
  }
  const head = await prisma.auditChainHead.findUnique({ where: { id: "head" } });
  if (head && rows.length > 0) {
    const last = rows[rows.length - 1];
    if (head.seq !== last.seq || head.rowHash !== (last.rowHash ?? "")) problems.push("head mismatch");
  } else if (head && rows.length === 0 && checkpoint) {
    if (head.seq !== checkpoint.throughSeq || head.rowHash !== checkpoint.rowHash) {
      problems.push("head does not match the latest checkpoint");
    }
  } else if (head && rows.length === 0 && !checkpoint && (head.seq !== 0 || head.rowHash !== "")) {
    const anyChained = await prisma.auditLog.count({ where: { seq: { not: null } } });
    if (anyChained === 0 && head.seq !== 0) problems.push("head is ahead of an empty chain");
  }
  return { ok: problems.length === 0, checked: rows.length, problems };
}
