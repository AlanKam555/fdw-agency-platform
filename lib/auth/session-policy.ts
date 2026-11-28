import type { Role } from "@/lib/security/rbac";

/** Hard ceiling. This is the previous absolute lifetime. A setting cannot raise it. */
export const SESSION_ABSOLUTE_MAX_SECONDS = 60 * 60 * 24 * 7;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function readBounded(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Absolute session lifetime. Out-of-range values clamp inside 1 hour and 7 days. */
export function sessionAbsoluteSeconds(): number {
  const hours = readBounded("SESSION_ABSOLUTE_HOURS", 168, 1, 168);
  return Math.min(hours * 60 * 60, SESSION_ABSOLUTE_MAX_SECONDS);
}

/**
 * Idle window. Staff and admin default to 30 minutes and cannot be set above 2 hours.
 * Employers and helpers default to 12 hours. A blank or non-integer value keeps the default.
 * Zero is not an off switch: it clamps to the minimum.
 */
export function idleTimeoutMs(role: Role): number {
  if (role === "ADMIN" || role === "STAFF") {
    return readBounded("SESSION_IDLE_STAFF_MINUTES", 30, 5, 120) * MINUTE_MS;
  }
  return readBounded("SESSION_IDLE_PORTAL_MINUTES", 12 * 60, 30, 24 * 60) * MINUTE_MS;
}

/** Revoked rows are deleted after this delay. Expired rows are deleted immediately. */
export function revokedSessionRetentionMs(): number {
  return readBounded("SESSION_REVOKED_RETENTION_HOURS", 24, 1, 168) * HOUR_MS;
}

export function sessionPolicySummary() {
  return {
    absoluteHours: sessionAbsoluteSeconds() / 3600,
    staffIdleMinutes: idleTimeoutMs("STAFF") / MINUTE_MS,
    portalIdleMinutes: idleTimeoutMs("EMPLOYER") / MINUTE_MS,
    revokedRetentionHours: revokedSessionRetentionMs() / HOUR_MS,
  };
}
