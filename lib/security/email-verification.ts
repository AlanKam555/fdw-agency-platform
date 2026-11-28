import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { createEmailDriver, emailDriverName } from "@/lib/email/driver";
import { derivedKey } from "@/lib/crypto/hkdf";
import { logEvent } from "@/lib/log";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { brand } from "@/config/brand";

const HOUR_MS = 60 * 60 * 1000;

type OutboxItem = { to: string; url: string };

const memory: OutboxItem[] = [];

export function verificationOutbox(): OutboxItem[] {
  return memory;
}

export function resetVerificationOutbox(): void {
  memory.length = 0;
}

function hours(): number {
  const raw = Number(process.env.EMAIL_VERIFY_HOURS ?? "24");
  if (!Number.isFinite(raw) || raw < 1 || raw > 168) return 24;
  return Math.floor(raw);
}

function signToken(raw: string): string {
  const mac = createHmac("sha256", derivedKey("email-verify")).update(raw).digest("base64url");
  return `${raw}.${mac}`;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readVerificationToken(token: string): string | null {
  const [raw, mac] = token.split(".");
  if (!raw || !mac) return null;
  const expected = createHmac("sha256", derivedKey("email-verify")).update(raw).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return token;
}

async function remember(item: OutboxItem): Promise<void> {
  memory.push(item);
  if (process.env.NODE_ENV === "test") return;
  if (emailDriverName() !== "console" && process.env.NODE_ENV === "production") return;
  await mkdir("private", { recursive: true });
  await appendFile(
    "private/dev-outbox.jsonl",
    `${JSON.stringify({ at: new Date().toISOString(), type: "verify-email", to: item.to, url: item.url })}\n`,
  );
}

export async function issueEmailVerification(userId: string, email: string): Promise<boolean> {
  const limit = await consumeRateLimit(`verify:${createHash("sha256").update(email).digest("hex").slice(0, 16)}`, 5, HOUR_MS);
  if (!limit.ok) return false;
  const raw = randomBytes(32).toString("base64url");
  const token = signToken(raw);
  const expiresAt = new Date(Date.now() + hours() * HOUR_MS);
  await prisma.$transaction([
    prisma.emailVerification.deleteMany({ where: { userId, usedAt: null } }),
    prisma.emailVerification.create({
      data: { userId, tokenHash: tokenHash(token), expiresAt },
    }),
  ]);
  const origin = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const url = `${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  await remember({ to: email, url });
  if (process.env.NODE_ENV === "test") return true;
  try {
    const driver = await createEmailDriver();
    await driver.send({
      to: email,
      subject: `Confirm your ${brand.name} account`,
      text: `Confirm your account:\n${url}\n\nThis link works once.`,
      template: "email_verify",
    });
  } catch {
    logEvent("error", "email.delivery_unconfigured", { template: "email_verify" });
  }
  return true;
}

export async function confirmEmailVerification(token: string): Promise<boolean> {
  const signed = readVerificationToken(token);
  if (!signed) return false;
  const row = await prisma.emailVerification.findUnique({ where: { tokenHash: tokenHash(signed) } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return false;
  const used = await prisma.emailVerification.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (used.count !== 1) return false;
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
  return true;
}
