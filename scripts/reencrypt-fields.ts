import { prisma } from "../lib/db";
import { reencryptField, reencryptTotp } from "../lib/crypto/field-encryption";

async function main() {
  let fields = 0;
  let totp = 0;
  const candidates = await prisma.candidate.findMany({
    select: { id: true, passportNumberEnc: true, finEnc: true, medicalNotesEnc: true },
  });
  for (const row of candidates) {
    const data: { passportNumberEnc?: string; finEnc?: string; medicalNotesEnc?: string } = {};
    for (const field of ["passportNumberEnc", "finEnc", "medicalNotesEnc"] as const) {
      const value = row[field];
      if (!value) continue;
      const next = reencryptField(value);
      if (next.changed) data[field] = next.value;
    }
    if (Object.keys(data).length) {
      await prisma.candidate.update({ where: { id: row.id }, data });
      fields += Object.keys(data).length;
    }
  }
  const employers = await prisma.employer.findMany({ select: { id: true, nricEnc: true } });
  for (const row of employers) {
    if (!row.nricEnc) continue;
    const next = reencryptField(row.nricEnc);
    if (!next.changed) continue;
    await prisma.employer.update({ where: { id: row.id }, data: { nricEnc: next.value } });
    fields += 1;
  }
  const users = await prisma.user.findMany({
    select: { id: true, totpSecretEnc: true, totpPendingSecretEnc: true },
  });
  for (const row of users) {
    const data: { totpSecretEnc?: string; totpPendingSecretEnc?: string } = {};
    for (const field of ["totpSecretEnc", "totpPendingSecretEnc"] as const) {
      const value = row[field];
      if (!value) continue;
      const next = reencryptTotp(value);
      if (next.changed) data[field] = next.value;
    }
    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: row.id }, data });
      totp += Object.keys(data).length;
    }
  }
  console.log(`reencrypted fields=${fields} totp=${totp}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "reencrypt failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
