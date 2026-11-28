import { describe, expect, it } from "vitest";
import { idleTimeoutMs, sessionAbsoluteSeconds, sessionPolicySummary } from "@/lib/auth/session-policy";

describe("session policy", () => {
  it("clamps absolute life to seven days and refuses a zero idle window", () => {
    const previous = {
      absolute: process.env.SESSION_ABSOLUTE_HOURS,
      staff: process.env.SESSION_IDLE_STAFF_MINUTES,
      portal: process.env.SESSION_IDLE_PORTAL_MINUTES,
    };
    process.env.SESSION_ABSOLUTE_HOURS = "9999";
    process.env.SESSION_IDLE_STAFF_MINUTES = "0";
    process.env.SESSION_IDLE_PORTAL_MINUTES = "nope";
    try {
      expect(sessionAbsoluteSeconds()).toBe(60 * 60 * 24 * 7);
      expect(idleTimeoutMs("STAFF")).toBe(5 * 60 * 1000);
      expect(idleTimeoutMs("EMPLOYER")).toBe(12 * 60 * 60 * 1000);
    } finally {
      process.env.SESSION_ABSOLUTE_HOURS = previous.absolute;
      process.env.SESSION_IDLE_STAFF_MINUTES = previous.staff;
      process.env.SESSION_IDLE_PORTAL_MINUTES = previous.portal;
    }
    const summary = sessionPolicySummary();
    expect(summary.staffIdleMinutes).toBeLessThanOrEqual(120);
    expect(summary.absoluteHours).toBeLessThanOrEqual(168);
  });
});
