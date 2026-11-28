import { describe, expect, it } from "vitest";
import { localeHasGaps, safeNextPath, t } from "@/lib/i18n";

describe("locale switch", () => {
  it("keeps the English home sentence used by the public site", () => {
    expect(t("en", "home.title")).toBe("Care for the household, with the paperwork kept in the open.");
    expect(t("zh", "home.title")).not.toBe(t("en", "home.title"));
    expect(t("ta", "nav.services")).toBe("Services");
    expect(localeHasGaps("ta")).toBe(true);
    expect(localeHasGaps("en")).toBe(false);
  });

  it("refuses an open redirect", () => {
    expect(safeNextPath("/faq")).toBe("/faq");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/%2f%2fevil.example")).toBe("/");
    expect(safeNextPath("/\\evil")).toBe("/");
    expect(safeNextPath("/faq?x=1")).toBe("/faq?x=1");
    expect(safeNextPath("/faq\nSet-Cookie:x")).toBe("/");
    expect(safeNextPath("/%0d%0aSet-Cookie:x")).toBe("/");
  });
});
