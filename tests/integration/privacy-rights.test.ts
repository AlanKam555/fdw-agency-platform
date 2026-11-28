import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/security/passwords";
import { issueSession } from "@/lib/auth/sessions";
import { writeAudit } from "@/lib/audit";
import { hashAuditRow, verifyAuditChain } from "@/lib/audit-chain";
import { reserveBudget, settleBudget } from "@/lib/ai/budget";
import { redactCandidate, redactEmployer } from "@/lib/privacy/redact";
import { changeConsent } from "@/lib/privacy/consent";
import { setBlobStoreForTests, type BlobStore } from "@/lib/storage/files";
import { reconcileDeletionOutbox } from "@/lib/storage/deletion-outbox";
import { POST as exportData } from "@/app/api/privacy/export/route";

const stamp = `privacy-${Date.now()}`;
const password = "Harbourlight-Dev-1";

describe("data-subject rights, budget, and audit chain", () => {
  const createdUsers: string[] = [];
  const candidateIds: string[] = [];
  const employerIds: string[] = [];

  afterAll(async () => {
    setBlobStoreForTests(null);
    await prisma.deletionOutbox.deleteMany({ where: { entityId: { in: [...candidateIds, ...employerIds] } } });
    await prisma.placementOutcome.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.match.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.marketingDraft.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.document.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.employerRequirement.deleteMany({ where: { employerId: { in: employerIds } } });
    await prisma.candidate.deleteMany({ where: { id: { in: candidateIds } } });
    await prisma.employer.deleteMany({ where: { id: { in: employerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers }, auditLogs: { none: {} } } });
    await prisma.$disconnect();
  });

  it("redacts a helper, queues a failed object delete, and redacts a household", async () => {
    const user = await prisma.user.create({
      data: { email: `${stamp}-helper@harbourlight.example`, name: "Helper Fixture", role: "CANDIDATE", passwordHash: "x" },
    });
    createdUsers.push(user.id);
    const employerUser = await prisma.user.create({
      data: { email: `${stamp}-home@harbourlight.example`, name: "Home Fixture", role: "EMPLOYER", passwordHash: "x" },
    });
    createdUsers.push(employerUser.id);
    const candidate = await prisma.candidate.create({
      data: {
        userId: user.id,
        fullName: "Fixture Helper Name",
        email: `${stamp}-helper@harbourlight.example`,
        phone: "91234567",
        nationality: "Philippines",
        dateOfBirth: new Date("1992-01-01"),
        sex: "FEMALE",
        educationYears: 10,
        experienceYears: 4,
        salaryExpectationSgd: 650,
        availableFrom: new Date("2026-01-01"),
        status: "AVAILABLE",
        publicBlurb: "Visible blurb",
        householdExperience: "Infant care",
        internalNotes: stamp,
        photoConsent: true,
        marketingConsent: true,
        fictional: true,
      },
    });
    candidateIds.push(candidate.id);
    const employer = await prisma.employer.create({
      data: {
        userId: employerUser.id,
        fullName: "Fixture Household Name",
        email: `${stamp}-home@harbourlight.example`,
        phone: "81234567",
        householdSize: 3,
        languagesPreferred: ["English"],
        budgetMinSgd: 500,
        budgetMaxSgd: 800,
        startDate: new Date("2026-02-01"),
        housingType: "HDB",
        addressArea: "Tampines",
        notes: stamp,
        nricEnc: "ciphertext",
      },
    });
    employerIds.push(employer.id);
    const requirement = await prisma.employerRequirement.create({
      data: { employerId: employer.id, title: stamp, payload: { note: "keep me" } },
    });
    const match = await prisma.match.create({
      data: {
        requirementId: requirement.id,
        candidateId: candidate.id,
        employerId: employer.id,
        score: 70,
        eligible: true,
        breakdown: { total: 70 },
        explanation: `explanation ${stamp}`,
      },
    });
    await prisma.placementOutcome.create({
      data: {
        matchId: match.id,
        candidateId: candidate.id,
        employerId: employer.id,
        startedOn: new Date("2026-03-01"),
        durationDays: 30,
        completion: "ONGOING",
        reasonCategory: "NONE",
        employerSatisfaction: 4,
        helperSatisfaction: 4,
        notes: stamp,
        recordedById: employerUser.id,
      },
    });
    await prisma.marketingDraft.create({
      data: {
        kind: "PROFILE_BLURB",
        title: "Fixture Helper Name",
        body: `body ${stamp}`,
        source: "template",
        authorId: employerUser.id,
        candidateId: candidate.id,
      },
    });
    const key = `objects/${stamp}.bin`;
    await prisma.document.create({
      data: {
        candidateId: candidate.id,
        kind: "PASSPORT",
        fileName: `${stamp}.bin`,
        contentType: "application/octet-stream",
        byteSize: 4,
        storageKey: key,
        sha256: "abc",
      },
    });
    const throwing: BlobStore = {
      wrapsWithFieldEncryption: false,
      async put() {},
      async get() {
        return Buffer.from("nope");
      },
      async delete() {
        const error = new Error("store down");
        error.name = "StoreDown";
        throw error;
      },
    };
    setBlobStoreForTests(throwing);
    const result = await redactCandidate({ candidateId: candidate.id, actorId: employerUser.id, ip: "test" });
    expect(result.ok).toBe(true);
    const wiped = await prisma.candidate.findUnique({ where: { id: candidate.id } });
    expect(wiped?.fullName).toBe("Redacted profile");
    expect(wiped?.nationality).toBe("REDACTED");
    expect(wiped?.email).toBeNull();
    expect(wiped?.phone).toBeNull();
    expect(wiped?.salaryExpectationSgd).toBe(0);
    const kept = await prisma.match.findUnique({ where: { id: match.id } });
    expect(kept?.score).toBe(70);
    expect(kept?.explanation).toBe("");
    const outcome = await prisma.placementOutcome.findFirst({ where: { matchId: match.id } });
    expect(outcome?.notes).toBe("");
    expect(outcome?.completion).toBe("ONGOING");
    const draft = await prisma.marketingDraft.findFirst({ where: { candidateId: candidate.id } });
    expect(draft?.body).toBe("Redacted.");
    const queued = await prisma.deletionOutbox.findFirst({ where: { storageKey: key } });
    expect(queued?.status).toBe("PENDING");
    expect(await prisma.document.count({ where: { id: { not: "" }, storageKey: key } })).toBe(0);

    throwing.delete = async () => {};
    const reconciled = await reconcileDeletionOutbox();
    expect(reconciled.done).toBeGreaterThanOrEqual(1);

    const home = await redactEmployer({ employerId: employer.id, actorId: employerUser.id, ip: "test" });
    expect(home.ok).toBe(true);
    const household = await prisma.employer.findUnique({ where: { id: employer.id } });
    expect(household?.fullName).toBe("Redacted household");
    expect(household?.nricEnc).toBeNull();
    expect(household?.notes).toBe("");
    const requirementAfter = await prisma.employerRequirement.findUnique({ where: { id: requirement.id } });
    expect(requirementAfter?.title).toBe("Redacted requirement");
  });

  it("reserves a user budget once and releases it", async () => {
    const previous = process.env.AI_USER_MAX_CALLS_PER_DAY;
    process.env.AI_USER_MAX_CALLS_PER_DAY = "1";
    try {
      const actorId = `${stamp}-actor`;
      const first = await reserveBudget({ feature: `privacy-${stamp}`, actorId, kind: "chat", reserveMicro: 1 });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const second = await reserveBudget({ feature: `privacy-${stamp}`, actorId, kind: "chat", reserveMicro: 1 });
      expect(second.ok).toBe(false);
      await settleBudget(first.reservationId, 0, false);
      const released = await prisma.aiReservation.findUnique({ where: { id: first.reservationId } });
      expect(released?.status).toBe("RELEASED");
    } finally {
      if (previous === undefined) delete process.env.AI_USER_MAX_CALLS_PER_DAY;
      else process.env.AI_USER_MAX_CALLS_PER_DAY = previous;
    }
  });

  it("detects a tampered audit row and accepts the restored row", async () => {
    await writeAudit({ action: "test.chain", entityType: "Test", entityId: `${stamp}-a`, metadata: { n: 1 } });
    await writeAudit({ action: "test.chain", entityType: "Test", entityId: `${stamp}-b`, metadata: { n: 2 } });
    const sound = await verifyAuditChain();
    expect(sound.ok).toBe(true);
    const row = await prisma.auditLog.findFirst({ where: { entityId: `${stamp}-b` } });
    expect(row?.seq).toBeTruthy();
    await prisma.auditLog.update({ where: { id: row!.id }, data: { metadata: { n: 9 } } });
    const broken = await verifyAuditChain();
    expect(broken.ok).toBe(false);
    expect(broken.problems.some((problem) => problem.includes("row_hash"))).toBe(true);
    const restoredHash = hashAuditRow({
      seq: row!.seq!,
      actorId: row!.actorId,
      action: row!.action,
      entityType: row!.entityType,
      entityId: row!.entityId,
      metadata: { n: 2 },
      ip: row!.ip,
      prevHash: row!.prevHash ?? "",
    });
    await prisma.auditLog.update({ where: { id: row!.id }, data: { metadata: { n: 2 }, rowHash: restoredHash } });
    const again = await verifyAuditChain();
    expect(again.ok).toBe(true);
  });

  it("withdraws photo consent and refuses an export with the wrong password", async () => {
    const user = await prisma.user.create({
      data: {
        email: `${stamp}-export@harbourlight.example`,
        name: "Export Fixture",
        role: "CANDIDATE",
        passwordHash: await hashPassword(password),
      },
    });
    createdUsers.push(user.id);
    const candidate = await prisma.candidate.create({
      data: {
        userId: user.id,
        fullName: "Export Fixture",
        email: `${stamp}-export@harbourlight.example`,
        nationality: "Indonesia",
        dateOfBirth: new Date("1994-04-04"),
        sex: "FEMALE",
        educationYears: 12,
        experienceYears: 3,
        salaryExpectationSgd: 600,
        availableFrom: new Date("2026-04-01"),
        publicBlurb: "Should leave the gallery",
        photoConsent: true,
        marketingConsent: true,
        internalNotes: stamp,
        fictional: true,
      },
    });
    candidateIds.push(candidate.id);
    const withdrawn = await changeConsent({
      role: "CANDIDATE",
      userId: user.id,
      purpose: "photo_publication",
      granted: false,
      ip: "test",
    });
    expect(withdrawn.ok).toBe(true);
    const after = await prisma.candidate.findUnique({ where: { id: candidate.id } });
    expect(after?.photoConsent).toBe(false);
    expect(after?.publicBlurb).toBe("");
    const history = await prisma.consentRecord.count({ where: { candidateId: candidate.id, purpose: "photo_publication", granted: false } });
    expect(history).toBeGreaterThanOrEqual(1);

    const csrf = "csrf-token-value";
    const session = await issueSession({ user: { id: user.id, role: "CANDIDATE", name: user.name }, csrf });
    const response = await exportData(
      new NextRequest("http://localhost:3000/api/privacy/export", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: `hl_session=${session.token}; hl_csrf=${csrf}`,
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ password: "not-the-password", format: "json" }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
