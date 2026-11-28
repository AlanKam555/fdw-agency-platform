import { prisma } from "@/lib/db";
import { verifyAuditChain } from "@/lib/audit-chain";

const result = await verifyAuditChain();
if (!result.ok) {
  console.error(JSON.stringify({ ok: false, checked: result.checked, problems: result.problems }));
  await prisma.$disconnect();
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checked: result.checked }));
await prisma.$disconnect();
