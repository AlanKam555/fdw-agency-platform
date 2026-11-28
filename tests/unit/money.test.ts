import { describe, expect, it } from "vitest";
import { looksLikePaymentCard, parseMoneyToCents } from "@/lib/billing/money";
import { paymentSchema } from "@/lib/billing/schemas";

describe("recorded money", () => {
  it("stores decimal strings as integer cents", () => {
    expect(parseMoneyToCents("1500.00")).toBe(150000);
    expect(parseMoneyToCents("0.50")).toBe(50);
    expect(parseMoneyToCents("0")).toBeNull();
    expect(parseMoneyToCents("1.234")).toBeNull();
    expect(parseMoneyToCents("1000000.01")).toBeNull();
  });

  it("rejects a card number and keeps an ordinary reference", () => {
    expect(looksLikePaymentCard("paid by 4242 4242 4242 4242")).toBe(true);
    expect(looksLikePaymentCard("PayNow ref 839201")).toBe(false);
    const parsed = paymentSchema.safeParse({
      amount: "10.00",
      paidOn: "2026-11-28",
      method: "PAYNOW",
      reference: "4242424242424242",
      notes: "",
    });
    expect(parsed.success).toBe(false);
  });
});
