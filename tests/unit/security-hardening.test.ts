import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { derivedKey } from "@/lib/crypto/hkdf";
import { decryptString, encryptString } from "@/lib/crypto/field-encryption";
import { clientIp } from "@/lib/security/client-ip";
import { assertHuman, honeypotTripped } from "@/lib/security/bot-protection";
import { assertProductionSecrets } from "@/lib/security/secrets";
import { cronAuthorized } from "@/lib/http/cron";
import { hashRecoveryCode, mfaAttemptKey, recoveryMatches } from "@/lib/security/totp";
import { uploadBodyRejection } from "@/lib/storage/uploads";
import { signDocumentAccess } from "@/lib/storage/signed-url";

describe("security hardening", () => {
  it("ignores a spoofed first X-Forwarded-For address", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(headers, {} as NodeJS.ProcessEnv)).toBe("5.6.7.8");
    expect(clientIp(headers, { TRUSTED_PROXY_HOPS: "1" } as unknown as NodeJS.ProcessEnv)).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9", "x-real-ip": "8.8.8.8" }), {} as NodeJS.ProcessEnv)).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }), { CLIENT_IP_HEADER: "x-real-ip" } as unknown as NodeJS.ProcessEnv)).toBe("8.8.8.8");
  });

  it("derives a different key for each purpose", () => {
    const secret = "purpose-separation-secret-32-bytes";
    const session = derivedKey("session", secret).toString("hex");
    const document = derivedKey("doc-token", secret).toString("hex");
    const reminder = derivedKey("reminder-hash", secret).toString("hex");
    expect(session).not.toBe(document);
    expect(document).not.toBe(reminder);
  });

  it("decrypts v1 ciphertext and rejects a short tag", () => {
    const key = Buffer.from(process.env.FIELD_ENCRYPTION_KEY ?? "", "base64");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([cipher.update("legacy", "utf8"), cipher.final()]);
    const legacy = ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(":");
    expect(decryptString(legacy)).toBe("legacy");
    const current = encryptString("P0001111").split(":");
    current[3] = "aa";
    expect(() => decryptString(current.join(":"))).toThrow();
  });

  it("keeps a new recovery code after AUTH_SECRET changes", () => {
    const code = "abcde-fghij";
    const hash = hashRecoveryCode(code);
    expect(hash.startsWith("rk2.")).toBe(true);
    expect(recoveryMatches(code, hash)).toBe(true);
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "rotated-auth-secret-value-32-bytes";
    expect(recoveryMatches(code, hash)).toBe(true);
    const legacy = createHmac("sha256", previous ?? "").update("abcde").digest("hex");
    expect(recoveryMatches("abcde", legacy)).toBe(false);
    process.env.AUTH_SECRET = previous;
    expect(recoveryMatches("abcde", legacy)).toBe(true);
  });

  it("refuses published secrets in production and accepts a fresh set", () => {
    const denied = {
      NODE_ENV: "production",
      AUTH_SECRET: "a".repeat(32),
      CRON_SECRET: "b".repeat(32),
      FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
      TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      APP_URL: "http://localhost:3000",
    } as NodeJS.ProcessEnv;
    expect(() => assertProductionSecrets(denied)).toThrow(/published default/);
    const field = randomBytes(32).toString("base64");
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: "c".repeat(40),
        CRON_SECRET: "d".repeat(40),
        FIELD_ENCRYPTION_KEY: field,
        TOTP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        APP_URL: "https://agency.example",
        S3_SECRET_ACCESS_KEY: randomBytes(32).toString("base64"),
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
    const savedCron = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "short-secret";
    expect(cronAuthorized("Bearer short-secret")).toBe(false);
    if (savedCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedCron;
  });

  it("treats an empty honeypot as a person and a filled one as a bot", async () => {
    expect(honeypotTripped({ company_website: "" })).toBe(false);
    expect(honeypotTripped({ company_website: "https://spam.example" })).toBe(true);
    expect(await assertHuman({}, "127.0.0.1", { BOT_PROTECTION: "off" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("rejects a missing or oversized upload length", () => {
    expect(uploadBodyRejection(null)?.status).toBe(411);
    expect(uploadBodyRejection("1.5")?.status).toBe(411);
    expect(uploadBodyRejection(String(6 * 1024 * 1024))?.status).toBe(413);
    expect(uploadBodyRejection("1024")).toBeNull();
  });

  it("requires a signer on document tokens and includes the IP in the MFA bucket", () => {
    expect(() => signDocumentAccess("doc")).toThrow(/signer/);
    expect(mfaAttemptKey("user", "203.0.113.9")).toBe("mfa:user:203.0.113.9");
    expect(mfaAttemptKey("user", null)).toBe("mfa:user:unknown");
  });
});
