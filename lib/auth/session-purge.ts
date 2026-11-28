import { revokedSessionRetentionMs } from "@/lib/auth/session-policy";
import { prisma } from "@/lib/db";

export type SessionPurgeCounts = {
  expired: number;
  revoked: number;
};

/** Deletes expired sessions, then revoked sessions older than the retention window. */
export async function purgeStaleSessions(now = new Date()): Promise<SessionPurgeCounts> {
  const revokedBefore = new Date(now.getTime() - revokedSessionRetentionMs());
  const expired = await prisma.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const revoked = await prisma.session.deleteMany({
    where: { revokedAt: { not: null, lt: revokedBefore } },
  });
  return { expired: expired.count, revoked: revoked.count };
}
