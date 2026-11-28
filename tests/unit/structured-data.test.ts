import { describe, expect, it } from "vitest";
import { employmentAgencyJsonLd } from "@/lib/seo/structured-data";

const real = {
  fictionalDemo: false,
  name: "North Quay Agency",
  legalName: "North Quay Agency Pte. Ltd.",
  url: "https://agency.example",
  phone: "+65 6123 4567",
  email: "desk@agency.example",
  address: "1 Quay Street, Singapore 018900",
  licenceNo: "12C3456",
};

describe("employment agency JSON-LD", () => {
  it("publishes nothing for the fictional demo", () => {
    expect(
      employmentAgencyJsonLd({
        ...real,
        fictionalDemo: true,
        phone: "+65 6000 0148",
        email: "hello@harbourlight.example",
        address: "18 Circular Road, Singapore 049379",
        licenceNo: "00C0000",
      }),
    ).toBeNull();
  });

  it("omits placeholder contact details on a real deployment", () => {
    const data = employmentAgencyJsonLd({
      ...real,
      phone: "+65 6000 0148",
      email: "hello@harbourlight.example",
      address: "18 Circular Road, Singapore 049379",
      licenceNo: "00C0000",
    });
    expect(data?.name).toBe("North Quay Agency Pte. Ltd.");
    expect(data).not.toHaveProperty("telephone");
    expect(data).not.toHaveProperty("email");
    expect(data).not.toHaveProperty("address");
    expect(JSON.stringify(data)).not.toContain("fictional");
  });

  it("includes a real address and licence", () => {
    const data = employmentAgencyJsonLd(real);
    expect(data?.["@type"]).toBe("EmploymentAgency");
    expect(data?.telephone).toBe("+65 6123 4567");
    expect(data?.identifier).toBe("12C3456");
  });
});
