import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/auth/register/route";
import { authenticate } from "@/lib/services/accounts";
import { confirmEmailVerification, verificationOutbox } from "@/lib/security/email-verification";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { REGISTRATION_NOTE } from "@/lib/security/registration";

const email = `register-${Date.now()}@harbourlight.example`;

function request(body: Record<string, unknown>) {
  const csrf = "c".repeat(32);
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      cookie: `hl_csrf=${csrf}`,
      "x-csrf-token": csrf,
    },
    body: JSON.stringify(body),
  });
}

describe("public registration", () => {
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email }, seq: null } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("returns the same acknowledgement and does not replace an existing password", async () => {
    resetRateLimits();
    const firstBody = {
      role: "EMPLOYER",
      name: "Registration Test",
      email,
      password: "Harbourlight-Dev-1",
      pdpaConsent: true,
    };
    const first = await register(request(firstBody));
    const second = await register(
      request({ ...firstBody, role: "CANDIDATE", name: "Someone Else", password: "Different-Pass-2" }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, note: REGISTRATION_NOTE });
    expect(await second.json()).toEqual({ ok: true, note: REGISTRATION_NOTE });
    expect(first.headers.get("set-cookie") ?? "").not.toContain("hl_session");
    expect(second.headers.get("set-cookie") ?? "").not.toContain("hl_session");

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.role).toBe("EMPLOYER");
    expect(user?.name).toBe("Registration Test");
    expect(user?.emailVerifiedAt).toBeNull();
    expect(await authenticate(email, "Harbourlight-Dev-1", "127.0.0.1")).toBeNull();
    const item = [...verificationOutbox()].reverse().find((row) => row.to === email);
    expect(item?.url).toBeTruthy();
    const token = new URL(item!.url).searchParams.get("token");
    expect(token).toBeTruthy();
    expect(await confirmEmailVerification(token!)).toBe(true);
    expect(await confirmEmailVerification(token!)).toBe(false);
    expect(await authenticate(email, "Harbourlight-Dev-1", "127.0.0.1")).not.toBeNull();
    expect(await authenticate(email, "Different-Pass-2", "127.0.0.1")).toBeNull();
  });
});
