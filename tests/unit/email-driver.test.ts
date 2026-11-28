import { describe, expect, it, vi } from "vitest";
import { createConsoleDriver, readUnsubscribeToken, signUnsubscribeToken } from "@/lib/email/driver";
import { dedupeKey } from "@/lib/reminders/dispatch";
import { logEvent } from "@/lib/log";

describe("reminder email", () => {
  it("logs a console send without the address, subject, or body", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((line) => {
      lines.push(String(line));
    });
    const driver = createConsoleDriver();
    await driver.send({
      to: "household@example.com",
      subject: "Permit expiry for a named person",
      text: "The body names the household and the helper.",
      template: "work_permit_expiry",
    });
    spy.mockRestore();
    const joined = lines.join("\n");
    expect(joined).toContain("work_permit_expiry");
    expect(joined).not.toContain("household@example.com");
    expect(joined).not.toContain("Permit expiry");
    expect(joined).not.toContain("named person");
    expect(joined).not.toContain("helper");
  });

  it("drops email fields from structured logs", () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((line) => {
      lines.push(String(line));
    });
    logEvent("info", "reminder.dispatch", {
      dryRun: true,
      email: "hidden@example.com",
      subject: "do not keep",
      body: "do not keep",
      recipient: "hidden@example.com",
      driver: "console",
    });
    spy.mockRestore();
    expect(lines.join("\n")).not.toContain("example.com");
    expect(lines.join("\n")).toContain("console");
  });

  it("signs an unsubscribe token that does not reveal the address in the signature half", () => {
    const token = signUnsubscribeToken("person@example.com", 2_000_000_000, "test-auth-secret-not-for-production-32");
    expect(readUnsubscribeToken(token, 1_900_000_000, "test-auth-secret-not-for-production-32")).toBe("person@example.com");
    expect(readUnsubscribeToken(token, 2_100_000_000, "test-auth-secret-not-for-production-32")).toBeNull();
    expect(readUnsubscribeToken(`${token}x`, 1_900_000_000, "test-auth-secret-not-for-production-32")).toBeNull();
    const [, mac] = token.split(".");
    expect(mac).not.toContain("person@example.com");
  });

  it("builds a stable dedupe key without keeping the raw address", () => {
    const first = dedupeKey({ kind: "settling_in", entityId: "rem_1", email: "Home@Example.com", dueOn: "2026-06-02" });
    const second = dedupeKey({ kind: "settling_in", entityId: "rem_1", email: "home@example.com", dueOn: "2026-06-02" });
    const otherDay = dedupeKey({ kind: "settling_in", entityId: "rem_1", email: "home@example.com", dueOn: "2026-06-03" });
    expect(first).toBe(second);
    expect(first).not.toBe(otherDay);
    expect(first).not.toContain("@");
  });
});
