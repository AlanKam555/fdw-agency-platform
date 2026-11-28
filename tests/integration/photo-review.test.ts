import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET as portrait } from "@/app/api/portraits/[id]/route";
import { saveStoredObject } from "@/lib/storage/files";

const stamp = `photo-${Date.now()}`;
const email = `${stamp}@harbourlight.example`;

describe("portrait approval", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("hides a photo until staff approve it", async () => {
    const staff = await prisma.user.create({
      data: {
        email,
        name: "Photo Reviewer",
        role: "STAFF",
        passwordHash: "not-used",
        emailVerifiedAt: new Date(),
      },
    });
    const candidate = await prisma.candidate.create({
      data: {
        fullName: "Photo Fixture",
        email: `helper-${email}`,
        nationality: "Philippines",
        dateOfBirth: new Date("1994-04-12"),
        sex: "FEMALE",
        educationYears: 10,
        experienceYears: 4,
        salaryExpectationSgd: 600,
        availableFrom: new Date("2026-12-01"),
        status: "AVAILABLE",
        photoConsent: true,
        marketingConsent: true,
        fictional: true,
      },
    });
    const stored = await saveStoredObject(Buffer.from("jpeg-bytes"), { contentType: "image/jpeg" });
    const document = await prisma.document.create({
      data: {
        candidateId: candidate.id,
        kind: "PHOTO",
        fileName: "portrait.jpg",
        contentType: "image/jpeg",
        byteSize: 10,
        storageKey: stored.storageKey,
        sha256: stored.sha256,
        uploadedById: staff.id,
      },
    });
    const hidden = await portrait(new NextRequest(`http://localhost:3000/api/portraits/${candidate.id}`), {
      params: Promise.resolve({ id: candidate.id }),
    });
    expect(hidden.status).toBe(404);

    await prisma.document.update({
      where: { id: document.id },
      data: { reviewedAt: new Date(), approvedById: staff.id, rejectedAt: null },
    });
    const shown = await portrait(new NextRequest(`http://localhost:3000/api/portraits/${candidate.id}`), {
      params: Promise.resolve({ id: candidate.id }),
    });
    expect(shown.status).toBe(200);
    expect(shown.headers.get("content-type")).toContain("image/jpeg");
    await prisma.candidate.delete({ where: { id: candidate.id } });
  });
});
