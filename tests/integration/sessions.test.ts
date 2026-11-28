import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/security/passwords";
import { issueSession, resolveRequestSession } from "@/lib/auth/sessions";
import { purgeStaleSessions } from "@/lib/auth/session-purge";
import { createSessionToken } from "@/lib/auth/session";

const stamp = `idle-${Date.now()}`;
const staffEmail = `${stamp}-staff@harbourlight.example`;
const employerEmail = `${stamp}-employer@harbourlight.example`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [staffEmail, employerEmail] } } });
  await prisma.$disconnect();
});

describe("idle sessions", () => {
  it("revokes a staff session after the idle window and leaves a portal session", async () => {
    const passwordHash = await hashPassword("Harbourlight-Dev-1");
    const staff = await prisma.user.create({
      data: { email: staffEmail, name: "Idle Staff", role: "STAFF", passwordHash, totpSetupDueAt: null },
    });
    const employer = await prisma.user.create({
      data: { email: employerEmail, name: "Idle Employer", role: "EMPLOYER", passwordHash, emailVerifiedAt: new Date() },
    });
    const staffSession = await issueSession({ user: staff, csrf: "a".repeat(32) });
    const employerSession = await issueSession({ user: employer, csrf: "b".repeat(32) });
    const staffRow = await prisma.session.findFirstOrThrow({ where: { userId: staff.id } });
    const employerRow = await prisma.session.findFirstOrThrow({ where: { userId: employer.id } });
    await prisma.session.update({
      where: { id: staffRow.id },
      data: { lastSeenAt: new Date(Date.now() - 31 * 60 * 1000) },
    });
    await prisma.session.update({
      where: { id: employerRow.id },
      data: { lastSeenAt: new Date(Date.now() - 11 * 60 * 60 * 1000) },
    });

    const idle = await resolveRequestSession(staffSession.token);
    const still = await resolveRequestSession(employerSession.token);
    expect(idle.kind).toBe("stale");
    expect(still.kind).toBe("active");
    const revoked = await prisma.session.findUniqueOrThrow({ where: { id: staffRow.id } });
    expect(revoked.revokedAt).toBeTruthy();
    const audit = await prisma.auditLog.findFirst({
      where: { action: "auth.session_idle", entityId: staffRow.id },
    });
    expect(audit?.metadata).toMatchObject({ role: "STAFF" });
    expect(JSON.stringify(audit?.metadata)).not.toContain(staffEmail);
  });

  it("keeps a disabled account on the disabled path", async () => {
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    await prisma.user.update({ where: { id: staff.id }, data: { disabledAt: new Date() } });
    const issued = await issueSession({ user: staff, csrf: "c".repeat(32) });
    const row = await prisma.session.findFirstOrThrow({ where: { tokenHash: { not: "" }, userId: staff.id, revokedAt: null }, orderBy: { createdAt: "desc" } });
    await prisma.session.update({ where: { id: row.id }, data: { lastSeenAt: new Date(Date.now() - 31 * 60 * 1000) } });
    const resolved = await resolveRequestSession(issued.token);
    expect(resolved.kind).toBe("disabled");
    const stored = await prisma.session.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.revokedAt).toBeNull();
  });

  it("deletes expired sessions and keeps a fresh revocation", async () => {
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    const expired = await prisma.session.create({
      data: {
        tokenHash: `expired-${stamp}`,
        userId: staff.id,
        expiresAt: new Date(Date.now() - 60_000),
        lastSeenAt: new Date(),
      },
    });
    const freshRevoke = await prisma.session.create({
      data: {
        tokenHash: `revoked-${stamp}`,
        userId: staff.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: new Date(),
      },
    });
    const counts = await purgeStaleSessions(new Date());
    expect(counts.expired).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: freshRevoke.id } })).toBeTruthy();
    const forged = createSessionToken({
      sub: staff.id,
      role: "STAFF",
      name: staff.name,
      sid: "not-a-row",
      now: Date.now() - 8 * 24 * 60 * 60 * 1000,
      lifetimeSeconds: 60,
    });
    expect((await resolveRequestSession(forged)).kind).toBe("stale");
  });
});
