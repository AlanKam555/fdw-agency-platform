import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { issueSession } from "@/lib/auth/sessions";
import { hashPassword } from "@/lib/security/passwords";
import { changeCandidateStatus, createCandidateApplication } from "@/lib/services/candidates";
import { saveEmployerRequirement } from "@/lib/services/employers";
import { decideMatch, runRanking } from "@/lib/services/matching";
import { momPdf, prepareMomCase } from "@/lib/services/mom";
import { POST as staffIntake } from "@/app/api/staff/candidates/route";

const stamp = `${Date.now()}`;
const staffEmail = `it-staff-${stamp}@harbourlight.example`;
const employerEmail = `it-employer-${stamp}@harbourlight.example`;
const helperEmail = `it-helper-${stamp}@harbourlight.example`;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: [staffEmail, employerEmail, helperEmail] } },
  });
  const ids = users.map((user) => user.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.marketingDraft.deleteMany({
      where: { OR: [{ authorId: { in: ids } }, { reviewerId: { in: ids } }] },
    });
  }
  await prisma.candidate.deleteMany({ where: { email: helperEmail } });
  await prisma.employer.deleteMany({ where: { email: employerEmail } });
  await prisma.user.deleteMany({ where: { email: { in: [staffEmail, employerEmail, helperEmail] } } });
}

describe("hiring flow", () => {
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("screens a helper, ranks her, and prepares a MOM pack without submitting it", async () => {
    const passwordHash = await hashPassword("Harbourlight-Dev-1");
    const staff = await prisma.user.create({
      data: { email: staffEmail, name: "Test Staff", role: "STAFF", passwordHash },
    });
    const employerUser = await prisma.user.create({
      data: { email: employerEmail, name: "Test Employer", role: "EMPLOYER", passwordHash },
    });

    const created = await createCandidateApplication(
      {
        fullName: "Test Helper",
        email: helperEmail,
        phone: "+6511112222",
        nationality: "Philippines",
        dateOfBirth: new Date("1994-04-12"),
        sex: "FEMALE",
        educationYears: 10,
        experienceYears: 6,
        skills: ["INFANT_CARE", "COOKING"],
        languages: ["English"],
        salaryExpectationSgd: 650,
        availableFrom: new Date("2026-12-01"),
        householdExperience: "Fictional test history",
        passportNumber: "",
        medicalNotes: "",
        medicalFitStatus: "PENDING",
        firstTimeInSingapore: true,
        photoConsent: true,
        pdpaConsent: true,
        internalNotes: "",
      },
      { ip: "127.0.0.1", actorId: staff.id, fictional: true },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const screened = await changeCandidateStatus({
      candidateId: created.candidate.id,
      status: "SCREENED",
      actorId: staff.id,
      ip: "127.0.0.1",
    });
    expect(screened.ok).toBe(true);
    const available = await changeCandidateStatus({
      candidateId: created.candidate.id,
      status: "AVAILABLE",
      actorId: staff.id,
      ip: "127.0.0.1",
    });
    expect(available.ok).toBe(true);

    const saved = await saveEmployerRequirement(
      {
        fullName: "Test Employer",
        email: employerEmail,
        phone: "+6511113333",
        householdSize: 3,
        childrenCount: 1,
        childrenUnder7Count: 0,
        measlesVaccinatedUnder7: null,
        elderlyCount: 0,
        hasPets: false,
        languagesPreferred: ["English"],
        skillsRequired: ["INFANT_CARE", "COOKING"],
        budgetMinSgd: 500,
        budgetMaxSgd: 800,
        startDate: new Date("2026-12-15"),
        housingType: "HDB",
        addressArea: "Queenstown",
        dateOfBirth: new Date("1988-03-14"),
        isUndischargedBankrupt: false,
        firstTimeEmployer: true,
        eopCompleted: true,
        eopCompletedOn: new Date("2026-11-16"),
        notes: "Integration test",
        pdpaConsent: true,
        title: "Integration requirement",
      },
      { userId: employerUser.id, actorId: staff.id, ip: "127.0.0.1", kind: "account" },
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok || !saved.requirementId) return;

    const ranked = await runRanking({
      requirementId: saved.requirementId,
      actorId: staff.id,
      ip: "127.0.0.1",
    });
    expect(ranked.ok).toBe(true);

    const match = await prisma.match.findUnique({
      where: {
        requirementId_candidateId: {
          requirementId: saved.requirementId,
          candidateId: created.candidate.id,
        },
      },
    });
    expect(match?.eligible).toBe(true);
    expect(match?.explanation.length).toBeGreaterThan(20);

    const decision = await decideMatch({
      matchId: match!.id,
      decision: "STAFF_APPROVED",
      actorId: staff.id,
      ip: "127.0.0.1",
    });
    expect(decision.ok).toBe(true);

    const pack = await prepareMomCase({
      matchId: match!.id,
      actorId: staff.id,
      ip: "127.0.0.1",
      attestation: {
        notRelated: true,
        fdwOutsideSingapore: true,
        securityBondArranged: true,
        medicalInsuranceArranged: true,
        personalAccidentArranged: true,
        addressIsNricRegistered: true,
        salaryAgreedSgd: 650,
        restDaysPerMonth: 4,
        proposedSubmissionDate: new Date("2026-12-01"),
      },
    });
    expect(pack.ok).toBe(true);
    if (pack.ok) expect(pack.momCase.ready).toBe(true);

    const pdf = await momPdf(match!.id);
    expect(Buffer.from(pdf!.bytes.subarray(0, 4)).toString("utf8")).toBe("%PDF");

    const csrf = "c".repeat(32);
    const issued = await issueSession({
      user: { id: employerUser.id, role: "EMPLOYER", name: "Test Employer" },
      csrf,
    });
    const token = issued.token;
    const response = await staffIntake(
      new NextRequest("http://localhost:3000/api/staff/candidates", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: `hl_session=${token}; hl_csrf=${csrf}`,
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ fullName: "Should fail" }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
