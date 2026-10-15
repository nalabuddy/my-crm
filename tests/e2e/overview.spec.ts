import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL, password = process.env.E2E_PASSWORD;
test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD");

async function login(page: Page, e: string, p: string, expectHome = true) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(e);
  await page.getByLabel("Password").fill(p);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (expectHome) await expect(page).toHaveURL(/\/$/); // wait for the session cookie before navigating on
}

test("overview shows the seeded money, tasks and chase actions", async ({ page }) => {
  await login(page, email!, password!);
  await expect(page.getByRole("heading", { name: /Hi Michael/ })).toBeVisible();
  const stats = page.getByRole("region", { name: "Key numbers" });
  await expect(stats).toContainText("Owed on invoices");
  await expect(stats).toContainText("R 10 500");      // Mohammed's invoice
  await expect(stats).toContainText("Deposits pending");
  await expect(stats).toContainText("R 15 000");      // Mohammed's deposit
  const chase = page.locator("section", { hasText: "Money to chase" });
  await expect(chase).toContainText("Completed project");
  await expect(chase).toContainText("New project deposit");
  await expect(chase.getByTestId("chase-whatsapp").first()).toHaveAttribute("href", /^https:\/\/wa\.me\/.*text=Hi%20Mohammed/);
  await page.screenshot({ path: "test-results/overview.png", fullPage: true });
});

test("seeded tasks are on the Tasks page and Mine/Trevor filters work", async ({ page }) => {
  await login(page, email!, password!);
  await page.goto("/tasks");
  await expect(page.getByText("Send intranet quote to Mohammed")).toBeVisible();
  await expect(page.getByText("Restart cold calling")).toBeVisible();
  await page.getByRole("button", { name: /^Trevor$/ }).click();
  await expect(page.getByText("Restart cold calling")).toBeVisible(); // assigned to Both
});

const sEmail = process.env.E2E_STRANGER_EMAIL, sPass = process.env.E2E_STRANGER_PASSWORD;
test("a valid login with no team profile is turned away", async ({ page }) => {
  test.skip(!sEmail || !sPass, "set E2E_STRANGER_EMAIL / E2E_STRANGER_PASSWORD (a real account with no profiles row)");
  await login(page, sEmail!, sPass!, false);
  await expect(page).toHaveURL(/\/login\?error=not-authorised/);
  await expect(page.getByText("This account is not authorised.")).toBeVisible();
  await page.goto("/clients");
  await expect(page).toHaveURL(/\/login/);
});
