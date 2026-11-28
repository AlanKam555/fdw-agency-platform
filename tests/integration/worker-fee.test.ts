import { afterAll, describe, expect, it } from "vitest";
import { recordWorkerFee } from "@/lib/billing/worker-fee";
import { prisma } from "@/lib/db";

const stamp = `fee-${Date.now()}`;
const email = `${stamp}@harbourlight.example`;

describe("helper agency fee", () => {
  afterAll(async () => {
    const candidate = await prisma.candidate.findFirst({ where: { email } });
    if (candidate) await prisma.workerFee.deleteMany({ where: { candidateId: candidate.id } });
    await prisma.candidate.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("refuses a fee above the cap and records one inside it", async () => {
    const user = await prisma.user.create({
      data: { email, name: "Fee Fixture", role: "CANDIDATE", passwordHash: "not-used" },
    });
    const candidate = await prisma.candidate.create({
      data: {
        userId: user.id,
        fullName: "Fee Fixture",
        email,
        nationality: "Philippines",
        dateOfBirth: new Date("1992-01-01"),
        sex: "FEMALE",
        educationYears: 10,
        experienceYears: 2,
        salaryExpectationSgd: 650,
        availableFrom: new Date("2026-12-01"),
        status: "APPLIED",
        fictional: true,
      },
    });

    const refused = await recordWorkerFee({
      candidateId: candidate.id,
      monthlySalaryCents: 65000,
      contractMonths: 24,
      workPassMonths: 24,
      feeCents: 200000,
      actorId: user.id,
      ip: "test",
    });
    expect(refused.ok).toBe(false);
    expect(await prisma.workerFee.count({ where: { candidateId: candidate.id } })).toBe(0);

    const recorded = await recordWorkerFee({
      candidateId: candidate.id,
      monthlySalaryCents: 65000,
      contractMonths: 24,
      workPassMonths: 24,
      feeCents: 130000,
      actorId: user.id,
      ip: "test",
    });
    expect(recorded.ok).toBe(true);
    if (recorded.ok) expect(recorded.note).toContain("50%");
    expect(await prisma.workerFee.count({ where: { candidateId: candidate.id } })).toBe(1);
  });
});
