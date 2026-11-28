import { describe, expect, it } from "vitest";
import { minimisePii } from "@/lib/ai/pii";
import { marketingPrompt } from "@/lib/ai/drafts";
import { checkAdvertisement } from "@/lib/marketing/compliance";
import { estimateCostMicro, PRICE_TABLE_NOTE, microToCents } from "@/lib/ai/pricing";
import { canonicalJson, hashAuditRow } from "@/lib/audit-chain";
import { embedCap, prepareEmbedText } from "@/lib/ai/embeddings";
import { candidateWindowDays } from "@/lib/privacy/retention";
import { PRIVACY_POLICY } from "@/lib/privacy/policy";

describe("privacy and AI prompt surface", () => {
  it("redacts contact and identity tokens and leaves a licence number", () => {
    const text = minimisePii("Write to ana@example.com or +65 9123 4567. NRIC S1234567D. Passport K1234567. Licence 00C0000.");
    expect(text).not.toContain("ana@example.com");
    expect(text).not.toContain("91234567");
    expect(text).not.toContain("S1234567D");
    expect(text).not.toContain("K1234567");
    expect(text).toContain("00C0000");
  });

  it("wraps untrusted facts and omits the full name", () => {
    const prompt = marketingPrompt("profile", {
      fullName: "Ana Reyes",
      id: "cand_ana_reyes",
      nationality: "Philippines",
      experienceYears: 6,
      skills: ["INFANT_CARE"],
      languages: ["English"],
      householdExperience: "Call 91234567",
      notes: "email ana@example.com",
    });
    expect(prompt).not.toContain("Ana Reyes");
    expect(prompt).toContain("untrusted");
    expect(prompt).toContain("INFANT_CARE");
    expect(prompt).toContain("[redacted]");
    expect(prompt).not.toContain("ana@example.com");
  });

  it("flags contact channels and unapproved claims without flagging the licence line", () => {
    const clean = checkAdvertisement({
      body: "Household support with infant care. EA licence 00C0000. Personnel R1100001.",
      licenceNo: "00C0000",
      personnelNumbers: ["R1100001"],
    });
    expect(clean.ok).toBe(true);
    const dirty = checkAdvertisement({
      body: "Best maid guaranteed. Call 91234567 or see https://example.com. EA licence 00C0000. Personnel R1100001.",
      licenceNo: "00C0000",
      personnelNumbers: ["R1100001"],
    });
    const codes = dirty.blocking.map((issue) => issue.code);
    expect(codes).toContain("contact_channel");
    expect(codes).toContain("unapproved_claim");
  });

  it("prices in micro-dollars and says the table needs verification", () => {
    expect(PRICE_TABLE_NOTE).toMatch(/verif/i);
    const micro = estimateCostMicro({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000_000,
      outputTokens: 0,
      kind: "chat",
    });
    expect(micro).toBe(150_000);
    expect(microToCents(micro)).toBe(15);
  });

  it("hashes a canonical audit payload", () => {
    const left = canonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const right = canonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    expect(left).toBe(right);
    const hash = hashAuditRow({
      seq: 1,
      actorId: "user",
      action: "test",
      entityType: "Candidate",
      entityId: "id",
      metadata: { b: 1, a: 2 },
      ip: null,
      prevHash: "",
    });
    expect(hash).toHaveLength(64);
  });

  it("caps embedding text", () => {
    delete process.env.AI_EMBED_MAX_CHARS;
    expect(embedCap()).toBe(600);
    const prepared = prepareEmbedText("a".repeat(2000));
    expect(prepared.charsUsed).toBe(600);
    expect(prepared.originalChars).toBe(2000);
  });

  it("uses the pending window for a new application", () => {
    expect(candidateWindowDays("APPLIED")).toBe(PRIVACY_POLICY.retention.pendingApplicationDays);
    expect(candidateWindowDays("DEPLOYED")).toBe(PRIVACY_POLICY.retention.deployedRecordDays);
  });
});
