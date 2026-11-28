import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as reminders } from "@/app/api/cron/reminders/route";

describe("reminder cron", () => {
  it("rejects a missing or wrong bearer secret", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-cron-secret-not-for-production-32";
    const missing = await reminders(new NextRequest("http://localhost:3000/api/cron/reminders"));
    const wrong = await reminders(
      new NextRequest("http://localhost:3000/api/cron/reminders", {
        headers: { authorization: "Bearer not-the-secret" },
      }),
    );
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  it("dry-runs twice without sending or returning an address", async () => {
    const previousSend = process.env.REMINDERS_SEND;
    const previousCron = process.env.CRON_SECRET;
    delete process.env.REMINDERS_SEND;
    process.env.CRON_SECRET = "test-cron-secret-not-for-production-32";
    const request = () =>
      reminders(
        new NextRequest("http://localhost:3000/api/cron/reminders", {
          headers: { authorization: "Bearer test-cron-secret-not-for-production-32" },
        }),
      );
    const first = await request();
    const second = await request();
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(first.status).toBe(200);
    expect(firstBody.dryRun).toBe(true);
    expect(firstBody.sent).toBe(0);
    expect(JSON.stringify(firstBody)).not.toContain("@");
    expect(secondBody.sent).toBe(0);
    expect(secondBody.dryRun).toBe(true);
    if (previousSend === undefined) delete process.env.REMINDERS_SEND;
    else process.env.REMINDERS_SEND = previousSend;
    if (previousCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCron;
  });
});
