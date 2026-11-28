import { createHash, createHmac, randomBytes } from "node:crypto";
import { derivedKey } from "@/lib/crypto/hkdf";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { writeAudit } from "@/lib/audit";
import { idleTimeoutMs, sessionAbsoluteSeconds } from "@/lib/auth/session-policy";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session";

/** Last-seen writes are debounced. Idle checks can be early by at most this long. */
const SEEN_REFRESH_MS = 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabledAt: Date | null;
  totpEnabledAt: Date | null;
  totpSetupDueAt: Date | null;
};

export type SessionResolution =
  | { kind: "anonymous" }
  | { kind: "disabled"; userId: string }
  | { kind: "stale" }
  | { kind: "active"; payload: SessionPayload; user: SessionUser };

export function hashSessionId(sid: string): string {
  return createHash("sha256").update(sid).digest("hex");
}

function clientHash(value: string): string {
  return createHmac("sha256", derivedKey("client-hash")).update(value.slice(0, 200)).digest("hex").slice(0, 32);
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  disabledAt: true,
  totpEnabledAt: true,
  totpSetupDueAt: true,
} as const;

export async function issueSession(input: {
  user: { id: string; role: Role; name: string };
  csrf: string;
  ip?: string | null;
  userAgent?: string | null;
  now?: number;
}): Promise<{ token: string; sid: string }> {
  const now = input.now ?? Date.now();
  const sid = randomBytes(32).toString("base64url");
  const lifetime = sessionAbsoluteSeconds();
  const exp = Math.floor(now / 1000) + lifetime;
  await prisma.session.create({
    data: {
      tokenHash: hashSessionId(sid),
      userId: input.user.id,
      expiresAt: new Date(exp * 1000),
      ipHash: input.ip ? clientHash(input.ip) : null,
      userAgentHash: input.userAgent ? clientHash(input.userAgent) : null,
    },
  });
  const token = createSessionToken({
    sub: input.user.id,
    role: input.user.role,
    name: input.user.name,
    csrf: input.csrf,
    sid,
    now,
    lifetimeSeconds: lifetime,
  });
  return { token, sid };
}

export async function resolveRequestSession(
  token: string | undefined | null,
  options?: { now?: number; ip?: string | null },
): Promise<SessionResolution> {
  if (!token) return { kind: "anonymous" };
  const now = options?.now ?? Date.now();
  let payload: SessionPayload | null = null;
  try {
    payload = verifySessionToken(token, now);
  } catch {
    return { kind: "stale" };
  }
  if (!payload) return { kind: "stale" };

  const row = await prisma.session.findUnique({
    where: { tokenHash: hashSessionId(payload.sid) },
    include: { user: { select: userSelect } },
  });
  if (!row || row.userId !== payload.sub || row.revokedAt || row.expiresAt.getTime() <= now) {
    return { kind: "stale" };
  }
  if (row.user.disabledAt) {
    return { kind: "disabled", userId: row.user.id };
  }

  if (now - row.lastSeenAt.getTime() >= idleTimeoutMs(row.user.role)) {
    const revoked = await prisma.session.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date(now) },
    });
    if (revoked.count) {
      await writeAudit({
        actorId: row.userId,
        action: "auth.session_idle",
        entityType: "Session",
        entityId: row.id,
        metadata: { role: row.user.role },
        ip: options?.ip,
      });
    }
    return { kind: "stale" };
  }

  if (now - row.lastSeenAt.getTime() >= SEEN_REFRESH_MS) {
    await prisma.session
      .updateMany({
        where: { id: row.id, revokedAt: null },
        data: { lastSeenAt: new Date(now) },
      })
      .catch(() => undefined);
  }

  return {
    kind: "active",
    user: row.user,
    payload: {
      ...payload,
      sub: row.user.id,
      role: row.user.role,
      name: row.user.name,
    },
  };
}

export async function revokeCurrentSession(input: {
  sid: string;
  actorId?: string | null;
  ip?: string | null;
}): Promise<void> {
  const result = await prisma.session.updateMany({
    where: { tokenHash: hashSessionId(input.sid), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count) return;
  await writeAudit({
    actorId: input.actorId,
    action: "auth.logout",
    entityType: "User",
    entityId: input.actorId ?? "unknown",
    ip: input.ip,
  });
}

export async function revokeSessionById(input: {
  sessionId: string;
  actorId: string;
  ip?: string | null;
}): Promise<{ userId: string } | null> {
  const row = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!row || row.revokedAt) return null;
  await prisma.session.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "auth.session_revoked",
    entityType: "Session",
    entityId: row.id,
    metadata: { userId: row.userId },
    ip: input.ip,
  });
  logEvent("info", "auth.session_revoked", { userId: row.userId });
  return { userId: row.userId };
}

export async function revokeAllSessions(input: {
  userId: string;
  reason: string;
  actorId?: string | null;
  ip?: string | null;
}): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count > 0) {
    await writeAudit({
      actorId: input.actorId,
      action: "auth.sessions_revoked",
      entityType: "User",
      entityId: input.userId,
      metadata: { reason: input.reason, sessions: result.count },
      ip: input.ip,
    });
    logEvent("info", "auth.sessions_revoked", {
      userId: input.userId,
      reason: input.reason,
      sessions: result.count,
    });
  }
  return result.count;
}
