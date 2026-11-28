import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/security/passwords";
import { issueSession } from "@/lib/auth/sessions";
import { POST as createContract, GET as listContracts } from "@/app/api/staff/contracts/route";
import { POST as addInvoice } from "@/app/api/staff/contracts/[id]/invoices/route";
import { POST as setInvoice } from "@/app/api/staff/invoices/[id]/route";
import { POST as addPayment } from "@/app/api/staff/invoices/[id]/payments/route";

const stamp = `bill-${Date.now()}`;
const staffEmail = `${stamp}-staff@harbourlight.example`;
const employerEmail = `${stamp}-employer@harbourlight.example`;
const card = "4242424242424242";

function call(
  handler: (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>,
  path: string,
  token: string,
  csrf: string,
  body: unknown,
  id = "unused",
) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    method: body == null ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      cookie: `hl_session=${token}; hl_csrf=${csrf}`,
      "x-csrf-token": csrf,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  return handler(request, { params: Promise.resolve({ id }) });
}

afterAll(async () => {
  await prisma.employer.deleteMany({ where: { email: employerEmail } });
  await prisma.user.deleteMany({ where: { email: { in: [staffEmail, employerEmail] } } });
  await prisma.$disconnect();
});

describe("billing records", () => {
  it("keeps contracts on the staff desk and rejects card numbers", async () => {
    const passwordHash = await hashPassword("Harbourlight-Dev-1");
    const staff = await prisma.user.create({
      data: { email: staffEmail, name: "Billing Staff", role: "STAFF", passwordHash, totpSetupDueAt: null },
    });
    const employerUser = await prisma.user.create({
      data: { email: employerEmail, name: "Billing Employer", role: "EMPLOYER", passwordHash, emailVerifiedAt: new Date() },
    });
    const employer = await prisma.employer.create({
      data: {
        fullName: "Billing Household",
        email: employerEmail,
        phone: "+65 6000 0000",
        householdSize: 3,
        budgetMinSgd: 500,
        budgetMaxSgd: 800,
        startDate: new Date("2026-12-01"),
        housingType: "HDB",
        addressArea: "Tampines",
        userId: employerUser.id,
      },
    });
    const staffCsrf = "e".repeat(32);
    const staffSession = await issueSession({ user: staff, csrf: staffCsrf });
    const employerCsrf = "f".repeat(32);
    const employerSession = await issueSession({ user: employerUser, csrf: employerCsrf });

    const denied = await call(listContracts, "/api/staff/contracts", employerSession.token, employerCsrf, null);
    expect(denied.status).toBe(403);

    const blocked = await call(createContract, "/api/staff/contracts", staffSession.token, staffCsrf, {
      employerId: employer.id,
      title: "Placement fee",
      amount: "100.00",
      startsOn: "2026-12-01",
      notes: card,
      cardNumber: card,
    });
    expect(blocked.status).toBe(400);
    expect(await blocked.text()).not.toContain(card);

    const created = await call(createContract, "/api/staff/contracts", staffSession.token, staffCsrf, {
      employerId: employer.id,
      title: "Placement fee",
      amount: "100.00",
      startsOn: "2026-12-01",
      notes: "Bank transfer only",
    });
    expect(created.status).toBe(200);
    const contract = (await created.json()) as { id: string };
    const tooBig = await call(
      addInvoice,
      `/api/staff/contracts/${contract.id}/invoices`,
      staffSession.token,
      staffCsrf,
      { amount: "150.00" },
      contract.id,
    );
    expect(tooBig.status).toBe(400);
    const invoiced = await call(
      addInvoice,
      `/api/staff/contracts/${contract.id}/invoices`,
      staffSession.token,
      staffCsrf,
      { amount: "100.00" },
      contract.id,
    );
    expect(invoiced.status).toBe(200);
    const invoice = (await invoiced.json()) as { id: string };
    const issued = await call(setInvoice, `/api/staff/invoices/${invoice.id}`, staffSession.token, staffCsrf, { status: "ISSUED" }, invoice.id);
    expect(issued.status).toBe(200);
    const paid = await call(
      addPayment,
      `/api/staff/invoices/${invoice.id}/payments`,
      staffSession.token,
      staffCsrf,
      { amount: "100.00", paidOn: "2026-12-02", method: "PAYNOW", reference: "PAYNOW-1" },
      invoice.id,
    );
    expect(paid.status).toBe(200);
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(stored.status).toBe("PAID");
    expect(stored.amountCents).toBe(10000);
    const audit = await prisma.auditLog.findFirst({ where: { action: "billing.payment_recorded", entityType: "PaymentRecord" }, orderBy: { createdAt: "desc" } });
    expect(JSON.stringify(audit?.metadata)).not.toContain("Bank transfer only");
    expect(JSON.stringify(audit?.metadata)).toContain("10000");
  });
});
