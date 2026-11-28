import "dotenv/config";
import { PrismaClient, type Skill } from "@prisma/client";
import { encryptString } from "../lib/crypto/field-encryption";
import { hashPassword } from "../lib/security/passwords";
import { PDPA_VERSION } from "../lib/validation/schemas";
import { experienceTarget } from "../lib/matching/score";

const prisma = new PrismaClient();
const PASSWORD = "Harbourlight-Dev-1";

const DEMO_EMAILS = [
  "admin@harbourlight.example",
  "staff@harbourlight.example",
  "employer@harbourlight.example",
  "candidate@harbourlight.example",
];

async function clearDemo() {
  const users = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } } });
  const userIds = users.map((user) => user.id);
  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.marketingDraft.deleteMany({
      where: { OR: [{ authorId: { in: userIds } }, { reviewerId: { in: userIds } }] },
    });
    await prisma.campaign.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.utmLink.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.matchWeightProfile.updateMany({
      where: { updatedById: { in: userIds } },
      data: { updatedById: null },
    });
  }
  await prisma.candidate.deleteMany({
    where: {
      OR: [{ email: { endsWith: "@harbourlight.example" } }, { userId: { in: userIds } }],
    },
  });
  await prisma.employer.deleteMany({
    where: { OR: [{ email: { in: DEMO_EMAILS } }, { userId: { in: userIds } }] },
  });
  await prisma.enquiry.deleteMany({ where: { email: { endsWith: "@harbourlight.example" } } });
  await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
}

async function main() {
  await clearDemo();
  await prisma.agencySetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      eaLicenceNo: "00C0000",
      personnel: [
        { name: "Amina Rahim", registrationNo: "R1100001" },
        { name: "Jun Wei Lim", registrationNo: "R1100002" },
      ],
      brandVoice: "Calm, specific, and respectful. Talk about the job.",
    },
    update: {
      eaLicenceNo: "00C0000",
    },
  });
  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date();

  const admin = await prisma.user.create({
    data: { email: "admin@harbourlight.example", name: "Amina Rahim", role: "ADMIN", passwordHash, emailVerifiedAt: now },
  });
  const staff = await prisma.user.create({
    data: { email: "staff@harbourlight.example", name: "Jun Wei Lim", role: "STAFF", passwordHash, emailVerifiedAt: now },
  });
  const employerUser = await prisma.user.create({
    data: { email: "employer@harbourlight.example", name: "Priya Menon", role: "EMPLOYER", passwordHash, emailVerifiedAt: now },
  });
  const candidateUser = await prisma.user.create({
    data: { email: "candidate@harbourlight.example", name: "Rosa Dela Cruz", role: "CANDIDATE", passwordHash, emailVerifiedAt: now },
  });

  const helpers: Array<{
    fullName: string;
    email: string;
    nationality: string;
    dateOfBirth: Date;
    status: "APPLIED" | "SCREENED" | "AVAILABLE";
    skills: Skill[];
    languages: string[];
    experienceYears: number;
    salary: number;
    photoConsent: boolean;
    userId?: string;
    blurb: string;
    passport?: string;
  }> = [
    {
      fullName: "Ana Reyes",
      email: "ana.reyes@harbourlight.example",
      nationality: "Philippines",
      dateOfBirth: new Date("1994-04-12"),
      status: "AVAILABLE",
      skills: ["INFANT_CARE", "COOKING", "HOUSEKEEPING"],
      languages: ["English", "Tagalog"],
      experienceYears: 6,
      salary: 650,
      photoConsent: true,
      blurb: "Fictional profile. Six years with infants and everyday cooking. Staff wrote this blurb.",
      passport: "P0001111",
    },
    {
      fullName: "Dewi Lestari",
      email: "dewi.lestari@harbourlight.example",
      nationality: "Indonesia",
      dateOfBirth: new Date("1990-09-02"),
      status: "AVAILABLE",
      skills: ["ELDERLY_CARE", "COOKING", "HOUSEKEEPING"],
      languages: ["English", "Bahasa Indonesia"],
      experienceYears: 8,
      salary: 600,
      photoConsent: true,
      blurb: "Fictional profile. Elderly care and home cooking. Illustration only, no real photograph.",
    },
    {
      fullName: "Carmen Cruz",
      email: "carmen.cruz@harbourlight.example",
      nationality: "Philippines",
      dateOfBirth: new Date("1996-01-20"),
      status: "SCREENED",
      skills: ["CHILD_CARE", "PET_CARE"],
      languages: ["English"],
      experienceYears: 3,
      salary: 580,
      photoConsent: false,
      blurb: "",
    },
    {
      fullName: "Lina Young",
      email: "lina.young@harbourlight.example",
      nationality: "Philippines",
      dateOfBirth: new Date("2008-06-01"),
      status: "APPLIED",
      skills: ["HOUSEKEEPING"],
      languages: ["English"],
      experienceYears: 0,
      salary: 500,
      photoConsent: false,
      blurb: "",
    },
    {
      fullName: "Rosa Dela Cruz",
      email: "candidate@harbourlight.example",
      nationality: "Philippines",
      dateOfBirth: new Date("1992-11-03"),
      status: "SCREENED",
      skills: ["COOKING", "CHILD_CARE"],
      languages: ["English", "Tagalog"],
      experienceYears: 4,
      salary: 620,
      photoConsent: false,
      userId: candidateUser.id,
      blurb: "",
    },
  ];

  for (const helper of helpers) {
    await prisma.candidate.create({
      data: {
        userId: helper.userId,
        fullName: helper.fullName,
        email: helper.email,
        phone: "+6500000000",
        nationality: helper.nationality,
        dateOfBirth: helper.dateOfBirth,
        sex: "FEMALE",
        educationYears: 10,
        experienceYears: helper.experienceYears,
        skills: helper.skills,
        languages: helper.languages,
        salaryExpectationSgd: helper.salary,
        availableFrom: new Date("2026-12-01"),
        status: helper.status,
        publicBlurb: helper.blurb,
        householdExperience: "Fictional work history written for the demonstration.",
        photoConsent: helper.photoConsent,
        fictional: true,
        firstTimeInSingapore: true,
        pdpaConsentAt: now,
        pdpaConsentVersion: PDPA_VERSION,
        passportNumberEnc: helper.passport ? encryptString(helper.passport) : null,
        medicalFitStatus: "PENDING",
        consents: {
          create: {
            subjectType: "Candidate",
            subjectId: "seed",
            purpose: "application_processing",
            policyVersion: PDPA_VERSION,
            granted: true,
          },
        },
      },
    });
  }

  const employer = await prisma.employer.create({
    data: {
      userId: employerUser.id,
      fullName: "Priya Menon",
      email: employerUser.email,
      phone: "+6500001111",
      householdSize: 4,
      childrenCount: 1,
      childrenUnder7Count: 1,
      elderlyCount: 0,
      hasPets: false,
      languagesPreferred: ["English"],
      skillsRequired: ["INFANT_CARE", "COOKING"],
      budgetMinSgd: 550,
      budgetMaxSgd: 750,
      startDate: new Date("2026-12-15"),
      housingType: "HDB",
      addressArea: "Queenstown",
      dateOfBirth: new Date("1988-03-14"),
      isUndischargedBankrupt: false,
      firstTimeEmployer: true,
      eopCompleted: true,
      eopCompletedOn: new Date("2026-11-16"),
      pdpaConsentAt: now,
      pdpaConsentVersion: PDPA_VERSION,
      notes: "Fictional household brief.",
    },
  });

  const snapshot = {
    skillsRequired: ["INFANT_CARE", "COOKING"],
    languagesPreferred: ["English"],
    experienceTargetYears: experienceTarget({ childrenCount: 1, elderlyCount: 0, hasPets: false }),
    budgetMinSgd: 550,
    budgetMaxSgd: 750,
    startDate: new Date("2026-12-15").toISOString(),
  };
  await prisma.employerRequirement.create({
    data: {
      employerId: employer.id,
      title: "Infant care in Queenstown",
      payload: snapshot,
    },
  });

  await prisma.enquiry.create({
    data: {
      kind: "contact",
      name: "Fictional caller",
      email: "caller@harbourlight.example",
      message: "Please tell me how interviews are arranged. This message is sample data.",
    },
  });

  await prisma.marketingDraft.create({
    data: {
      kind: "SOCIAL_POST",
      title: "December introductions",
      body: "Harbourlight is introducing fictional helper profiles this month. Staff still review every introduction before it is used.\n\nHarbourlight EA licence 00C0000 (fictional — not a real licence). Personnel: Amina Rahim R1100001 (fictional registration); Jun Wei Lim R1100002 (fictional registration). This introduces household employment. It is not an offer to sell or discount a person.",
      cautions: "Template draft. No external network was contacted.",
      source: "template",
      status: "DRAFT",
      authorId: staff.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "seed.complete",
      entityType: "User",
      entityId: admin.id,
      metadata: { fictional: true },
      ip: "127.0.0.1",
    },
  });

  console.log("Seeded fictional Harbourlight data. Password for every demo account:", PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
