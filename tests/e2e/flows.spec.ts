import { expect, test, type Page } from "@playwright/test";

// Needs a REAL Supabase project (or local Supabase) with the migration applied, a profile for this user,
// and E2E_EMAIL / E2E_PASSWORD set. Uses unique names so it can be re-run and cleans up after itself.
const email = process.env.E2E_EMAIL, password = process.env.E2E_PASSWORD;
test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD to run the logged-in flows");

const run = Date.now().toString(36);
const CLIENT = `E2E Client ${run}`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe.serial("main flows", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("add client", async ({ page }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "+ Add client" }).click();
    await page.getByLabel("Business / client name").fill(CLIENT);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: CLIENT })).toBeVisible(); // lands on detail page
    await page.goto("/clients");
    await page.getByLabel("Search clients").fill(CLIENT);
    await expect(page.getByTestId("client-row")).toHaveCount(1);
  });

  test("add task, tick it done", async ({ page }) => {
    await page.goto("/tasks");
    const title = `E2E task ${run}`;
    await page.getByLabel("Task title").fill(title);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const row = page.getByTestId("task-row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole("checkbox").check();
    await expect(page.getByTestId("task-row").filter({ hasText: title })).toHaveCount(0); // hidden when done
    await page.getByLabel("Show done").check();
    await expect(page.getByTestId("task-row").filter({ hasText: title })).toBeVisible();
    // clean up: open it and delete
    await page.getByTestId("task-row").filter({ hasText: title }).getByRole("button", { name: title }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: title })).toHaveCount(0);
  });

  test("part payments, over-payment rejected, fix a mistake, chase link", async ({ page }) => {
    await page.goto("/money");
    await page.getByRole("button", { name: "+ Invoice / deposit" }).click();
    await page.getByLabel("Client").selectOption({ label: CLIENT });
    await page.getByLabel("Label").fill(`E2E invoice ${run}`);
    await page.getByLabel("Amount (R)").fill("1000");
    await page.getByRole("button", { name: "Save" }).click();
    const card = page.getByTestId("invoice-card").filter({ hasText: CLIENT });
    await expect(card.getByTestId("balance")).toContainText("1\u00A0000");

    const dialog = page.getByRole("dialog");
    const pay = async (amount: string) => {
      await card.getByRole("button", { name: "Record payment" }).click();
      await dialog.getByLabel("Amount received (R)").fill(amount);
      await dialog.getByRole("button", { name: "Record payment" }).click();
    };

    await pay("400");
    await expect(card.getByTestId("balance")).toContainText("600");
    await expect(card).toContainText("1 payment");
    await pay("250");
    await expect(card.getByTestId("balance")).toContainText("350");
    await expect(card).toContainText("2 payments");

    // server-side guard: bypass the browser max attribute
    await card.getByRole("button", { name: "Record payment" }).click();
    await dialog.getByLabel("Amount received (R)").evaluate((el: HTMLInputElement) => el.removeAttribute("max"));
    await dialog.getByLabel("Amount received (R)").fill("351");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/exceeds/i);
    await page.keyboard.press("Escape");
    await expect(card.getByTestId("balance")).toContainText("350"); // nothing was saved

    // Chase link: WhatsApp message names the balance and project
    const href = await card.getByTestId("chase-whatsapp").getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const text = decodeURIComponent(href!.split("text=")[1]);
    expect(text).toContain("R 350");
    expect(text).toContain(`E2E invoice ${run}`);

    // Fix a mistake: edit the R250 payment to R200, then delete the R400 one
    await card.getByText("Payments (2)").click();
    await card.getByTestId("payment-row").filter({ hasText: "250" }).getByRole("button", { name: "Edit" }).click();
    await dialog.getByLabel("Amount (R)").fill("200");
    await dialog.getByRole("button", { name: "Save payment" }).click();
    await expect(card.getByTestId("balance")).toContainText("400");
    page.once("dialog", (d) => d.accept());
    await card.getByTestId("payment-row").filter({ hasText: "400" }).getByRole("button", { name: "Delete" }).click();
    await expect(card.getByTestId("balance")).toContainText("800");
    await expect(card).toContainText("1 payment");

    await pay("800");
    await expect(card).toHaveCount(0); // fully paid: leaves the "outstanding" view
    await page.getByRole("button", { name: "all", exact: true }).click();
    await expect(card.getByTestId("balance")).toHaveText("Paid");
    await expect(card.getByTestId("chase-whatsapp")).toHaveCount(0);
  });

  test("move deal through the pipeline", async ({ page }) => {
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "+ Add deal" }).click();
    const title = `E2E deal ${run}`;
    await page.getByLabel("Deal", { exact: true }).fill(title);
    await page.getByLabel("Value (R)").fill("5000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("col-Lead").getByText(title)).toBeVisible();
    await page.getByRole("button", { name: `Move ${title} forward to Quote sent` }).click();
    await expect(page.getByTestId("col-Quote sent").getByText(title)).toBeVisible();
    await expect(page.getByTestId("col-Lead").getByText(title)).toHaveCount(0);
    // clean up: delete the deal
    await page.getByTestId("col-Quote sent").getByRole("button", { name: new RegExp(title) }).first().click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("cleanup", async ({ page }) => {
    await page.goto("/clients");
    await page.getByLabel("Search clients").fill(CLIENT);
    await page.getByTestId("client-row").first().click();
    await page.getByRole("button", { name: "Edit" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/clients$/);
  });
});
