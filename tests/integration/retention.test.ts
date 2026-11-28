import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runRetention } from "@/lib/privacy/retention";

const stamp = `retention-${Date.now()}`;
const email = `${stamp}@harbourlight.example`;

describe("retention job", () => {
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: stamp, seq: null } });
    await prisma.enquiry.deleteMany({ where: { email } });
    const addresses = [email, `unverified-${stamp}@harbourlight.example`];
    await prisma.candidate.deleteMany({ where: { email: { in: addresses } } });
    await prisma.user.deleteMany({ where: { email: { in: addresses } } });
    await prisma.$disconnect();
  });

  it("reports due rows and redacts them only when enforcement is on", async () => {
    const user = await prisma.user.create({
      data: {
        email,
        name: "Retention Fixture",
        role: "CANDIDATE",
        passwordHash: "not-used",
      },
    });
    const candidate = await prisma.candidate.create({
      data: {
        userId: user.id,
        fullName: "Retention Fixture",
        email,
        nationality: "Philippines",
        dateOfBirth: new Date("1992-01-01"),
        sex: "FEMALE",
        educationYears: 10,
        experienceYears: 2,
        salaryExpectationSgd: 600,
        availableFrom: new Date("2024-01-01"),
        status: "REJECTED",
        updatedAt: new Date("2020-01-01"),
        fictional: true,
      },
    });
    await prisma.enquiry.create({
      data: {
        kind: "contact",
        name: "Retention Fixture",
        email,
        message: "Fictional retention fixture message.",
        createdAt: new Date("2020-01-01"),
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "test.old",
        entityType: "Test",
        entityId: stamp,
        createdAt: new Date("2020-01-01"),
      },
    });

    const dry = await runRetention({ now: new Date("2026-11-26T00:00:00.000Z"), enforce: false, ip: "test" });
    expect(dry.enforced).toBe(false);
    expect(dry.counts.enquiries).toBeGreaterThanOrEqual(1);
    expect(dry.counts.candidates).toBeGreaterThanOrEqual(1);
    expect(dry.counts.auditLogs).toBeGreaterThanOrEqual(1);
    expect(dry.processed).toEqual({
      enquiries: 0,
      candidates: 0,
      auditLogs: 0,
      unverifiedAccounts: 0,
      employers: 0,
      matchExplanations: 0,
      outcomeNotes: 0,
      interviewNotes: 0,
      marketingDrafts: 0,
      testimonials: 0,
      sessions: 0,
    });
    expect(JSON.stringify(dry)).not.toContain(email);

    const enforced = await runRetention({
      now: new Date("2026-11-26T00:00:00.000Z"),
      enforce: true,
      purgeAudit: false,
      ip: "test",
    });
    expect(enforced.processed.candidates).toBeGreaterThanOrEqual(1);
    expect(enforced.processed.enquiries).toBeGreaterThanOrEqual(1);
    expect(enforced.processed.auditLogs).toBe(0);
    const stored = await prisma.candidate.findUnique({ where: { id: candidate.id } });
    expect(stored?.redactedAt).toBeTruthy();
    expect(stored?.passportNumberEnc).toBeNull();
    expect(await prisma.enquiry.count({ where: { email } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: stamp } })).toBe(1);

    const purged = await runRetention({
      now: new Date("2026-11-26T00:00:00.000Z"),
      enforce: true,
      purgeAudit: true,
      ip: "test",
    });
    expect(purged.processed.auditLogs).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditLog.count({ where: { entityId: stamp } })).toBe(0);
  });

  it("deletes an old unconfirmed employer or helper account", async () => {
    const address = `unverified-${stamp}@harbourlight.example`;
    const user = await prisma.user.create({
      data: {
        email: address,
        name: "Unconfirmed",
        role: "CANDIDATE",
        passwordHash: "not-used",
        emailVerifiedAt: null,
        createdAt: new Date("2020-01-01"),
      },
    });
    const candidate = await prisma.candidate.create({
      data: {
        userId: user.id,
        fullName: "Unconfirmed",
        email: address,
        nationality: "Philippines",
        dateOfBirth: new Date("1992-01-01"),
        sex: "FEMALE",
        educationYears: 10,
        experienceYears: 1,
        salaryExpectationSgd: 600,
        availableFrom: new Date("2026-12-01"),
        status: "APPLIED",
        fictional: true,
      },
    });
    const report = await runRetention({
      now: new Date("2026-11-26T00:00:00.000Z"),
      enforce: true,
      ip: "test",
    });
    expect(report.processed.unverifiedAccounts).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.candidate.findUnique({ where: { id: candidate.id } })).toBeNull();
    expect(JSON.stringify(report)).not.toContain(address);
  });
});
