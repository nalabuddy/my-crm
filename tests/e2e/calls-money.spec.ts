import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL, password = process.env.E2E_PASSWORD;
test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD");

const run = Date.now().toString(36);
const n = (parseInt(run, 36) % 9000) + 1000; // unique-ish 4 digits per run for phone numbers
const LEADS = [
  { name: `Acme Plumbing ${run}`, phone: `083 ${n} 111` },
  { name: `Blue Dental ${run}`, phone: `083 ${n} 222` },
  { name: `Green Garden ${run}`, phone: `083 ${n} 333` },
  { name: `Roofing Pros ${run}`, phone: `083 ${n} 444` },
];
const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}
const lead = (page: Page, name: string) => page.getByTestId("lead-card").filter({ hasText: name });

test.describe.serial("cold call list", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("paste a list, skip duplicates, tick results, make a client", async ({ page }) => {
    await page.goto("/calls");
    await page.getByRole("button", { name: "Paste list" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Call list").fill(
      `${LEADS[0].name}, Sipho, ${LEADS[0].phone}\n${LEADS[1].name} - ${LEADS[1].phone}\n${LEADS[2].name}\t${LEADS[2].phone}\n${LEADS[3].name} ${LEADS[3].phone}`);
    await expect(dialog.getByTestId("paste-preview")).toContainText("4 businesses found");
    await dialog.getByRole("button", { name: /^Add 4/ }).click();
    await expect(page.getByTestId("notice")).toContainText("Added 4");

    // pasting the same numbers again adds nothing
    await page.getByRole("button", { name: "Paste list" }).click();
    await page.getByRole("dialog").getByLabel("Call list").fill(`${LEADS[0].name} again, ${LEADS[0].phone}`);
    await page.getByRole("dialog").getByRole("button", { name: /^Add 1/ }).click();
    await expect(page.getByTestId("notice")).toContainText("Added 0, skipped 1");

    // tick the results
    await page.getByRole("button", { name: /^All \(/ }).click();
    await lead(page, LEADS[0].name).getByRole("button", { name: "No answer" }).click();
    await expect(lead(page, LEADS[0].name).getByTestId("lead-status")).toHaveText("No answer");
    await expect(lead(page, LEADS[0].name)).toContainText("Called 1×");

    await lead(page, LEADS[1].name).getByRole("button", { name: "Call back later" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(lead(page, LEADS[1].name).getByTestId("lead-status")).toHaveText("Call back later");

    await lead(page, LEADS[2].name).getByRole("button", { name: "Meeting booked" }).click();
    await expect(lead(page, LEADS[2].name).getByTestId("lead-status")).toHaveText("Meeting booked");

    await lead(page, LEADS[3].name).getByRole("button", { name: "Interested: send quote" }).click();
    await expect(lead(page, LEADS[3].name).getByTestId("lead-status")).toHaveText("Interested");
    await lead(page, LEADS[3].name).getByRole("button", { name: /Make client/ }).click();
    await expect(lead(page, LEADS[3].name)).toContainText("Client ✓");
    await expect(page.getByTestId("notice")).toContainText("now a client");

    // filters: Done shows the finished ones, not the two still to call
    await page.getByRole("button", { name: "Done" }).click();
    await expect(lead(page, LEADS[2].name)).toBeVisible();
    await expect(lead(page, LEADS[3].name)).toBeVisible();
    await expect(lead(page, LEADS[0].name)).toHaveCount(0);

    // resetting puts it back to Not called
    await page.getByRole("button", { name: /^All \(/ }).click();
    await lead(page, LEADS[2].name).getByRole("button", { name: "Reset" }).click();
    await expect(lead(page, LEADS[2].name).getByTestId("lead-status")).toHaveText("Not called");
  });

  test("the converted lead is a Cold call client with a send-quote task; then clean up", async ({ page }) => {
    await page.goto("/tasks");
    const task = page.getByTestId("task-row").filter({ hasText: `Send quote to ${LEADS[3].name}` });
    await expect(task).toBeVisible();
    await task.getByRole("button", { name: new RegExp(LEADS[3].name) }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(task).toHaveCount(0);

    await page.goto("/clients");
    await page.getByLabel("Search clients").fill(LEADS[3].name);
    await page.getByTestId("client-row").first().click();
    await expect(page.getByText("Cold call").first()).toBeVisible();
    await expect(page.getByText("Cold call: interested")).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/clients$/);

    await page.goto("/calls");
    await page.getByRole("button", { name: /^All \(/ }).click();
    for (const l of LEADS) {
      await lead(page, l.name).getByRole("button", { name: l.name }).click();
      page.once("dialog", (d) => d.accept());
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await expect(lead(page, l.name)).toHaveCount(0);
    }
  });
});

test.describe.serial("lead sheet paste", () => {
  test.beforeEach(async ({ page }) => { await login(page); });
  const T = "\t";
  const hdr = ["Lead ID", "Assigned To", "Niche", "Tier", "Business Name", "Category", "Phone", "City", "Reviews", "Unclaimed GBP", "Also Listed As (same phone)", "Call Status (live)"].join(T);
  const row = (id: string, who: string, tier: string, name: string, phone: string, status = "Not Called") =>
    [id, who, "Legal", tier, `${name} ${run}`, "Attorney", phone, "Gqeberha", "5", "Yes", "", status].join(T);
  const ph = (k: number) => `+27 82 ${n} ${100 + k}`;
  const SHEET = [
    hdr,
    row("L-901", "Dom", "A", "Sheet Dom Alpha", ph(1)),
    row("L-902", "Dom", "C", "Sheet Dom Charlie", ph(2), "No Answer"),
    row("L-903", "Obi", "B", "Sheet Obi Bravo", ph(3)),
    row("L-904", "Tyler", "A", "Sheet Tyler Alpha", ph(4), "Do Not Call"),
    row("L-905", "Tyler", "C", "Sheet Tyler Charlie", ph(5)),
  ].join("\n");
  const mine = (page: Page) => page.getByTestId("lead-card").filter({ hasText: run });

  test("paste the sheet, leave out a caller, filters and statuses", async ({ page }) => {
    await page.goto("/calls");
    await page.getByRole("button", { name: "Paste list" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Call list").fill(SHEET);
    await expect(dialog.getByTestId("paste-preview")).toContainText("5 businesses found (lead sheet detected)");
    await expect(dialog.getByText("Dom (2 leads)")).toBeVisible();
    await expect(dialog.getByText("Obi (1 leads)")).toBeVisible();
    await expect(dialog.getByText("Tyler (2 leads)")).toBeVisible();

    await dialog.getByLabel(/Obi/).check();                       // leave Obi's out
    await expect(dialog.getByTestId("paste-preview")).toContainText("4 businesses found");
    await expect(dialog.getByTestId("paste-preview")).toContainText("1 left out");
    await dialog.getByRole("button", { name: /^Add 4/ }).click();
    await expect(page.getByTestId("notice")).toContainText("Added 4");

    await page.getByRole("button", { name: /^All \(/ }).click();
    await page.getByLabel("Search the call list").fill(run);
    await expect(mine(page)).toHaveCount(4);
    await expect(page.getByText(`Sheet Obi Bravo ${run}`)).toHaveCount(0);          // left out

    // chips and the order: Tier A first
    await expect(mine(page).first()).toContainText("Tier A");
    await expect(mine(page).first().getByTestId("lead-chips")).toContainText("Legal");
    await expect(mine(page).first().getByTestId("lead-chips")).toContainText("Gqeberha");

    // statuses from the sheet
    const dnc = mine(page).filter({ hasText: "Sheet Tyler Alpha" });
    await expect(dnc.getByTestId("lead-status")).toHaveText("Not interested");
    await expect(dnc).toContainText("DO NOT CALL");
    const noans = mine(page).filter({ hasText: "Sheet Dom Charlie" });
    await expect(noans.getByTestId("lead-status")).toHaveText("No answer");
    await expect(noans).toContainText("Called 1×");

    // filters
    await page.getByLabel("Allocated to").selectOption("Dom");
    await expect(mine(page)).toHaveCount(2);
    await page.getByLabel("Tier").selectOption("A");
    await expect(mine(page)).toHaveCount(1);
    await expect(mine(page)).toContainText("Sheet Dom Alpha");
    await page.getByLabel("Allocated to").selectOption("");
    await expect(mine(page)).toHaveCount(2);                                         // both Tier A: Dom + Tyler
    await page.getByLabel("Tier").selectOption("");

    // pasting the same sheet again adds nothing new (same phone numbers)
    await page.getByRole("button", { name: "Paste list" }).click();
    await page.getByRole("dialog").getByLabel("Call list").fill(SHEET);
    await page.getByRole("dialog").getByLabel(/Obi/).check();
    await page.getByRole("dialog").getByRole("button", { name: /^Add 4/ }).click();
    await expect(page.getByTestId("notice")).toContainText("Added 0, skipped 4");

    // clean up
    for (const name of ["Sheet Dom Alpha", "Sheet Dom Charlie", "Sheet Tyler Alpha", "Sheet Tyler Charlie"]) {
      await mine(page).filter({ hasText: name }).getByRole("button", { name: `${name} ${run}` }).click();
      page.once("dialog", (d) => d.accept());
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await expect(mine(page).filter({ hasText: name })).toHaveCount(0);
    }
  });

  test("not keeping the allocation label leaves it blank", async ({ page }) => {
    await page.goto("/calls");
    await page.getByRole("button", { name: "Paste list" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Call list").fill([hdr, row("L-911", "Dom", "B", "NoLabel Dom", ph(11))].join("\n"));
    await dialog.getByLabel(/Keep who each lead was allocated to/).uncheck();
    await dialog.getByRole("button", { name: /^Add 1/ }).click();
    await expect(page.getByTestId("notice")).toContainText("Added 1");
    await page.getByRole("button", { name: /^All \(/ }).click();
    await page.getByLabel("Search the call list").fill(run);
    const card = page.getByTestId("lead-card").filter({ hasText: `NoLabel Dom ${run}` });
    await expect(card).toBeVisible();
    await expect(card.getByTestId("lead-chips")).not.toContainText("→");
    await card.getByRole("button", { name: `NoLabel Dom ${run}` }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(card).toHaveCount(0);
  });
});

test.describe.serial("expenses, profit, projected, target", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  const money = async (page: Page, id: string) => {
    await page.getByRole("tab", { name: "Revenue" }).click();
    const v = digits(await page.getByTestId(id).innerText());
    const neg = (await page.getByTestId(id).innerText()).includes("-");
    return neg ? -v : v;
  };

  test("an expense lowers profit by exactly that amount, a deal adds to projected, a target shows on the chart", async ({ page }) => {
    await page.goto("/money");
    const profit0 = await money(page, "profit-this-month");
    const projected0 = await money(page, "projected-total");
    await expect(page.getByTestId("rev-month")).toHaveCount(12);

    // expense
    const note = `E2E expense ${run}`;
    await page.getByRole("tab", { name: "Expenses" }).click();
    await page.getByRole("button", { name: "+ Expense" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Amount (R)").fill("1234");
    await dialog.getByLabel("Category").fill("Hosting");
    await dialog.getByLabel("Note").fill(note);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("expense-row").filter({ hasText: note })).toBeVisible();
    expect(await money(page, "profit-this-month")).toBe(profit0 - 1234);

    // target shows on the chart legend, and survives a reload
    await page.getByLabel("Monthly revenue target (R)").fill("50000");
    await page.getByRole("button", { name: "Save target" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Revenue" }).click();
    await expect(page.getByTestId("revenue")).toContainText("Target R 50 000");

    // projected: an open deal due this month
    const title = `E2E projected deal ${run}`;
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "+ Add deal" }).click();
    await page.getByLabel("Deal", { exact: true }).fill(title);
    await page.getByLabel("Value (R)").fill("4000");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    await page.getByLabel("Due").fill(today);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(title)).toBeVisible();
    await page.goto("/money");
    expect(await money(page, "projected-total")).toBe(projected0 + 4000);

    // clean up: deal, expense, target back to none
    await page.goto("/pipeline");
    await page.getByRole("button", { name: new RegExp(title) }).first().click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(title)).toHaveCount(0);

    await page.goto("/money");
    await page.getByRole("tab", { name: "Expenses" }).click();
    await page.getByTestId("expense-row").filter({ hasText: note }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("expense-row").filter({ hasText: note })).toHaveCount(0);
    expect(await money(page, "profit-this-month")).toBe(profit0);
    await page.getByLabel("Monthly revenue target (R)").fill("0");
    await page.getByRole("button", { name: "Save target" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
  });
});
