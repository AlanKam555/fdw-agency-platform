import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { deleteObject } from "@/lib/storage/files";

const MAX_ATTEMPTS = 8;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export async function queueOrDeleteObject(input: {
  storageKey: string;
  reason: string;
  entityType: string;
  entityId: string;
}): Promise<{ ok: true; outboxId: string | null } | { ok: false }> {
  try {
    await deleteObject(input.storageKey);
    return { ok: true, outboxId: null };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    try {
      const row = await prisma.deletionOutbox.create({
        data: {
          storageKey: input.storageKey,
          reason: input.reason.slice(0, 80),
          entityType: input.entityType,
          entityId: input.entityId,
          lastError: name.slice(0, 80),
          status: "PENDING",
        },
      });
      logEvent("warn", "storage.deletion_queued", {
        entityType: input.entityType,
        digest: digest(input.storageKey),
        error: name,
      });
      return { ok: true, outboxId: row.id };
    } catch (queueError) {
      logEvent("error", "storage.deletion_queue_failed", {
        entityType: input.entityType,
        digest: digest(input.storageKey),
        error: queueError instanceof Error ? queueError.name : "Error",
      });
      return { ok: false };
    }
  }
}

export async function dropQueued(ids: string[]) {
  if (!ids.length) return;
  await prisma.deletionOutbox.deleteMany({ where: { id: { in: ids } } });
}

/** Retries pending deletes. Safe to run on a retention dry run: the delete was already decided. */
export async function reconcileDeletionOutbox(now = new Date()): Promise<{ done: number; failed: number }> {
  const due = await prisma.deletionOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: 50,
  });
  let done = 0;
  let failed = 0;
  for (const row of due) {
    try {
      await deleteObject(row.storageKey);
      await prisma.deletionOutbox.update({
        where: { id: row.id },
        data: { status: "DONE", lastError: "" },
      });
      done += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const name = error instanceof Error ? error.name : "Error";
      const giveUp = attempts >= MAX_ATTEMPTS;
      const delay = Math.min(24 * 60 * 60 * 1000, 60_000 * 2 ** attempts);
      await prisma.deletionOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: name.slice(0, 80),
          status: giveUp ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(now.getTime() + delay),
        },
      });
      if (giveUp) failed += 1;
      logEvent("warn", "storage.deletion_retry_failed", {
        digest: digest(row.storageKey),
        attempts,
        error: name,
      });
    }
  }
  return { done, failed };
}
