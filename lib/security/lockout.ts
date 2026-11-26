import { createHash } from "node:crypto";
import { logEvent } from "@/lib/log";
import { addFailureCount, clearFailureCount, readFailureCount } from "@/lib/security/rate-limit";

export const LOCKOUT_DELAY_AFTER = 5;
export const LOCKOUT_LOCK_AFTER = 10;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const INVALID_LOGIN_MESSAGE = "Invalid email or password.";

export function delayMsForFailures(failures: number): number {
  if (failures < LOCKOUT_DELAY_AFTER || failures >= LOCKOUT_LOCK_AFTER) return 0;
  return 1000 * 2 ** (failures - LOCKOUT_DELAY_AFTER);
}

export function cappedDelayMs(ms: number): number {
  const raw = process.env.LOCKOUT_DELAY_CAP_MS;
  if (raw == null || raw.trim() === "") return ms;
  const cap = Number(raw);
  if (!Number.isFinite(cap) || cap < 0) return ms;
  return Math.min(ms, cap);
}

export function sleepForLockout(ms: number): Promise<void> {
  const wait = cappedDelayMs(ms);
  if (wait <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, wait));
}

export function accountFailureKey(email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `acct:${digest}`;
}

export function ipFailureKey(ip: string): string {
  const digest = createHash("sha256").update(ip.trim() || "unknown").digest("hex");
  return `ip:${digest}`;
}

export type LockGate = {
  locked: boolean;
  delayMs: number;
  retryAfterSeconds: number;
  scope: "account" | "ip" | null;
  justLocked: boolean;
  count: number;
};

function gateFromCounts(
  account: { count: number; ttlMs: number },
  remote: { count: number; ttlMs: number },
  justLocked = false,
): LockGate {
  const accountLocked = account.count >= LOCKOUT_LOCK_AFTER;
  const ipLocked = remote.count >= LOCKOUT_LOCK_AFTER;
  const locked = accountLocked || ipLocked;
  const count = Math.max(account.count, remote.count);
  const ttlMs = Math.max(accountLocked ? account.ttlMs : 0, ipLocked ? remote.ttlMs : 0);
  return {
    locked,
    delayMs: locked ? 0 : cappedDelayMs(delayMsForFailures(count)),
    retryAfterSeconds: locked ? Math.max(1, Math.ceil(ttlMs / 1000)) : 0,
    scope: accountLocked ? "account" : ipLocked ? "ip" : null,
    justLocked,
    count,
  };
}

export async function gateSignIn(email: string, ip: string, now = Date.now()): Promise<LockGate> {
  const [account, remote] = await Promise.all([
    readFailureCount(accountFailureKey(email), now),
    readFailureCount(ipFailureKey(ip), now),
  ]);
  const gate = gateFromCounts(account, remote);
  if (gate.locked) {
    logEvent("warn", "auth.lockout_blocked", { scope: gate.scope, failures: gate.count });
  }
  return gate;
}

export async function noteSignInFailure(email: string, ip: string, now = Date.now()): Promise<LockGate> {
  const windowMs = LOCKOUT_WINDOW_MS;
  const [account, remote] = await Promise.all([
    addFailureCount(accountFailureKey(email), windowMs, now),
    addFailureCount(ipFailureKey(ip), windowMs, now),
  ]);
  const justLocked = account.count === LOCKOUT_LOCK_AFTER || remote.count === LOCKOUT_LOCK_AFTER;
  const gate = gateFromCounts(account, remote, justLocked);
  if (justLocked) {
    logEvent("warn", "auth.lockout", { scope: gate.scope, failures: gate.count });
  }
  return gate;
}

export async function clearSignInFailures(email: string, ip: string): Promise<void> {
  await Promise.all([
    clearFailureCount(accountFailureKey(email)),
    clearFailureCount(ipFailureKey(ip)),
  ]);
}
