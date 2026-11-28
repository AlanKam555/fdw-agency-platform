import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { guardRequest } from "@/lib/http/api";
import { cronAuthorized } from "@/lib/http/cron";
import { candidateIsDue, daysAgo, recordIsDue } from "@/lib/privacy/retention";
import { PRIVACY_POLICY } from "@/lib/privacy/policy";
import { contentSecurityPolicy, scriptSrcDirective } from "@/lib/security/csp";
import {
  consumeRateLimit,
  rateLimit,
  resetRateLimits,
  setRateLimitStoreForTests,
  type RateLimitStore,
} from "@/lib/security/rate-limit";
import {
  parseUpstashBody,
  resultFromEval,
  upstashCommand,
} from "@/lib/security/rate-limit-window";
import {
  APPLICATION_RECEIVED_NOTE,
  publicApplicationBody,
  publicRegistrationBody,
  REGISTRATION_NOTE,
} from "@/lib/security/registration";

afterEach(() => {
  resetRateLimits();
  delete process.env.RATE_LIMIT_DRIVER;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.REDIS_URL;
});

describe("content security policy", () => {
  it("keeps production scripts on a nonce and strict-dynamic", () => {
    const previous = process.env.APP_URL;
    process.env.APP_URL = "https://agency.example";
    const policy = contentSecurityPolicy("abcDEF123", false);
    process.env.APP_URL = previous;
    const script = scriptSrcDirective(policy);
    expect(script).toBe("script-src 'self' 'nonce-abcDEF123' 'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(policy).toContain("style-src 'self' 'nonce-abcDEF123'");
    expect(policy).toContain("style-src-elem 'self' 'nonce-abcDEF123'");
    expect(policy).toContain("style-src-attr 'none'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).toContain("upgrade-insecure-requests");
    process.env.APP_URL = "http://localhost:3000";
    expect(contentSecurityPolicy("abcDEF123", false)).not.toContain("upgrade-insecure-requests");
    process.env.APP_URL = previous;
  });

  it("allows eval only for the dev server", () => {
    const script = scriptSrcDirective(contentSecurityPolicy("devnonce", true));
    expect(script).toContain("'nonce-devnonce'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).toContain("unsafe-eval");
    expect(script).not.toContain("unsafe-inline");
  });
});

describe("registration acknowledgements", () => {
  it("uses one body for a new account and an existing email", () => {
    const fresh = publicRegistrationBody();
    const again = publicRegistrationBody();
    expect(fresh).toEqual(again);
    expect(JSON.stringify(fresh)).not.toContain("already");
    expect(fresh.note).toBe(REGISTRATION_NOTE);
  });

  it("hides duplicate applications behind the same acknowledgement", () => {
    const created = publicApplicationBody({ ok: true });
    const duplicate = publicApplicationBody({
      ok: false,
      code: "duplicate_email",
      error: "An account with this email already exists. Sign in to continue the application.",
    });
    expect(created).toEqual(duplicate);
    expect(created.body).toEqual({ ok: true, note: APPLICATION_RECEIVED_NOTE });
    expect(JSON.stringify(created.body)).not.toContain("already exists");
    const other = publicApplicationBody({ ok: false, error: "Profile not found" });
    expect(other.status).toBe(409);
  });
});

describe("rate limit stores", () => {
  it("falls back to memory when Upstash is selected without credentials", async () => {
    process.env.RATE_LIMIT_DRIVER = "upstash";
    expect((await consumeRateLimit("missing", 1, 60_000, 1_000)).ok).toBe(true);
    expect((await consumeRateLimit("missing", 1, 60_000, 1_001)).ok).toBe(false);
  });

  it("uses an injected store and falls back when that store throws", async () => {
    const calls: string[] = [];
    const store: RateLimitStore = {
      name: "fake",
      async consume(key, limit, windowMs, now) {
        calls.push(key);
        return rateLimit(`remote:${key}`, limit, windowMs, now);
      },
    };
    setRateLimitStoreForTests(store);
    expect((await consumeRateLimit("k", 1, 60_000, 5_000)).ok).toBe(true);
    expect((await consumeRateLimit("k", 1, 60_000, 5_001)).ok).toBe(false);
    expect(calls).toEqual(["k", "k"]);

    setRateLimitStoreForTests({
      name: "down",
      async consume() {
        throw new Error("store unavailable");
      },
    });
    expect((await consumeRateLimit("local-backstop", 1, 60_000, 8_000)).ok).toBe(true);
    expect((await consumeRateLimit("local-backstop", 1, 60_000, 8_001)).ok).toBe(false);
  });

  it("parses a fixed window without putting a token in the command", () => {
    const command = upstashCommand("login:1", 60_000);
    expect(command[0]).toBe("EVAL");
    expect(command[3]).toBe("fdw:rl:login:1");
    expect(command.join(" ")).not.toMatch(/token|secret|sk-/i);
    expect(resultFromEval([1, 60_000], 2, 60_000)).toMatchObject({ ok: true, remaining: 1 });
    expect(resultFromEval([3, 1500], 2, 60_000)).toEqual({
      ok: false,
      remaining: 0,
      retryAfterSeconds: 2,
    });
    expect(parseUpstashBody({ result: [2, 1000] }, 2, 60_000).ok).toBe(true);
    expect(() => parseUpstashBody({ error: "NOAUTH" }, 2, 60_000)).toThrow();
  });

  it("sets Retry-After when a request is limited", async () => {
    const request = () =>
      new NextRequest("http://localhost:3000/api/health", { method: "GET" });
    const first = await guardRequest(request(), {}, { limit: { key: "unit", max: 1, windowMs: 60_000 } });
    const second = await guardRequest(request(), {}, { limit: { key: "unit", max: 1, windowMs: 60_000 } });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.response.status).toBe(429);
      expect(second.response.headers.get("retry-after")).toBeTruthy();
    }
  });
});

describe("retention selection", () => {
  const now = new Date("2026-11-26T00:00:00.000Z");

  it("uses the policy windows", () => {
    const rules = PRIVACY_POLICY.retention;
    expect(recordIsDue(daysAgo(now, rules.enquiryDays), now, rules.enquiryDays)).toBe(true);
    expect(recordIsDue(daysAgo(now, rules.enquiryDays - 1), now, rules.enquiryDays)).toBe(false);
    expect(
      candidateIsDue({
        status: "REJECTED",
        updatedAt: daysAgo(now, rules.rejectedApplicationDays),
        redactedAt: null,
        now,
      }),
    ).toBe(true);
    expect(
      candidateIsDue({
        status: "REJECTED",
        updatedAt: daysAgo(now, rules.rejectedApplicationDays),
        redactedAt: now,
        now,
      }),
    ).toBe(false);
    expect(
      candidateIsDue({
        status: "DEPLOYED",
        updatedAt: daysAgo(now, rules.activeApplicationDays),
        redactedAt: null,
        now,
      }),
    ).toBe(false);
    expect(
      candidateIsDue({
        status: "AVAILABLE",
        updatedAt: daysAgo(now, rules.activeApplicationDays),
        redactedAt: null,
        now,
      }),
    ).toBe(true);
  });
});

describe("cron authorization", () => {
  it("compares the bearer token in constant time and rejects a missing secret", () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect(cronAuthorized("Bearer anything")).toBe(false);
    process.env.CRON_SECRET = "cron-test-secret-not-real-32-bytes-min";
    expect(cronAuthorized("Bearer cron-test-secret-not-real-32-bytes-min")).toBe(true);
    expect(cronAuthorized("Bearer cron-test-secret-not-real")).toBe(false);
    expect(cronAuthorized("Bearer cron-test-secret-not-reaX")).toBe(false);
    expect(cronAuthorized("Bearer short")).toBe(false);
    expect(cronAuthorized(null)).toBe(false);
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });
});
