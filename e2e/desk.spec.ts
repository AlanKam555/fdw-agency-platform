import { expect, test, type Locator, type Page } from "@playwright/test";
import { generateSync } from "otplib";

test.describe.configure({ mode: "serial" });

function watchCsp(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/content security policy|refused to apply|refused to execute|refused to load/i.test(message.text())) {
      problems.push(message.text());
    }
  });
  return problems;
}

async function submitAndSettle(scope: Page | Locator, name: string) {
  const button = scope.getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toBeEnabled();
  await expect(button.locator("xpath=ancestor::form").getByRole("alert")).toHaveCount(0);
}

function currentCode(secret: string) {
  return generateSync({ secret: secret.trim(), period: 30, epoch: Math.floor(Date.now() / 1000) });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("public site, hiring desk, reminders, rules, and outcomes", async ({ page, request }) => {
  const csp = watchCsp(page);
  const stamp = Date.now();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Care for the household");

  await page.goto("/apply");
  await page.getByLabel("Full name").fill("E2E Helper");
  await page.getByLabel("Email").fill(`helper-${stamp}@example.com`);
  await page.getByLabel("Phone").fill("81234567");
  await page.getByLabel("Password for tracking your status").fill("Helper-Apply-19");
  await page.getByLabel("Date of birth").fill("1994-04-12");
  await page.getByLabel("Years of formal education").fill("10");
  await page.getByLabel("Years of household experience").fill("4");
  await page.getByRole("checkbox", { name: "Infant care" }).check();
  await page.getByRole("checkbox", { name: "English" }).check();
  await page.getByLabel("Expected monthly salary (SGD)").fill("600");
  await page.getByLabel("Available from").fill("2026-12-01");
  await page.getByRole("checkbox", { name: /privacy notice for processing/i }).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("If this email is new, the application is saved.")).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Employer");
  await page.getByLabel("Email").fill(`employer-${stamp}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("Employer-Test-19");
  await page.getByRole("checkbox", { name: /privacy notice for creating/i }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("If this email is available, the account is ready.")).toBeVisible();

  await signIn(page, `employer-${stamp}@example.com`, "Employer-Test-19");
  await page.waitForURL(/\/employer/);
  await page.goto("/employers/enquire");
  await page.getByLabel("Name").fill("E2E Employer");
  await page.getByLabel("Email").fill(`employer-${stamp}@example.com`);
  await page.getByLabel("Phone").fill("82345678");
  await page.getByLabel("Household size").fill("3");
  await page.getByLabel("Children", { exact: true }).fill("1");
  await page.getByLabel("Children under 7").fill("1");
  await page.getByLabel("Elderly members who need care").fill("0");
  await page.getByRole("checkbox", { name: "Infant care" }).check();
  await page.getByRole("checkbox", { name: "English" }).check();
  await page.getByLabel("Budget minimum (SGD)").fill("500");
  await page.getByLabel("Budget maximum (SGD)").fill("800");
  await page.getByLabel("Start date").fill("2026-12-01");
  await page.getByLabel("Neighbourhood").fill("Queenstown");
  await page.getByRole("checkbox", { name: /privacy notice for this household/i }).check();
  await submitAndSettle(page, "Send brief");
  await page.goto("/employer/requirements");
  await expect(page.getByText(/Requirement \d{4}-\d{2}-\d{2}/)).toBeVisible();

  await signIn(page, "employer@harbourlight.example", "Harbourlight-Dev-1");
  await page.goto("/maids");
  await page.getByRole("link", { name: "Ana Reyes" }).click();
  await submitAndSettle(page, "Add to shortlist");
  await expect(page.getByRole("heading", { name: "Ana Reyes" })).toBeVisible();
  await page.getByLabel("Preferred window").fill("Weekday evenings");
  await submitAndSettle(page, "Request an interview");
  await page.goto("/employer/interviews");
  await expect(page.getByText("Ana Reyes").first()).toBeVisible();
  await expect(page.getByText("Weekday evenings").first()).toBeVisible();

  await signIn(page, "staff@harbourlight.example", "Harbourlight-Dev-1");
  await page.waitForURL(/\/account\/security/);
  await page.getByRole("button", { name: "Start setup" }).click();
  const secret = (await page.getByTestId("totp-secret").innerText()).trim();
  const used = currentCode(secret);
  await page.getByLabel("Code from the app").fill(used);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Two-factor authentication is on.")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect.poll(() => currentCode(secret), { timeout: 35_000 }).not.toBe(used);
  await signIn(page, "staff@harbourlight.example", "Harbourlight-Dev-1");
  await expect(page.getByLabel("Authentication code")).toBeVisible();
  await page.getByLabel("Authentication code").fill(currentCode(secret));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto("/dashboard/matching");
  const requirement = page.locator("article", { hasText: "Infant care in Queenstown" });
  await submitAndSettle(requirement, "Rank available helpers");
  await page.getByRole("link", { name: "Infant care in Queenstown" }).click();
  const ana = page.locator("article", { hasText: "Ana Reyes" });
  await ana.getByRole("button", { name: "Approve match" }).click();
  await expect(ana.getByRole("link", { name: "Prepare the MOM pack" })).toBeVisible();
  await ana.getByRole("link", { name: "Prepare the MOM pack" }).click();
  await page.getByRole("checkbox", { name: /not a relative/i }).check();
  await page.getByRole("checkbox", { name: /outside Singapore/i }).check();
  await page.getByRole("checkbox", { name: /Security bond arranged/i }).check();
  await page.getByRole("checkbox", { name: /Medical insurance arranged/i }).check();
  await page.getByRole("checkbox", { name: /Personal accident insurance/i }).check();
  await page.getByRole("checkbox", { name: /NRIC address/i }).check();
  await page.getByLabel("Agreed salary (SGD)").fill("650");
  await page.getByLabel("Rest days per month").fill("4");
  await page.getByLabel("Proposed submission date").fill("2026-12-01");
  await page.getByRole("button", { name: "Build checklist" }).click();
  const pdf = page.getByRole("link", { name: "Download summary PDF" });
  await expect(pdf).toBeVisible();
  const pdfResponse = await request.get(new URL(await pdf.getAttribute("href") ?? "", page.url()).pathname, {
    headers: { cookie: (await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") },
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await page.goto("/dashboard/reminders");
  const settling = page.locator("form", { has: page.locator("[data-reminder-type=settling_in]") });
  await settling.getByRole("button", { name: "Opt in" }).click();
  await expect(page.locator("[data-reminder-type=settling_in]")).toContainText("opted in");
  const cron = await request.get("/api/cron/reminders", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(cron.ok()).toBeTruthy();
  const first = await cron.json();
  expect(first.dryRun).toBe(true);
  expect(first.sent).toBe(0);
  expect(JSON.stringify(first)).not.toContain("@");
  const again = await request.get("/api/cron/reminders", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const second = await again.json();
  expect(second.sent).toBe(0);
  expect(second.duplicates).toBeGreaterThan(0);

  await page.goto("/dashboard/mom-rules");
  await expect(page.getByText("Needs verification").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Official MOM source" }).first()).toHaveAttribute("href", /mom\.gov\.sg/);
  await expect(page.getByText(/90-day/)).toBeVisible();

  await page.goto("/dashboard/outcomes");
  const match = page.locator("select[name=matchId]");
  const matchId = await match.evaluate((select) => {
    const option = [...select.querySelectorAll("option")].find((item) => item.textContent?.includes("Ana Reyes"));
    return option?.value ?? "";
  });
  await match.selectOption(matchId);
  await page.getByLabel("Started").fill("2026-01-01");
  await page.getByLabel("Ended", { exact: true }).fill("2026-06-01");
  await page.locator("select[name=completion]").selectOption("EARLY_TERMINATION");
  await page.locator("select[name=reasonCategory]").selectOption("SKILL_GAP");
  await page.getByLabel("Employer satisfaction (1–5)").fill("2");
  await page.getByLabel(/Helper satisfaction/i).fill("4");
  await page.getByLabel("Staff-only notes").fill("Staff note kept on the desk.");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(page.getByText(/Outcome saved/)).toBeVisible();

  await page.goto("/dashboard/matching");
  await expect(page.getByText("Outcome evidence: 1").first()).toBeVisible();
  await expect(page.getByText("Suggested skills 45").first()).toBeVisible();
  await expect(page.getByText(/not applied/i).first()).toBeVisible();
  await page.getByRole("link", { name: "Infant care in Queenstown" }).click();
  await expect(page.locator("form[method=get] input[name=skills]")).toHaveValue("40");
  await expect(page.getByText(/not applied/i)).toBeVisible();

  expect(csp).toEqual([]);
});
