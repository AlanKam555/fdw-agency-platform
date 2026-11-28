import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/security/passwords";
import { issueSession } from "@/lib/auth/sessions";
import { POST as login } from "@/app/api/auth/login/route";
import { PATCH as staffUsers } from "@/app/api/staff/users/route";
import { GET as download, POST as issueLink } from "@/app/api/documents/[id]/route";
import { proxy } from "@/proxy";
import { beginTotpSetup, confirmTotpSetup, currentTotp, decryptTotpSecret } from "@/lib/security/totp";
import { saveStoredObject, setBlobStoreForTests, type BlobStore } from "@/lib/storage/files";

const stamp = `${Date.now()}`;
const adminEmail = `sec-admin-${stamp}@harbourlight.example`;
const staffEmail = `sec-staff-${stamp}@harbourlight.example`;
const password = "Harbourlight-Dev-1";

async function cleanup() {
  await prisma.user.deleteMany({
    where: { email: { in: [adminEmail, staffEmail, `sec-fast-${stamp}@harbourlight.example`] } },
  });
}

function cookieHeader(token: string, csrf: string) {
  return `hl_session=${token}; hl_csrf=${csrf}`;
}

async function userRequest(path: string, token: string, csrf: string, method = "POST", body: unknown = {}) {
  return staffUsers(
    new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie: cookieHeader(token, csrf),
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(body),
    }),
  );
}

afterAll(async () => {
  setBlobStoreForTests(null);
  await cleanup();
  await prisma.$disconnect();
});

describe("revocable sessions", () => {
  it("rejects a disabled account and a revoked session", async () => {
    process.env.LOCKOUT_DELAY_CAP_MS = "0";
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Security Admin",
        role: "ADMIN",
        passwordHash: await hashPassword(password),
        totpSetupDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    const csrf = "d".repeat(32);
    const issued = await issueSession({ user: admin, csrf });
    const disabledCall = await userRequest("/api/staff/users", issued.token, csrf, "PATCH", {
      action: "disable",
      userId: admin.id,
    });
    expect(disabledCall.status).toBe(400);

    await prisma.user.update({ where: { id: admin.id }, data: { disabledAt: new Date() } });
    const api = await userRequest("/api/staff/users", issued.token, csrf, "PATCH", {
      action: "sign_out_everywhere",
      userId: admin.id,
    });
    expect(api.status).toBe(401);

    const page = await proxy(
      new NextRequest("http://localhost:3000/dashboard", {
        headers: { cookie: cookieHeader(issued.token, csrf) },
      }),
    );
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login");

    const health = await proxy(
      new NextRequest("http://localhost:3000/api/health", {
        headers: { cookie: cookieHeader(issued.token, csrf) },
      }),
    );
    expect(health.status).toBe(401);

    await prisma.user.update({ where: { id: admin.id }, data: { disabledAt: null } });
    await prisma.session.updateMany({ where: { userId: admin.id }, data: { revokedAt: new Date() } });
    const revoked = await userRequest("/api/staff/users", issued.token, csrf, "PATCH", {
      action: "sign_out_everywhere",
      userId: admin.id,
    });
    expect(revoked.status).toBe(401);
  });
});

describe("sign-in protection", () => {
  it("locks an account with the same error and then requires a one-time code", async () => {
    process.env.LOCKOUT_DELAY_CAP_MS = "0";
    const staff = await prisma.user.create({
      data: {
        email: staffEmail,
        name: "Security Staff",
        role: "STAFF",
        passwordHash: await hashPassword(password),
      },
    });

    async function attempt(body: Record<string, string>, ip?: string) {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie: "hl_csrf=csrf-token-value-32-characters",
        "x-csrf-token": "csrf-token-value-32-characters",
      };
      if (ip) headers["x-forwarded-for"] = ip;
      return login(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers,
          body: JSON.stringify({ csrf: "csrf-token-value-32-characters", ...body }),
        }),
      );
    }

    let last = await attempt({ email: staffEmail, password: "wrong-password" });
    for (let i = 0; i < 9; i += 1) {
      last = await attempt({ email: staffEmail, password: "wrong-password" });
    }
    expect(last.status).toBe(401);
    const lockedBody = await last.json();
    expect(lockedBody.error).toBe("Invalid email or password.");
    const still = await attempt({ email: staffEmail, password });
    const stillBody = await still.json();
    expect(still.status).toBe(401);
    expect(stillBody.error).toBe("Invalid email or password.");

    delete process.env.LOCKOUT_DELAY_CAP_MS;
    const fastEmail = `sec-fast-${stamp}@harbourlight.example`;
    await prisma.user.create({
      data: {
        email: fastEmail,
        name: "Fast Lock",
        role: "EMPLOYER",
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(),
      },
    });
    const started = Date.now();
    const fastIp = "203.0.113.44";
    let fast = await attempt({ email: fastEmail, password: "wrong-password" }, fastIp);
    for (let i = 0; i < 4; i += 1) {
      fast = await attempt({ email: fastEmail, password: "wrong-password" }, fastIp);
    }
    expect(fast.status).toBe(401);
    fast = await attempt({ email: fastEmail, password: "wrong-password" }, fastIp);
    expect(fast.status).toBe(429);
    expect(fast.headers.get("retry-after")).toBeTruthy();
    expect(Date.now() - started).toBeLessThan(1500);
    process.env.LOCKOUT_DELAY_CAP_MS = "0";
    const lock = await prisma.auditLog.findFirst({
      where: { action: "auth.lockout" },
      orderBy: { createdAt: "desc" },
    });
    expect(lock).not.toBeNull();

    await prisma.user.update({
      where: { id: staff.id },
      data: { totpSetupDueAt: new Date(Date.now() - 1000) },
    });
    const { clearFailureCount } = await import("@/lib/security/rate-limit");
    const { accountFailureKey, ipFailureKey } = await import("@/lib/security/lockout");
    await clearFailureCount(accountFailureKey(staffEmail));
    await clearFailureCount(ipFailureKey("unknown"));

    const setup = await beginTotpSetup({ userId: staff.id, email: staffEmail, issuer: "Harbourlight" });
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    const pending = await prisma.user.findUnique({ where: { id: staff.id } });
    const secret = decryptTotpSecret(pending!.totpPendingSecretEnc!);
    const confirmed = await confirmTotpSetup({ userId: staff.id, code: currentTotp(secret) });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const missing = await attempt({ email: staffEmail, password });
    expect((await missing.json()).mfa).toBe("totp");
    await prisma.user.update({ where: { id: staff.id }, data: { totpLastStep: null } });
    const code = currentTotp(secret);
    const signedIn = await attempt({ email: staffEmail, password, code });
    expect(signedIn.status).toBe(200);
    const replay = await attempt({ email: staffEmail, password, code });
    expect(replay.status).toBe(401);
    const recovered = await attempt({
      email: staffEmail,
      password,
      recoveryCode: confirmed.recoveryCodes[0]!,
    });
    expect(recovered.status).toBe(200);
    const reused = await attempt({
      email: staffEmail,
      password,
      recoveryCode: confirmed.recoveryCodes[0]!,
    });
    expect(reused.status).toBe(401);

    await prisma.user.update({
      where: { id: staff.id },
      data: { totpEnabledAt: null, totpSecretEnc: null, totpSetupDueAt: new Date(Date.now() - 1000) },
    });
    const graceSession = await issueSession({ user: { ...staff, role: "STAFF" }, csrf: "f".repeat(32) });
    const blocked = await staffUsers(
      new NextRequest("http://localhost:3000/api/staff/users", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: cookieHeader(graceSession.token, "f".repeat(32)),
          "x-csrf-token": "f".repeat(32),
        },
        body: JSON.stringify({ action: "sign_out_everywhere", userId: staff.id, csrf: "f".repeat(32) }),
      }),
    );
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe("mfa_setup_required");
  });
});

describe("document downloads", () => {
  it("audits a download and only presigns after a staff session", async () => {
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    expect(admin).not.toBeNull();
    const calls: number[] = [];
    const store: BlobStore = {
      wrapsWithFieldEncryption: false,
      async put() {},
      async get() {
        return Buffer.from("%PDF");
      },
      async delete() {},
      async presign(_key, seconds) {
        calls.push(seconds);
        return "https://files.example/object";
      },
    };
    setBlobStoreForTests(store);
    const stored = await saveStoredObject(Buffer.from("%PDF-1.7"), { contentType: "application/pdf" });
    const document = await prisma.document.create({
      data: {
        kind: "OTHER",
        fileName: "note.pdf",
        contentType: "application/pdf",
        byteSize: 8,
        storageKey: stored.storageKey,
        sha256: stored.sha256,
        uploadedById: admin!.id,
      },
    });
    const anonymous = await download(
      new NextRequest(`http://localhost:3000/api/documents/${document.id}`),
      { params: Promise.resolve({ id: document.id }) },
    );
    expect(anonymous.status).toBe(401);
    expect(calls).toHaveLength(0);

    await prisma.user.update({ where: { id: admin!.id }, data: { disabledAt: null } });
    const csrf = "e".repeat(32);
    const issued = await issueSession({ user: admin!, csrf });
    const link = await issueLink(
      new NextRequest(`http://localhost:3000/api/documents/${document.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: cookieHeader(issued.token, csrf),
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({
          reasonCode: "IDENTITY_CHECK",
          reasonText: "Checking the file for the MOM pack.",
        }),
      }),
      { params: Promise.resolve({ id: document.id }) },
    );
    expect(link.status).toBe(200);
    const body = (await link.json()) as { url: string };
    const response = await download(
      new NextRequest(`http://localhost:3000${body.url}`),
      { params: Promise.resolve({ id: document.id }) },
    );
    expect(response.status).toBe(302);
    expect(calls).toEqual([300]);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "document.download", entityId: document.id },
    });
    expect(audit?.actorId).toBe(admin!.id);
    const spoiled = await download(
      new NextRequest(`http://localhost:3000/api/documents/${document.id}?token=not-a-token`, {
        headers: { cookie: cookieHeader(issued.token, csrf) },
      }),
      { params: Promise.resolve({ id: document.id }) },
    );
    expect(spoiled.status).toBe(401);
    setBlobStoreForTests(null);
  });
});
