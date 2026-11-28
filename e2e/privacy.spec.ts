import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Harbourlight-Dev-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("a helper can open consent and a data download", async ({ page }) => {
  await signIn(page, "candidate@harbourlight.example");
  await page.goto("/candidate/privacy");
  await expect(page.getByRole("heading", { name: "Your data" })).toBeVisible();
  const savePhoto = page.getByRole("button", { name: "Save Photo on the public gallery" });
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/privacy/consent") && response.ok()),
    savePhoto.click(),
  ]);
  await expect(page.getByText("photo_publication: withdrawn").first()).toBeVisible();
  await page.getByLabel("Password").fill("not-the-password");
  const [denied] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/privacy/export")),
    page.getByRole("button", { name: "Download my data" }).click(),
  ]);
  expect(denied.status()).toBe(403);
});

test("an employer can open consent and a data download", async ({ page }) => {
  await signIn(page, "employer@harbourlight.example");
  await page.goto("/employer/privacy");
  await expect(page.getByRole("heading", { name: "Your data" })).toBeVisible();
  const saveAi = page.getByRole("button", { name: "Save AI processing of household notes" });
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/privacy/consent") && response.ok()),
    saveAi.click(),
  ]);
  await expect(page.getByText("ai_processing: withdrawn").first()).toBeVisible();
  await page.getByLabel("Password").fill("not-the-password");
  const [denied] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/privacy/export")),
    page.getByRole("button", { name: "Download my data" }).click(),
  ]);
  expect(denied.status()).toBe(403);
});
