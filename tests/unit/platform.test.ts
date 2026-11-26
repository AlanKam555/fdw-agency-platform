import { describe, expect, it } from "vitest";
import { runProviderChain } from "@/lib/ai/chain";
import { providerDirectory } from "@/lib/ai/providers";
import { checkAdvertisement, complianceFooter } from "@/lib/marketing/compliance";
import { biasReport } from "@/lib/matching/fairness";
import { deterministicSimilarity } from "@/lib/matching/semantic";
import { DEFAULT_WEIGHTS, suggestWeightNudge, weightsAreValid } from "@/lib/matching/weights";
import { loadMomRules, momRules } from "@/config/mom-rules";
import { buildUtm } from "@/lib/services/growth";

describe("provider fallback", () => {
  it("skips an unconfigured provider and uses the next one", async () => {
    const result = await runProviderChain({
      providers: ["openai", "groq"],
      configured: (id) => id === "groq",
      run: async (id) => id,
      sleep: async () => undefined,
    });
    expect(result).toEqual({ ok: true, provider: "groq", value: "groq" });
  });

  it("retries then moves on", async () => {
    const calls: string[] = [];
    const result = await runProviderChain({
      providers: ["openai", "mistral"],
      configured: () => true,
      maxRetries: 1,
      backoffMs: 1,
      sleep: async () => undefined,
      run: async (id) => {
        calls.push(id);
        if (id === "openai") throw new Error("down");
        return "ok";
      },
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["openai", "openai", "mistral"]);
  });

  it("does not put key material in the directory", () => {
    for (const row of providerDirectory()) {
      expect(JSON.stringify(row)).not.toMatch(/sk-|api[_-]?key|secret/i);
      expect(row).not.toHaveProperty("apiKey");
    }
  });
});

describe("advertising compliance", () => {
  const personnel = ["R1100001"];
  const clean = "Household support with infant care. EA licence 00C0000. Personnel R1100001.";

  it("accepts a draft that shows the licence and a registration number", () => {
    expect(checkAdvertisement({ body: clean, licenceNo: "00C0000", personnelNumbers: personnel }).ok).toBe(true);
  });

  it("blocks a missing licence, a sale phrase, and demeaning wording", () => {
    expect(checkAdvertisement({ body: "Hello R1100001", licenceNo: "00C0000", personnelNumbers: personnel }).ok).toBe(false);
    expect(checkAdvertisement({ body: `${clean} maid for sale`, licenceNo: "00C0000", personnelNumbers: personnel }).blocking.map((issue) => issue.code)).toContain("commodity_language");
    expect(checkAdvertisement({ body: `${clean} obedient girl`, licenceNo: "00C0000", personnelNumbers: personnel }).blocking.map((issue) => issue.code)).toContain("demeaning_language");
  });

  it("does not treat the word maid alone as a block", () => {
    const result = checkAdvertisement({
      body: `${clean} The maid starts in January.`,
      licenceNo: "00C0000",
      personnelNumbers: personnel,
    });
    expect(result.ok).toBe(true);
  });

  it("names the configured agency in the footer", () => {
    const footer = complianceFooter({
      agencyName: "Northwind",
      licenceNo: "99C9999",
      personnel: [{ name: "Pat Lee", registrationNo: "R2200002" }],
    });
    expect(footer.startsWith("Northwind EA licence 99C9999")).toBe(true);
  });
});

describe("matching weights and fairness", () => {
  it("keeps the default weights at 100 and rejects a nationality key", () => {
    expect(weightsAreValid(DEFAULT_WEIGHTS)).toBe(true);
    expect(DEFAULT_WEIGHTS).not.toHaveProperty("nationality");
  });

  it("suggests a nudge and leaves the total at 100", () => {
    const next = suggestWeightNudge(DEFAULT_WEIGHTS, ["skill"]);
    expect(weightsAreValid(next)).toBe(true);
    expect(next.skills).toBe(45);
  });

  it("scores identical text as similar and empty text as identical", () => {
    expect(deterministicSimilarity("infant care nights", "infant care nights")).toBeGreaterThan(0.9);
    expect(deterministicSimilarity("", "")).toBe(1);
  });

  it("flags a nationality gap without treating nationality as a score weight", () => {
    const report = biasReport([
      { nationality: "Philippines", eligible: true, score: 90, approved: true },
      { nationality: "Philippines", eligible: true, score: 90, approved: false },
      { nationality: "Indonesia", eligible: true, score: 40, approved: false },
      { nationality: "Indonesia", eligible: true, score: 40, approved: false },
    ]);
    expect(report.groups.some((group) => group.review)).toBe(true);
    expect(report.note.toLowerCase()).toContain("not a score");
  });
});

describe("operator configuration", () => {
  it("keeps transcribed MOM defaults when no override is set", () => {
    expect(momRules.fdw.minAgeYears).toBe(23);
    expect(momRules.meta.verificationStatus).toBe("verify against current MOM guidance");
  });

  it("applies an age override on a copy", () => {
    const previous = process.env.MOM_FDW_MIN_AGE;
    process.env.MOM_FDW_MIN_AGE = "24";
    expect(loadMomRules().fdw.minAgeYears).toBe(24);
    expect(momRules.fdw.minAgeYears).toBe(23);
    if (previous === undefined) delete process.env.MOM_FDW_MIN_AGE;
    else process.env.MOM_FDW_MIN_AGE = previous;
  });

  it("rejects an external UTM path", () => {
    expect(buildUtm({ path: "/contact", source: "ig", medium: "social", campaign: "spring" })).toBe(
      "/contact?utm_source=ig&utm_medium=social&utm_campaign=spring",
    );
    expect(buildUtm({ path: "https://evil.example", source: "x", medium: "x", campaign: "x" })).toBeNull();
  });
});
