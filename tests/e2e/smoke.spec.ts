import { expect, test } from "@playwright/test";

// These need no credentials: they prove the app is locked down.
for (const path of ["/", "/tasks", "/clients", "/pipeline", "/money", "/quote/00000000-0000-0000-0000-000000000000"]) {
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

test("install files are public and valid; app pages are still locked", async ({ request, page }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBeTruthy();
  const j = await m.json();
  expect(j.display).toBe("standalone");
  for (const i of j.icons) expect((await request.get(i.src)).ok()).toBeTruthy();
  expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBeTruthy();
  await page.goto("/clients");
  await expect(page).toHaveURL(/\/login$/);
});
