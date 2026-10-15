import { expect, test } from "@playwright/test";

// These need no credentials: they prove the app is locked down.
for (const path of ["/", "/tasks", "/clients", "/pipeline", "/money"]) {
  test(`logged-out ${path} redirects to /login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
}

test("login page has no sign-up link and rejects empty submit", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/sign up|create account|register/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
