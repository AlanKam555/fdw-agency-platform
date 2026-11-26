import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { brandStyleSheet } from "@/lib/security/brand-style";
import { accountFailureKey, delayMsForFailures, ipFailureKey, noteSignInFailure } from "@/lib/security/lockout";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { upstashLockAdd } from "@/lib/security/rate-limit-window";
import { checkTotp, currentTotp, hashRecoveryCode, recoveryMatches } from "@/lib/security/totp";
import { generateSecret } from "otplib";
import {
  createS3ObjectStore,
  newObjectKey,
  storageRefusal,
  validateUpload,
} from "@/lib/storage/files";
import { PutObjectCommand } from "@aws-sdk/client-s3";

describe("sign-in lockout", () => {
  it("grows the delay after five failures and locks at ten", () => {
    expect(delayMsForFailures(4)).toBe(0);
    expect(delayMsForFailures(5)).toBe(1000);
    expect(delayMsForFailures(6)).toBe(2000);
    expect(delayMsForFailures(9)).toBe(16000);
    expect(delayMsForFailures(10)).toBe(0);
  });

  it("counts failures without putting the email in the store key", async () => {
    resetRateLimits();
    process.env.LOCKOUT_DELAY_CAP_MS = "0";
    const email = "person@example.com";
    const first = await noteSignInFailure(email, "203.0.113.10");
    expect(first.locked).toBe(false);
    expect(accountFailureKey(email)).not.toContain("person");
    expect(ipFailureKey("203.0.113.10")).not.toContain("203");
    const command = upstashLockAdd(accountFailureKey(email), 1000);
    expect(command[3]).toContain("fdw:lock:");
    expect(command.join(" ")).not.toContain(email);
    delete process.env.LOCKOUT_DELAY_CAP_MS;
    resetRateLimits();
  });
});

describe("totp", () => {
  it("accepts the current code and rejects a replay of that step", () => {
    const secret = generateSecret();
    const now = Date.now();
    const token = currentTotp(secret, now);
    const first = checkTotp({ secret, token, lastStep: null, nowMs: now });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const replay = checkTotp({ secret, token, lastStep: first.timeStep, nowMs: now });
    expect(replay).toEqual({ ok: false, reason: "replay" });
  });

  it("matches a recovery code once by its hash", () => {
    const hash = hashRecoveryCode("abcde-12345");
    expect(recoveryMatches("ABCDE12345", hash)).toBe(true);
    expect(recoveryMatches("abcde-99999", hash)).toBe(false);
    expect(hash).not.toContain("abcde");
  });
});

describe("object storage", () => {
  it("uses a random key and refuses a mismatched upload", () => {
    const key = newObjectKey();
    expect(key).toMatch(/^obj\/[a-f0-9]{64}$/);
    expect(key).not.toContain("passport");
    const pdf = Buffer.from("%PDF-1.7\n");
    expect(validateUpload(pdf, "application/pdf").ok).toBe(true);
    expect(validateUpload(pdf, "image/png").ok).toBe(false);
    expect(validateUpload(Buffer.from("hello"), "text/plain").ok).toBe(false);
  });

  it("refuses the local driver in production unless it is explicit", () => {
    expect(storageRefusal({ NODE_ENV: "production", STORAGE_DRIVER: "local" })).toContain(
      "ALLOW_LOCAL_STORAGE",
    );
    expect(
      storageRefusal({ NODE_ENV: "production", STORAGE_DRIVER: "local", ALLOW_LOCAL_STORAGE: "true" }),
    ).toBeNull();
    expect(storageRefusal({ NODE_ENV: "development", STORAGE_DRIVER: "local" })).toBeNull();
    expect(storageRefusal({ NODE_ENV: "production", STORAGE_DRIVER: "s3" })).toContain("S3_BUCKET");
  });

  it("puts objects with server-side encryption and caps the download URL", async () => {
    const sent: PutObjectCommand[] = [];
    let expiry = 0;
    const store = createS3ObjectStore({
      bucket: "private-docs",
      sse: "AES256",
      send: async (command) => {
        sent.push(command as PutObjectCommand);
        return {};
      },
      presign: async (_command, seconds) => {
        expiry = seconds;
        return "https://files.example/object";
      },
    });
    await store.put("obj/abc", Buffer.from("%PDF"), { contentType: "application/pdf" });
    await store.presign!("obj/abc", 3600, { contentType: "application/pdf", fileName: "passport.pdf" });
    expect(sent[0]?.input.ServerSideEncryption).toBe("AES256");
    expect(sent[0]?.input.Key).toBe("obj/abc");
    expect(JSON.stringify(sent[0]?.input)).not.toContain("passport");
    expect(expiry).toBe(300);
  });
});

describe("content security policy header", () => {
  it("sends a policy with no inline style allowance", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/"));
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    expect(policy).toContain("style-src-attr 'none'");
    expect(policy).toContain("strict-dynamic");
    expect(policy).not.toContain("unsafe-inline");
    const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
    expect(layout).not.toContain("style={");
  });

  it("keeps brand colours inside a class rule", () => {
    const sheet = brandStyleSheet({ primary: "#0e3b37", accent: "red;}", paper: "#f3ecdf" });
    expect(sheet).toContain("html.brand-colours{");
    expect(sheet).toContain("--brass:#a86432");
    expect(sheet).not.toContain("red");
  });
});
